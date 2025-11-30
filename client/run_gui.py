#!/usr/bin/env python3
"""
Скрипт для запуска GUI Minecraft Mod Translator
"""

import sys
import os
from pathlib import Path

# Добавляем путь к клиенту в sys.path
client_path = Path(__file__).parent
sys.path.insert(0, str(client_path))

def main():
    try:
        from gui.translator_gui import main as gui_main
        gui_main()
    except ImportError as e:
        print(f"Ошибка импорта: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Ошибка запуска GUI: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()