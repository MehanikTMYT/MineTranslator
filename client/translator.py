"""
Minecraft Mod Translator Client
Переводит JAR-файлы модов Minecraft через API сервера

Поддерживаемые функции:
- Многопоточная обработка файлов
- Автоматические повторные попытки при ошибках
- Прогресс-бар и детальное логирование
- Гибкая настройка параметров обработки
- Валидация файлов перед отправкой
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

# Константы
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
DEFAULT_THREADS = 3
REQUEST_TIMEOUT = 300  # 5 минут
MAX_RETRIES = 3
BACKOFF_FACTOR = 0.5

class TranslationClient:
    """Клиент для перевода JAR-файлов через API сервера"""
    
    def __init__(self, base_url: str = "http://mehhost.ru:8150/process"):
        self.base_url = base_url
        self.session = self._create_session()
        self.stats = {
            'success': 0,
            'failed': 0,
            'invalid': 0,
            'corrupted': 0,
            'skipped': 0
        }
        self.lock = threading.Lock()
    
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
    
    def validate_jar_file(self, file_path: Path) -> Tuple[bool, str]:
        """
        Валидация JAR файла перед отправкой
        
        Returns:
            Tuple[bool, str]: (валиден, сообщение об ошибке)
        """
        if not file_path.exists():
            return False, f"Файл не существует: {file_path}"
        
        if file_path.stat().st_size == 0:
            return False, f"Файл пустой: {file_path}"
        
        if file_path.stat().st_size > MAX_FILE_SIZE:
            return False, f"Файл слишком большой (> {MAX_FILE_SIZE/1024/1024}MB): {file_path}"
        
        if not file_path.name.endswith('.jar'):
            return False, f"Неверное расширение файла (требуется .jar): {file_path}"
        
        return True, ""
    
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
            
            if target_path.exists():
                target_path.unlink()
            
            shutil.move(str(source_path), str(target_path))
            return True
        except Exception as e:
            logging.error(f"❌ Ошибка при перемещении файла {source_path}: {e}")
            return False
    
    def handle_error(self, exception: Exception, file_path: Path, 
                    output_invalid: Path, output_corrupted: Path) -> None:
        """Обработка ошибок при запросе к API"""
        error_message = str(exception)
        error_type = "unknown"
        
        if isinstance(exception, requests.exceptions.RequestException) and hasattr(exception, 'response'):
            try:
                response_data = exception.response.json()
                error_message = response_data.get("error", str(exception))
            except:
                error_message = exception.response.text or str(exception)
        
        # Анализ типа ошибки
        error_lower = error_message.lower()
        
        if any(keyword in error_lower for keyword in ["поврежд", "corrupted", "invalid zip", "not a zip"]):
            error_type = "corrupted"
            self.move_file(file_path, output_corrupted)
            logging.error(f"🔧 Файл поврежден: {file_path.name} - {error_message}")
        
        elif any(keyword in error_lower for keyword in ["отсутствует папка", "no folder", "missing folder", "assets", "lang"]):
            error_type = "invalid"
            self.move_file(file_path, output_invalid)
            logging.error(f"🧩 Неверная структура мода: {file_path.name} - {error_message}")
        
        else:
            error_type = "api_error"
            logging.error(f"⚡ Ошибка API: {file_path.name} - {error_message}")
        
        with self.lock:
            if error_type == "corrupted":
                self.stats['corrupted'] += 1
            elif error_type == "invalid":
                self.stats['invalid'] += 1
            else:
                self.stats['failed'] += 1
    
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
            
            # Чтение файла
            with open(file_path, 'rb') as jar_file:
                files = {'jarFile': (file_path.name, jar_file, 'application/java-archive')}
                
                try:
                    response = self.session.post(
                        self.base_url,
                        files=files,
                        data=params,
                        timeout=REQUEST_TIMEOUT
                    )
                    response.raise_for_status()
                    
                except requests.exceptions.RequestException as e:
                    self.handle_error(e, file_path, output_invalid, output_corrupted)
                    return False
            
            # Сохранение результата
            output_file_name = f"{file_path.stem}_translated.jar"
            output_file_path = output_dir / output_file_name
            
            output_dir.mkdir(parents=True, exist_ok=True)
            
            with open(output_file_path, 'wb') as output_file:
                output_file.write(response.content)
            
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
            
            with self.lock:
                self.stats['success'] += 1
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
                     dry_run: bool = False) -> None:
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
        """
        if not file_paths:
            logging.warning("📁 JAR файлы не найдены")
            return
        
        if dry_run:
            logging.info("🔍 РЕЖИМ ТЕСТИРОВАНИЯ (dry-run) - реальная обработка отключена")
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
                        logging.error(f"❌ Ошибка при обработке {filename}: {e}")
                    finally:
                        progress_bar.update(1)
                
                progress_bar.close()
            except ImportError:
                logging.warning("📦 tqdm не установлен. Установите для отображения прогресс-бара: pip install tqdm")
                for future, _ in futures:
                    future.result()
        
        # Вывод статистики
        self.print_statistics()
    
    def print_statistics(self) -> None:
        """Вывод статистики обработки"""
        total = sum(self.stats.values())
        if total == 0:
            return
        
        success_rate = (self.stats['success'] / total * 100) if total > 0 else 0
        
        logging.info("\n" + "="*50)
        logging.info("📊 СТАТИСТИКА ОБРАБОТКИ")
        logging.info("="*50)
        logging.info(f"✅ Успешно:       {self.stats['success']}")
        logging.info(f"❌ Ошибки:        {self.stats['failed']}")
        logging.info(f"🧩 Невалидные:    {self.stats['invalid']}")
        logging.info(f"🔧 Поврежденные:  {self.stats['corrupted']}")
        logging.info(f"⏭️ Пропущено:     {self.stats['skipped']}")
        logging.info(f"📈 Всего:         {total}")
        logging.info(f"🎯 Процент успеха: {success_rate:.1f}%")
        logging.info("="*50)

def find_jar_files(directory: Path, recursive: bool = False) -> List[Path]:
    """Поиск JAR файлов в директории"""
    jar_files = []
    
    if recursive:
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith('.jar'):
                    jar_files.append(Path(root) / file)
    else:
        for file in directory.iterdir():
            if file.is_file() and file.name.endswith('.jar'):
                jar_files.append(file)
    
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
    
    # Логирование
    parser.add_argument('--log_file', type=str, default='translator.log',
                        help='Файл для записи логов')
    parser.add_argument('--verbose', action='store_true',
                        help='Детальное логирование (DEBUG уровень)')
    
    # Сервер
    parser.add_argument('--server_url', type=str, default='http://mehhost.ru:8150/process',
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
            output_file = output_dir / f"{file_path.stem}_translated.jar"
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
    }
    
    # Создание клиента и обработка файлов
    client = TranslationClient(args.server_url)
    client.process_files(
        jar_files,
        output_dir,
        output_invalid,
        output_corrupted,
        params,
        max_threads=args.threads,
        dry_run=args.dry_run
    )
    
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