"""
Minecraft Mod Translator Client
Переводит JAR-файлы модов Minecraft через API сервера

Поддерживаемые функции:
- Многопоточная обработка файлов
- Автоматические повторные попытки при ошибках
- Прогресс-бар и детальное логирование
- Гибкая настройка параметров обработки
- Валидация файлов перед отправкой
- Выбор AI провайдера (OpenRouter или Ollama)
- Устойчивость к сетевым ошибкам и ошибкам сервера
"""

import requests
import argparse
import os
import json
import shutil
import logging
import time
import threading
import sys
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Union
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Настройка кодировки для Windows
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Поддерживаемые языковые коды
SUPPORTED_LANGUAGES = [
    'af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'ny',
    'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'tl', 'fi', 'fr',
    'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'iw', 'hi', 'hmn', 'hu',
    'is', 'ig', 'id', 'ga', 'it', 'ja', 'jw', 'kn', 'kk', 'km', 'ko', 'ku', 'ky', 'lo',
    'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne',
    'no', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd',
    'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tg', 'ta', 'te', 'th', 'tr', 'uk',
    'ur', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'
]

# Поддерживаемые AI провайдеры
AI_PROVIDERS = ['openrouter', 'ollama']

# Константы
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
DEFAULT_THREADS = 3
REQUEST_TIMEOUT = 300  # 5 минут
MAX_RETRIES = 3
BACKOFF_FACTOR = 0.5

class TranslationClient:
    """Клиент для перевода JAR-файлов через API сервера"""
    
    def __init__(self, base_url: str = "http://localhost:8250"):
        self.base_url = base_url
        self.session = self._create_session()
        self.stats = {
            'success': 0,
            'failed': 0,
            'invalid': 0,
            'corrupted': 0,
            'skipped': 0,
            'connection_errors': 0,
            'server_errors': 0,
            'ai_provider': {
                'openrouter': 0,
                'ollama': 0
            }
        }
        self.lock = threading.Lock()
        self.server_available = True
    
    def _create_session(self) -> requests.Session:
        """Создает сессию с настройками повторных попыток"""
        session = requests.Session()
        
        # Настройка повторных попыток
        retry_strategy = Retry(
            total=MAX_RETRIES,
            backoff_factor=BACKOFF_FACTOR,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def validate_server_connection(self, skip_health_check: bool = False) -> bool:
        """Проверка доступности сервера перед началом обработки"""
        if skip_health_check:
            logging.warning("⚠️ Проверка доступности сервера пропущена (skip_health_check=True)")
            return True
            
        try:
            # Попытка получить информацию о сервере
            health_url = self.base_url.replace('/process', '/health')
            logging.info(f"🔍 Проверка доступности сервера: {health_url}")
            
            response = self.session.get(health_url, timeout=10)
            if response.status_code == 200:
                logging.info(f"✅ Сервер доступен. Статус: {response.status_code}")
                try:
                    server_info = response.json()
                    logging.info(f"ℹ️ Информация о сервере: {server_info}")
                except:
                    logging.info(f"ℹ️ Сервер вернул ответ: {response.text[:100]}...")
                return True
            else:
                logging.warning(f"⚠️ Сервер вернул статус {response.status_code}")
                # Если сервер вернул 404 на /health, но API может быть доступно
                if response.status_code == 404:
                    logging.warning("🔧 Эндпоинт /health не найден, но API может быть доступно. Продолжаем обработку...")
                    return True
                return False
        except Exception as e:
            logging.error(f"❌ Ошибка при проверке сервера: {e}")
            logging.warning("⚠️ Не удалось проверить сервер, но продолжаем обработку файлов...")
            return True  # Продолжаем работу даже при ошибке проверки
    
    def validate_jar_file(self, file_path: Path) -> Tuple[bool, str]:
        """
        Валидация JAR файла перед отправкой
        
        Returns:
            Tuple[bool, str]: (валиден, сообщение об ошибке)
        """
        try:
            if not file_path.exists():
                return False, f"Файл не существует: {file_path}"
            
            if file_path.stat().st_size == 0:
                return False, f"Файл пустой: {file_path}"
            
            if file_path.stat().st_size > MAX_FILE_SIZE:
                return False, f"Файл слишком большой (> {MAX_FILE_SIZE/1024/1024}MB): {file_path}"
            
            if not file_path.name.endswith('.jar'):
                return False, f"Неверное расширение файла (требуется .jar): {file_path}"
            
            return True, ""
        except Exception as e:
            return False, f"Ошибка при валидации файла: {e}"
    
    def move_file(self, source_path: Path, target_dir: Path) -> bool:
        """
        Безопасное перемещение файла в указанную директорию
        
        Returns:
            bool: Успешность операции
        """
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / source_path.name
            
            logging.info(f"📁 Перемещение файла: {source_path} -> {target_path}")
            
            # Проверка существования целевого файла
            if target_path.exists():
                # Создаем уникальное имя, если файл уже существует
                counter = 1
                while target_path.exists():
                    new_name = f"{source_path.stem}_{counter}{source_path.suffix}"
                    target_path = target_dir / new_name
                    counter += 1
            
            shutil.move(str(source_path), str(target_path))
            logging.info(f"✅ Файл успешно перемещен: {target_path}")
            return True
        except Exception as e:
            logging.error(f"❌ Ошибка при перемещении файла {source_path}: {e}", exc_info=True)
            return False
    
    def handle_error(self, exception: Exception, file_path: Path, 
                    output_invalid: Path, output_corrupted: Path) -> str:
        """Обработка ошибок при запросе к API. Возвращает тип ошибки."""
        error_message = str(exception)
        error_type = "unknown"
        
        logging.error(f"🚨 Произошла ошибка при обработке {file_path.name}: {error_message}")
        
        # Проверка типа исключения
        if isinstance(exception, requests.exceptions.RequestException):
            # Проверяем, что response существует и не равен None
            response = getattr(exception, 'response', None)
            if response is not None:
                # Обработка ошибок с ответом от сервера
                try:
                    # Попытка получить детали ошибки из JSON
                    if response.headers.get('Content-Type', '').startswith('application/json'):
                        response_data = response.json()
                        error_message = response_data.get("error", response_data.get("message", str(exception)))
                    else:
                        error_message = response.text or str(exception)
                except Exception as json_error:
                    logging.debug(f"Отладка: ошибка при парсинге JSON: {json_error}")
                    # Защита от случая, когда response.text также может быть недоступен
                    try:
                        error_message = response.text or str(exception)
                    except AttributeError:
                        error_message = str(exception)
                        logging.debug(f"Отладка: ошибка при доступе к response.text: {exception}")
                
                # Анализ HTTP статуса
                try:
                    status_code = response.status_code
                    if 400 <= status_code < 500:
                        # Клиентские ошибки
                        error_lower = error_message.lower()
                        if any(keyword in error_lower for keyword in ["поврежд", "corrupted", "invalid zip", "not a zip", "broken archive"]):
                            error_type = "corrupted"
                            self.move_file(file_path, output_corrupted)
                            logging.error(f"🔧 Файл поврежден: {file_path.name} - {error_message}")
                        
                        elif any(keyword in error_lower for keyword in ["отсутствует папка", "no folder", "missing folder", "assets", "lang", "resource", "translation"]):
                            error_type = "invalid"
                            self.move_file(file_path, output_invalid)
                            logging.error(f"🧩 Неверная структура мода: {file_path.name} - {error_message}")
                        
                        else:
                            error_type = "client_error"
                            logging.error(f"⚠️ Ошибка клиента ({status_code}): {file_path.name} - {error_message}")
                    
                    elif 500 <= status_code < 600:
                        # Серверные ошибки
                        error_type = "server_error"
                        with self.lock:
                            self.stats['server_errors'] += 1
                        logging.error(f"🔥 Серверная ошибка ({status_code}): {file_path.name} - {error_message}")
                except AttributeError:
                    # Если не удается получить status_code
                    error_type = "network_error"
                    logging.error(f"🌐 Ошибка при получении статуса ответа: {file_path.name}")
            else:
                # Обработка сетевых ошибок без ответа
                if isinstance(exception, requests.exceptions.ConnectionError):
                    error_type = "connection_error"
                    error_message = "Ошибка подключения к серверу"
                elif isinstance(exception, requests.exceptions.Timeout):
                    error_type = "timeout_error"
                    error_message = "Таймаут подключения к серверу"
                elif isinstance(exception, requests.exceptions.RetryError):
                    error_type = "retry_exceeded"
                    error_message = "Превышено количество попыток подключения"
                else:
                    error_type = "network_error"
                    error_message = f"Сетевая ошибка: {str(exception)}"
                
                logging.error(f"🌐 {error_message}: {file_path.name}")
                with self.lock:
                    self.stats['connection_errors'] += 1
                # При сетевых ошибках не перемещаем файл, чтобы можно было повторить обработку
        
        else:
            # Обработка других типов исключений
            error_type = "application_error"
            logging.error(f"🐞 Ошибка приложения: {file_path.name} - {error_message}", exc_info=True)
        
        # Обновление статистики
        with self.lock:
            if error_type == "corrupted":
                self.stats['corrupted'] += 1
            elif error_type == "invalid":
                self.stats['invalid'] += 1
            elif error_type in ["server_error", "client_error", "application_error", "retry_exceeded"]:
                self.stats['failed'] += 1
        
        return error_type
    
    def process_single_file(self, file_path: Path, output_dir: Path, 
                          output_invalid: Path, output_corrupted: Path,
                          params: Dict[str, Union[str, int]]) -> bool:
        """
        Обработка одного JAR файла
        
        Returns:
            bool: Успешность обработки
        """
        try:
            # Валидация файла
            is_valid, error_msg = self.validate_jar_file(file_path)
            if not is_valid:
                logging.warning(f"⚠️ Пропуск файла {file_path.name}: {error_msg}")
                with self.lock:
                    self.stats['skipped'] += 1
                return False
            
            logging.info(f"🚀 Обработка файла: {file_path.name}")
            logging.info(f"⚙️ Параметры перевода: {params}")
            
            # Чтение файла
            with open(file_path, 'rb') as jar_file:
                files = {'jarFile': (file_path.name, jar_file, 'application/java-archive')}
                
                try:
                    # Логирование запроса
                    logging.debug(f"📤 Отправка запроса на {self.base_url} для файла {file_path.name}")
                    
                    response = self.session.post(
                        self.base_url,
                        files=files,
                        data=params,
                        timeout=REQUEST_TIMEOUT
                    )
                    
                    # Логирование ответа
                    logging.debug(f"📥 Получен ответ: статус {response.status_code}, размер {len(response.content)} байт")
                    
                    # Проверка ответа
                    if response.status_code >= 400:
                        logging.warning(f"⚠️ Сервер вернул статус {response.status_code} для {file_path.name}")
                    
                    response.raise_for_status()
                    
                    # Проверка содержимого ответа
                    if not response.content or len(response.content) < 100:
                        error_msg = "Пустой или слишком маленький ответ от сервера"
                        logging.error(f"❌ {error_msg} для {file_path.name}")
                        raise ValueError(error_msg)
                    
                except Exception as e:
                    error_type = self.handle_error(e, file_path, output_invalid, output_corrupted)
                    
                    # Если это сетевая ошибка и файл не был перемещен, попробуем вернуть его в очередь
                    if error_type in ["connection_error", "timeout_error", "retry_exceeded", "network_error"]:
                        logging.info(f"🔄 Файл {file_path.name} останется в исходной директории для повторной обработки")
                    
                    return False
            
            # Сохранение результата
            output_file_name = f"{file_path.stem}.jar"
            output_file_path = output_dir / output_file_name
            
            output_dir.mkdir(parents=True, exist_ok=True)
            
            with open(output_file_path, 'wb') as output_file:
                output_file.write(response.content)
            
            # Проверка сохраненного файла
            if not output_file_path.exists() or output_file_path.stat().st_size < 100:
                error_msg = "Ошибка при сохранении переведенного файла"
                logging.error(f"❌ {error_msg} для {file_path.name}")
                if output_file_path.exists():
                    output_file_path.unlink()
                raise Exception(error_msg)
            
            logging.info(f"✅ Успешно сохранен: {output_file_path.name}")
            
            # Удаление оригинального файла
            try:
                file_path.unlink()
                logging.info(f"🗑️ Удален оригинальный файл: {file_path.name}")
            except Exception as e:
                logging.warning(f"⚠️ Не удалось удалить {file_path.name}: {e}")
                # Пытаемся переместить в backup если не удалось удалить
                backup_dir = output_dir / "original_backups"
                self.move_file(file_path, backup_dir)
            
            # Обновление статистики по провайдеру
            ai_provider = params.get('aiProvider', 'openrouter')
            with self.lock:
                self.stats['success'] += 1
                if ai_provider in self.stats['ai_provider']:
                    self.stats['ai_provider'][ai_provider] += 1
            
            return True
            
        except Exception as e:
            logging.error(f"❌ Критическая ошибка при обработке {file_path.name}: {e}", exc_info=True)
            with self.lock:
                self.stats['failed'] += 1
            return False
    
    def process_files(self, file_paths: List[Path], output_dir: Path,
                     output_invalid: Path, output_corrupted: Path,
                     params: Dict[str, Union[str, int]], 
                     max_threads: int = DEFAULT_THREADS,
                     dry_run: bool = False,
                     skip_health_check: bool = False) -> None:
        """
        Многопоточная обработка файлов
        
        Args:
            file_paths: Список путей к файлам
            output_dir: Директория для результатов
            output_invalid: Директория для невалидных файлов
            output_corrupted: Директория для поврежденных файлов
            params: Параметры обработки
            max_threads: Максимальное количество потоков
            dry_run: Режим тестирования без реальной обработки
            skip_health_check: Пропустить проверку доступности сервера
        """
        if not file_paths:
            logging.warning("📁 JAR файлы не найдены")
            return
        
        # Проверка доступности сервера
        if not dry_run:
            self.server_available = self.validate_server_connection(skip_health_check)
            if not self.server_available:
                logging.error("❌ Сервер недоступен. Обработка файлов прервана.")
                return
        
        if dry_run:
            logging.info("🔍 РЕЖИМ ТЕСТИРОВАНИЯ (dry-run) - реальная обработка отключена")
            logging.info(f"⚙️ Параметры обработки (тестовый режим): {params}")
            for file_path in file_paths:
                logging.info(f"📋 Найден файл для обработки: {file_path.name}")
            return
        
        logging.info(f"🎯 Начало обработки {len(file_paths)} файлов...")
        logging.info(f"⚙️ Параметры обработки: {params}")
        
        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            futures = []
            
            for file_path in file_paths:
                future = executor.submit(
                    self.process_single_file,
                    file_path, output_dir, output_invalid, output_corrupted, params
                )
                futures.append((future, file_path.name))
            
            # Отображение прогресса
            try:
                from tqdm import tqdm
                progress_bar = tqdm(total=len(futures), desc="Обработка файлов", unit="file")
                
                for future, filename in futures:
                    try:
                        future.result()
                    except Exception as e:
                        logging.error(f"❌ Ошибка при обработке {filename}: {e}", exc_info=True)
                    finally:
                        progress_bar.update(1)
                
                progress_bar.close()
            except ImportError:
                logging.warning("📦 tqdm не установлен. Установите для отображения прогресс-бара: pip install tqdm")
                for future, _ in futures:
                    try:
                        future.result()
                    except Exception as e:
                        logging.error(f"❌ Ошибка при обработке файла: {e}", exc_info=True)
        
        # Вывод статистики
        self.print_statistics()
    
    def print_statistics(self) -> None:
        """Вывод статистики обработки"""
        total_processed = (
            self.stats['success'] + 
            self.stats['failed'] + 
            self.stats['invalid'] + 
            self.stats['corrupted'] + 
            self.stats['skipped']
        )
        
        if total_processed == 0:
            return
        
        success_rate = (self.stats['success'] / total_processed * 100) if total_processed > 0 else 0
        
        logging.info("\n" + "="*60)
        logging.info("📊 СТАТИСТИКА ОБРАБОТКИ")
        logging.info("="*60)
        logging.info(f"✅ Успешно:                  {self.stats['success']}")
        logging.info(f"❌ Ошибки:                   {self.stats['failed']}")
        logging.info(f"🧩 Невалидные:               {self.stats['invalid']}")
        logging.info(f"🔧 Поврежденные:             {self.stats['corrupted']}")
        logging.info(f"⏭️ Пропущено:                {self.stats['skipped']}")
        logging.info(f"🌐 Сетевые ошибки:           {self.stats['connection_errors']}")
        logging.info(f"🔥 Серверные ошибки:         {self.stats['server_errors']}")
        logging.info(f"📈 Всего обработано:         {total_processed}")
        logging.info(f"🎯 Процент успеха:           {success_rate:.1f}%")
        logging.info("\n🤖 Статистика по AI провайдерам:")
        logging.info(f"   • OpenRouter: {self.stats['ai_provider']['openrouter']}")
        logging.info(f"   • Ollama:     {self.stats['ai_provider']['ollama']}")
        logging.info("="*60)

def find_jar_files(directory: Path, recursive: bool = False) -> List[Path]:
    """Поиск JAR файлов в директории"""
    jar_files = []
    
    if recursive:
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith('.jar'):
                    jar_files.append(Path(root) / file)
    else:
        for item in directory.iterdir():
            if item.is_file() and item.name.endswith('.jar'):
                jar_files.append(item)
    
    return jar_files

def setup_logging(log_file: Optional[Path] = None, verbose: bool = False) -> None:
    """Настройка логирования"""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    log_level = logging.DEBUG if verbose else logging.INFO
    
    handlers = [logging.StreamHandler()]
    
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding='utf-8'))
    
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=handlers,
        force=True
    )
    
    # Отключаем логирование urllib3 для уменьшения шума
    logging.getLogger("urllib3").setLevel(logging.WARNING)

def parse_arguments() -> argparse.Namespace:
    """Парсинг аргументов командной строки"""
    parser = argparse.ArgumentParser(
        description='Minecraft Mod Translator Client',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Параметры перевода
    parser.add_argument('--fb', type=str, default='yes', choices=['yes', 'no'], 
                        help='Использовать резервный переводчик при ошибках')
    parser.add_argument('--cl', type=int, default=3, 
                        help='Максимальное количество попыток перевода на ключ')
    parser.add_argument('--m', type=str, default='bing', choices=['google', 'google2', 'bing'], 
                        help='Основной метод перевода')
    parser.add_argument('--f', type=str, default='en', choices=SUPPORTED_LANGUAGES, 
                        help='Исходный язык')
    parser.add_argument('--t', type=str, default='ru', choices=SUPPORTED_LANGUAGES, 
                        help='Целевой язык')
    
    # AI параметры
    parser.add_argument('--ai-provider', type=str, default='openrouter', 
                        choices=AI_PROVIDERS,
                        help='AI провайдер для перевода: openrouter (облачные модели) или ollama (локальные модели)')
    
    # Пути и директории
    parser.add_argument('--input_dir', type=str, default='.', 
                        help='Директория для поиска JAR файлов')
    parser.add_argument('--output_dir', type=str, default='1', 
                        help='Директория для переведенных файлов')
    parser.add_argument('--output_invalid', type=str, default='2', 
                        help='Директория для невалидных файлов')
    parser.add_argument('--output_corrupted', type=str, default='3', 
                        help='Директория для поврежденных файлов')
    
    # Настройки обработки
    parser.add_argument('--threads', type=int, default=DEFAULT_THREADS,
                        help='Количество потоков для обработки')
    parser.add_argument('--recursive', action='store_true',
                        help='Рекурсивный поиск JAR файлов')
    parser.add_argument('--skip_existing', action='store_true',
                        help='Пропускать файлы, которые уже существуют в output_dir')
    parser.add_argument('--dry_run', action='store_true',
                        help='Тестовый режим без реальной обработки файлов')
    parser.add_argument('--skip_health_check', action='store_true',
                        help='Пропустить проверку доступности сервера через /health')
    
    # Логирование
    parser.add_argument('--log_file', type=str, default='translator.log',
                        help='Файл для записи логов')
    parser.add_argument('--verbose', action='store_true',
                        help='Детальное логирование (DEBUG уровень)')
    
    # Сервер
    parser.add_argument('--server_url', type=str, default='http://mehhost.ru:8250/process',
                        help='URL API сервера')
    
    return parser.parse_args()

def main() -> None:
    """Основная функция"""
    args = parse_arguments()
    
    # Настройка путей
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_invalid = Path(args.output_invalid).resolve()
    output_corrupted = Path(args.output_corrupted).resolve()
    log_file = Path(args.log_file).resolve() if args.log_file else None
    
    # Настройка логирования
    setup_logging(log_file, args.verbose)
    
    logging.info("="*60)
    logging.info("🚀 ЗАПУСК MINECRAFT MOD TRANSLATOR CLIENT")
    logging.info("="*60)
    logging.info(f"📁 Рабочая директория: {input_dir}")
    logging.info(f"🔗 URL сервера: {args.server_url}")
    logging.info(f"🤖 Выбранный AI провайдер: {args.ai_provider}")
    logging.info(f"🧵 Количество потоков: {args.threads}")
    logging.info(f"🔄 Рекурсивный поиск: {'Да' if args.recursive else 'Нет'}")
    logging.info(f"🏥 Проверка здоровья сервера: {'Пропущена' if args.skip_health_check else 'Включена'}")
    
    # Проверка существования входной директории
    if not input_dir.exists():
        logging.error(f"❌ Директория не существует: {input_dir}")
        sys.exit(1)
    
    # Поиск JAR файлов
    jar_files = find_jar_files(input_dir, args.recursive)
    logging.info(f"🔍 Найдено JAR файлов: {len(jar_files)}")
    
    if args.skip_existing and jar_files:
        existing_files = []
        for file_path in jar_files[:]:
            output_file = output_dir / f"{file_path.stem}.jar"
            if output_file.exists():
                logging.info(f"⏭️ Пропуск существующего файла: {file_path.name}")
                existing_files.append(file_path)
                jar_files.remove(file_path)
        
        logging.info(f"⏭️ Пропущено файлов: {len(existing_files)}")
    
    if not jar_files:
        logging.warning("⚠️ Нет файлов для обработки")
        return
    
    # Параметры обработки
    params = {
        'fb': args.fb,
        'cl': args.cl,
        'm': args.m,
        'f': args.f,
        't': args.t,
        'aiProvider': args.ai_provider 
    }
    
    # Создание клиента и обработка файлов
    start_time = time.time()
    client = TranslationClient(args.server_url)
    client.process_files(
        jar_files,
        output_dir,
        output_invalid,
        output_corrupted,
        params,
        max_threads=args.threads,
        dry_run=args.dry_run,
        skip_health_check=args.skip_health_check
    )
    end_time = time.time()
    
    # Время выполнения
    duration = end_time - start_time
    logging.info(f"⏱️ Время выполнения: {duration:.2f} секунд ({duration/60:.2f} минут)")
    
    logging.info("="*60)
    logging.info("✅ ОБРАБОТКА ЗАВЕРШЕНА")
    logging.info("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logging.info("\n🛑 Обработка прервана пользователем")
        sys.exit(1)
    except Exception as e:
        logging.critical(f"🔥 Критическая ошибка: {e}", exc_info=True)
        sys.exit(1)