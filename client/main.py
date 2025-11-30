"""
Minecraft Mod Translator Client - Главный файл запуска
Поддерживает как CLI, так и GUI режимы работы
"""

import argparse
import sys
import logging
from pathlib import Path


def setup_logging(log_file: str = 'translator.log', verbose: bool = False) -> None:
    """Настройка логирования"""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    log_level = logging.DEBUG if verbose else logging.INFO
    
    handlers = [logging.StreamHandler()]
    
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding='utf-8'))
    
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=handlers,
        force=True
    )
    
    # Отключаем логирование urllib3 для уменьшения шума
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def parse_arguments():
    """Парсинг аргументов командной строки"""
    parser = argparse.ArgumentParser(
        description='Minecraft Mod Translator Client',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Режим работы
    parser.add_argument('--gui', action='store_true', help='Запустить графический интерфейс')
    
    # Параметры перевода
    parser.add_argument('--fb', type=str, default='yes', choices=['yes', 'no'], 
                        help='Использовать резервный переводчик при ошибках')
    parser.add_argument('--cl', type=int, default=3, 
                        help='Максимальное количество попыток перевода на ключ')
    parser.add_argument('--m', type=str, default='bing', choices=['google', 'google2', 'bing'], 
                        help='Основной метод перевода')
    parser.add_argument('--f', type=str, default='en', choices=['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'ny', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'tl', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'iw', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jw', 'kn', 'kk', 'km', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tg', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'], 
                        help='Исходный язык')
    parser.add_argument('--t', type=str, default='ru', choices=['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'ny', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'tl', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'iw', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jw', 'kn', 'kk', 'km', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tg', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'], 
                        help='Целевой язык')
    
    # AI параметры
    parser.add_argument('--ai-provider', type=str, default='openrouter', 
                        choices=['openrouter', 'ollama'],
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
    parser.add_argument('--threads', type=int, default=3,
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
    parser.add_argument('--server_url', type=str, default='http://localhost:8250',
                        help='URL API сервера')
    
    return parser.parse_args()


def run_cli(args):
    """Запуск CLI режима"""
    try:
        from translator_client import TranslationClient, find_jar_files, SUPPORTED_LANGUAGES, AI_PROVIDERS
    except ImportError as e:
        # Add the current directory to the path to ensure modules can be found
        import sys
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        from translator_client import TranslationClient, find_jar_files, SUPPORTED_LANGUAGES, AI_PROVIDERS
    
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
        for file_path in jar_files[:]:  # Создаем копию списка для итерации
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
    import time
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


def run_gui():
    """Запуск GUI режима"""
    try:
        from gui.translator_gui import main as gui_main
    except ImportError as e:
        # Add the current directory to the path to ensure modules can be found
        import sys
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        from gui.translator_gui import main as gui_main
    gui_main()


def main():
    """Основная функция"""
    args = parse_arguments()
    
    if args.gui:
        run_gui()
    else:
        run_cli(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logging.info("\n🛑 Обработка прервана пользователем")
        sys.exit(1)
    except Exception as e:
        logging.critical(f"🔥 Критическая ошибка: {e}", exc_info=True)
        sys.exit(1)