// В любом файле приложения
import { config, ensureDirectories } from '../config';

// Использование конфигурации
console.log(`Server port: ${config.server.port}`);
console.log(`Upload directory: ${config.paths.uploadDir}`);

// Инициализация директорий
ensureDirectories();