"""
GUI интерфейс для Minecraft Mod Translator Client
"""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import logging
import sys
import queue
import time
from pathlib import Path
from typing import Dict, Any
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from translator_client import TranslationClient, find_jar_files, SUPPORTED_LANGUAGES, AI_PROVIDERS

class TranslatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Minecraft Mod Translator")
        self.root.geometry("800x700")
        
        # Очередь для коммуникации между потоками
        self.queue = queue.Queue()
        
        # Переменные для хранения параметров
        self.input_dir = tk.StringVar(value=".")
        self.output_dir = tk.StringVar(value="translated")
        self.invalid_dir = tk.StringVar(value="invalid")
        self.corrupted_dir = tk.StringVar(value="corrupted")
        self.server_url = tk.StringVar(value="http://localhost:8250")
        self.ai_provider = tk.StringVar(value="openrouter")
        self.source_lang = tk.StringVar(value="en")
        self.target_lang = tk.StringVar(value="ru")
        self.backup = tk.StringVar(value="yes")
        self.max_retries = tk.IntVar(value=3)
        self.method = tk.StringVar(value="bing")
        self.threads = tk.IntVar(value=3)
        self.recursive = tk.BooleanVar(value=False)
        self.dry_run = tk.BooleanVar(value=False)
        self.skip_health_check = tk.BooleanVar(value=False)
        
        # Состояния
        self.processing = False
        self.stop_requested = False
        self.client = None
        
        self.setup_ui()
        self.setup_logging()
        self.start_queue_processing()

    def setup_ui(self):
        """Настройка пользовательского интерфейса"""
        # Основной фрейм
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Настройка веса для растяжения
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # Заголовок
        title_label = ttk.Label(main_frame, text="Minecraft Mod Translator", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # Параметры ввода
        row = 1
        
        # Директория ввода
        ttk.Label(main_frame, text="Директория с JAR файлами:").grid(row=row, column=0, sticky=tk.W, pady=2)
        input_frame = ttk.Frame(main_frame)
        input_frame.grid(row=row, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=2)
        input_frame.columnconfigure(0, weight=1)
        ttk.Entry(input_frame, textvariable=self.input_dir).grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        ttk.Button(input_frame, text="Обзор", command=self.browse_input).grid(row=0, column=1)
        row += 1
        
        # Директория вывода
        ttk.Label(main_frame, text="Директория для переведенных:").grid(row=row, column=0, sticky=tk.W, pady=2)
        output_frame = ttk.Frame(main_frame)
        output_frame.grid(row=row, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=2)
        output_frame.columnconfigure(0, weight=1)
        ttk.Entry(output_frame, textvariable=self.output_dir).grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        ttk.Button(output_frame, text="Обзор", command=self.browse_output).grid(row=0, column=1)
        row += 1
        
        # Директория невалидных файлов
        ttk.Label(main_frame, text="Директория для невалидных:").grid(row=row, column=0, sticky=tk.W, pady=2)
        invalid_frame = ttk.Frame(main_frame)
        invalid_frame.grid(row=row, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=2)
        invalid_frame.columnconfigure(0, weight=1)
        ttk.Entry(invalid_frame, textvariable=self.invalid_dir).grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        ttk.Button(invalid_frame, text="Обзор", command=self.browse_invalid).grid(row=0, column=1)
        row += 1
        
        # Директория поврежденных файлов
        ttk.Label(main_frame, text="Директория для поврежденных:").grid(row=row, column=0, sticky=tk.W, pady=2)
        corrupted_frame = ttk.Frame(main_frame)
        corrupted_frame.grid(row=row, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=2)
        corrupted_frame.columnconfigure(0, weight=1)
        ttk.Entry(corrupted_frame, textvariable=self.corrupted_dir).grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 5))
        ttk.Button(corrupted_frame, text="Обзор", command=self.browse_corrupted).grid(row=0, column=1)
        row += 1
        
        # URL сервера
        ttk.Label(main_frame, text="URL сервера:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Entry(main_frame, textvariable=self.server_url, width=50).grid(row=row, column=1, columnspan=2, sticky=(tk.W, tk.E), pady=2)
        row += 1
        
        # AI провайдер
        ttk.Label(main_frame, text="AI провайдер:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ai_provider_combo = ttk.Combobox(main_frame, textvariable=self.ai_provider, values=AI_PROVIDERS, state="readonly")
        ai_provider_combo.grid(row=row, column=1, sticky=(tk.W, tk.E), pady=2)
        row += 1
        
        # Языки
        ttk.Label(main_frame, text="Исходный язык:").grid(row=row, column=0, sticky=tk.W, pady=2)
        source_lang_combo = ttk.Combobox(main_frame, textvariable=self.source_lang, values=SUPPORTED_LANGUAGES, state="readonly", width=10)
        source_lang_combo.grid(row=row, column=1, sticky=tk.W, pady=2)
        ttk.Label(main_frame, text="Целевой язык:").grid(row=row, column=2, sticky=tk.W, pady=2, padx=(10, 0))
        target_lang_combo = ttk.Combobox(main_frame, textvariable=self.target_lang, values=SUPPORTED_LANGUAGES, state="readonly", width=10)
        target_lang_combo.grid(row=row, column=2, sticky=tk.W, pady=2)
        row += 1
        
        # Метод перевода
        ttk.Label(main_frame, text="Метод перевода:").grid(row=row, column=0, sticky=tk.W, pady=2)
        method_combo = ttk.Combobox(main_frame, textvariable=self.method, values=['google', 'google2', 'bing'], state="readonly")
        method_combo.grid(row=row, column=1, sticky=(tk.W, tk.E), pady=2)
        row += 1
        
        # Параметры обработки
        ttk.Label(main_frame, text="Параметры обработки:").grid(row=row, column=0, sticky=tk.W, pady=(10, 2))
        row += 1
        
        # Использовать резервный переводчик
        ttk.Label(main_frame, text="Резервный переводчик:").grid(row=row, column=0, sticky=tk.W, pady=2)
        backup_combo = ttk.Combobox(main_frame, textvariable=self.backup, values=['yes', 'no'], state="readonly", width=10)
        backup_combo.grid(row=row, column=1, sticky=tk.W, pady=2)
        row += 1
        
        # Максимальное количество попыток
        ttk.Label(main_frame, text="Макс. попыток:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Spinbox(main_frame, from_=1, to=10, textvariable=self.max_retries, width=10).grid(row=row, column=1, sticky=tk.W, pady=2)
        row += 1
        
        # Количество потоков
        ttk.Label(main_frame, text="Количество потоков:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Spinbox(main_frame, from_=1, to=20, textvariable=self.threads, width=10).grid(row=row, column=1, sticky=tk.W, pady=2)
        row += 1
        
        # Флажки опций
        options_frame = ttk.LabelFrame(main_frame, text="Дополнительные опции", padding="5")
        options_frame.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 5))
        options_frame.columnconfigure(0, weight=1)
        ttk.Checkbutton(options_frame, text="Рекурсивный поиск", variable=self.recursive).grid(row=0, column=0, sticky=tk.W)
        ttk.Checkbutton(options_frame, text="Тестовый режим (dry-run)", variable=self.dry_run).grid(row=0, column=1, sticky=tk.W)
        ttk.Checkbutton(options_frame, text="Пропустить проверку сервера", variable=self.skip_health_check).grid(row=0, column=2, sticky=tk.W)
        row += 1
        
        # Кнопки управления
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=row, column=0, columnspan=3, pady=20)
        self.start_button = ttk.Button(button_frame, text="Начать перевод", command=self.start_translation)
        self.start_button.grid(row=0, column=0, padx=5)
        self.stop_button = ttk.Button(button_frame, text="Остановить", command=self.stop_translation, state=tk.DISABLED)
        self.stop_button.grid(row=0, column=1, padx=5)
        self.clear_button = ttk.Button(button_frame, text="Очистить лог", command=self.clear_log)
        self.clear_button.grid(row=0, column=2, padx=5)
        row += 1
        
        # Прогресс бар и метка статуса
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        self.status_label = ttk.Label(status_frame, text="Готов к работе", width=40)
        self.status_label.grid(row=0, column=0, sticky=tk.W, padx=(0, 10))
        
        self.file_count_label = ttk.Label(status_frame, text="Файлов: 0/0")
        self.file_count_label.grid(row=0, column=1, sticky=tk.E)
        
        row += 1
        
        # Прогресс бар
        self.progress = ttk.Progressbar(main_frame, mode='determinate')
        self.progress.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        row += 1
        
        # Лог
        ttk.Label(main_frame, text="Лог:").grid(row=row, column=0, sticky=tk.W, pady=(10, 0))
        row += 1
        
        # Текстовое поле с логами
        self.log_text = scrolledtext.ScrolledText(main_frame, height=15, state=tk.DISABLED)
        self.log_text.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # Контекстное меню для лога
        self.create_context_menu()
        
        # Настройка веса для растяжения лога
        main_frame.rowconfigure(row, weight=1)
        
        # Обработка закрытия окна
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def create_context_menu(self):
        """Создание контекстного меню для лога"""
        self.context_menu = tk.Menu(self.log_text, tearoff=0)
        self.context_menu.add_command(label="Копировать", command=self.copy_log)
        self.context_menu.add_command(label="Выделить все", command=self.select_all_log)
        self.context_menu.add_separator()
        self.context_menu.add_command(label="Очистить", command=self.clear_log)
        
        self.log_text.bind("<Button-3>", self.show_context_menu)
        if sys.platform.startswith('darwin'):  # macOS
            self.log_text.bind("<Button-2>", self.show_context_menu)

    def show_context_menu(self, event):
        """Показ контекстного меню"""
        self.context_menu.tk_popup(event.x_root, event.y_root)

    def copy_log(self):
        """Копирование выделенного текста из лога"""
        try:
            selected_text = self.log_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            self.root.clipboard_clear()
            self.root.clipboard_append(selected_text)
        except tk.TclError:
            pass  # Нет выделенного текста

    def select_all_log(self):
        """Выделение всего текста в логе"""
        self.log_text.tag_add(tk.SEL, "1.0", tk.END)

    def setup_logging(self):
        """Настройка логирования для GUI"""
        class GuiHandler(logging.Handler):
            def __init__(self, queue):
                super().__init__()
                self.queue = queue
                
            def emit(self, record):
                msg = self.format(record)
                self.queue.put(('log', msg))
        
        # Очистка существующих обработчиков
        for handler in logging.root.handlers[:]:
            logging.root.removeHandler(handler)
        
        # Настройка логирования
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                GuiHandler(self.queue)
            ]
        )

    def start_queue_processing(self):
        """Запуск обработки очереди для обновления GUI"""
        def process_queue():
            try:
                while True:
                    message = self.queue.get_nowait()
                    msg_type, data = message
                    
                    if msg_type == 'log':
                        self.log_text.config(state=tk.NORMAL)
                        self.log_text.insert(tk.END, data + '\n')
                        self.log_text.see(tk.END)
                        self.log_text.config(state=tk.DISABLED)
                    
                    elif msg_type == 'progress':
                        current, total, file_name = data
                        if total > 0:
                            progress_value = (current / total) * 100
                            self.progress['value'] = progress_value
                            self.status_label['text'] = f"Обработка: {file_name}"
                            self.file_count_label['text'] = f"Файлов: {current}/{total}"
                    
                    elif msg_type == 'status':
                        self.status_label['text'] = data
                    
                    elif msg_type == 'complete':
                        success_count, total_count = data
                        self.status_label['text'] = f"Завершено: {success_count}/{total_count}"
                        self.show_completion_message(success_count, total_count)
                    
                    elif msg_type == 'error':
                        messagebox.showerror("Ошибка", data)
                    
                    self.queue.task_done()
            except queue.Empty:
                pass
            finally:
                self.root.after(100, process_queue)
        
        self.root.after(100, process_queue)

    def browse_input(self):
        """Выбор директории ввода"""
        directory = filedialog.askdirectory(initialdir=self.input_dir.get())
        if directory:
            self.input_dir.set(directory)

    def browse_output(self):
        """Выбор директории вывода"""
        directory = filedialog.askdirectory(initialdir=self.output_dir.get())
        if directory:
            self.output_dir.set(directory)

    def browse_invalid(self):
        """Выбор директории для невалидных файлов"""
        directory = filedialog.askdirectory(initialdir=self.invalid_dir.get())
        if directory:
            self.invalid_dir.set(directory)

    def browse_corrupted(self):
        """Выбор директории для поврежденных файлов"""
        directory = filedialog.askdirectory(initialdir=self.corrupted_dir.get())
        if directory:
            self.corrupted_dir.set(directory)

    def start_translation(self):
        """Запуск процесса перевода в отдельном потоке"""
        if self.processing:
            return
        
        # Валидация путей
        if not self.validate_paths():
            return
        
        self.processing = True
        self.stop_requested = False
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        
        # Сброс прогресса
        self.progress['value'] = 0
        self.status_label['text'] = "Начало обработки..."
        self.file_count_label['text'] = "Файлов: 0/0"
        
        # Запуск в отдельном потоке
        thread = threading.Thread(target=self._run_translation)
        thread.daemon = True
        thread.start()

    def validate_paths(self):
        """Валидация путей перед обработкой"""
        paths_to_check = [
            (self.input_dir.get(), "Директория ввода"),
            (self.output_dir.get(), "Директория вывода"),
            (self.invalid_dir.get(), "Директория невалидных файлов"),
            (self.corrupted_dir.get(), "Директория поврежденных файлов")
        ]
        
        for path, name in paths_to_check:
            if not path or path.strip() == "":
                messagebox.showerror("Ошибка", f"Не указана {name.lower()}")
                return False
        
        return True

    def stop_translation(self):
        """Остановка процесса перевода"""
        if self.processing:
            self.stop_requested = True
            self.status_label['text'] = "Остановка обработки..."
            logging.info("🛑 Запрошена остановка обработки")
            # Не блокируем UI, продолжаем обработку в фоне
            self.stop_button.config(state=tk.DISABLED)

    def _run_translation(self):
        """Внутренний метод запуска процесса перевода"""
        try:
            # Получение параметров
            params = {
                'fb': self.backup.get(),
                'cl': self.max_retries.get(),
                'm': self.method.get(),
                'f': self.source_lang.get(),
                't': self.target_lang.get(),
                'aiProvider': self.ai_provider.get()
            }
            
            # Пути
            input_path = Path(self.input_dir.get())
            output_path = Path(self.output_dir.get())
            invalid_path = Path(self.invalid_dir.get())
            corrupted_path = Path(self.corrupted_dir.get())
            
            # Поиск JAR файлов
            jar_files = find_jar_files(input_path, self.recursive.get())
            if not jar_files:
                self.queue.put(('error', "JAR файлы не найдены в указанной директории!"))
                return
            
            total_files = len(jar_files)
            logging.info(f"🔍 Найдено JAR файлов: {total_files}")
            
            # Создание клиента
            self.client = TranslationClient(self.server_url.get())
            
            # Обработка файлов с обновлением прогресса
            success_count = 0
            for i, jar_file in enumerate(jar_files, 1):
                if self.stop_requested:
                    logging.info("🛑 Обработка остановлена пользователем")
                    break
                
                # Обновление прогресса
                self.queue.put(('progress', (i, total_files, jar_file.name)))
                
                try:
                    result = self.client.process_single_file(
                        jar_file,
                        output_path,
                        invalid_path,
                        corrupted_path,
                        params
                    )
                    if result:
                        success_count += 1
                except Exception as e:
                    logging.error(f"❌ Ошибка при обработке {jar_file.name}: {e}")
                
                # Небольшая задержка для обновления UI
                time.sleep(0.1)
            
            # Завершение обработки
            self.queue.put(('complete', (success_count, total_files)))
            
        except Exception as e:
            logging.error(f"❌ Критическая ошибка при обработке: {e}")
            self.queue.put(('error', f"Произошла критическая ошибка: {e}"))
        finally:
            self.processing = False
            self.queue.put(('status', 'Готов к работе'))
            self.root.after(0, self._update_ui_after_processing)

    def _update_ui_after_processing(self):
        """Обновление UI после завершения обработки"""
        self.start_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)

    def show_completion_message(self, success_count, total_count):
        """Показ сообщения о завершении обработки"""
        message = f"Обработка завершена!\n\nУспешно обработано: {success_count} из {total_count} файлов"
        if success_count < total_count:
            message += f"\n\nНеобработанные файлы: {total_count - success_count}"
        messagebox.showinfo("Успех", message)

    def clear_log(self):
        """Очистка лога"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state=tk.DISABLED)

    def on_closing(self):
        """Обработка закрытия окна"""
        if self.processing:
            if messagebox.askyesno("Подтверждение", "Обработка еще не завершена. Закрыть программу?"):
                self.stop_requested = True
                self.root.destroy()
        else:
            self.root.destroy()

def main():
    root = tk.Tk()
    app = TranslatorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()