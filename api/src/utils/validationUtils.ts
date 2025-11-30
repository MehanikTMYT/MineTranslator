//src/utils/validationUtils.ts
import { config } from '../config/config';
import { TranslationRequest, SupportedLanguage, TranslationMethod, TranslationModule } from './types';
import { ValidationError, UnsupportedLanguageError, FileSizeLimitError, InvalidFileError } from './errorUtils';
import { logger } from './logger';
import path from 'path';
import { statSync } from 'fs';

/**
 * Утилиты для валидации данных в сервисе перевода
 * Предоставляет функции для проверки входных данных, файлов и параметров
 * 
 * Особенности:
 * - Строгая типизация и проверка всех входных данных
 * - Поддержка кастомных сообщений об ошибках
 * - Интеграция с системой логирования
 * - Валидация на основе конфигурации приложения
 * - Поддержка различных сценариев использования
 */

/**
 * Валидация запроса на перевод
 * @param {TranslationRequest} request - запрос на перевод
 * @throws {ValidationError} при невалидных данных
 */
export function validateTranslationRequest(request: TranslationRequest): void {
  if (!request) {
    throw new ValidationError('Translation request is required');
  }

  // Валидация языков
  validateLanguage(request.sourceLang, 'source');
  validateLanguage(request.targetLang, 'target');

  if (request.sourceLang === request.targetLang) {
    throw new ValidationError(`Source and target languages must be different: ${request.sourceLang}`);
  }

  // Валидация ключей и текстов
  if (!Array.isArray(request.keys) || request.keys.length === 0) {
    throw new ValidationError('Keys array is required and must not be empty');
  }

  if (!request.texts || typeof request.texts !== 'object') {
    throw new ValidationError('Texts object is required');
  }

  // Проверка соответствия ключей и текстов
  const missingKeys = request.keys.filter(key => !(key in request.texts));
  if (missingKeys.length > 0) {
    throw new ValidationError(`Missing texts for keys: ${missingKeys.join(', ')}`);
  }

  // Валидация методов перевода
  if (request.methods) {
    validateTranslationMethods(request.methods);
  }

  // Валидация модулей перевода
  if (request.modules) {
    validateTranslationModules(request.modules);
  }

  // Валидация опций fallback
  if (request.fallbackOptions) {
    validateFallbackOptions(request.fallbackOptions);
  }

  // Валидация ограничений
  validateRequestLimits(request);

  logger.debug('Translation request validated successfully', { 
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    keyCount: request.keys.length
  });
}

/**
 * Валидация языкового кода
 * @param {string} langCode - код языка
 * @param {string} langType - тип языка ('source' или 'target')
 * @throws {UnsupportedLanguageError} если язык не поддерживается
 */
export function validateLanguage(langCode: string, langType: 'source' | 'target' = 'source'): void {
  if (!langCode || typeof langCode !== 'string' || langCode.trim() === '') {
    throw new ValidationError(`${langType} language code is required and must be a non-empty string`);
  }

  const normalizedLangCode = langCode.trim().toLowerCase();
  const supportedLanguages = config.translation.supportedLanguages.map(lang => lang.toLowerCase());

  if (!supportedLanguages.includes(normalizedLangCode)) {
    throw new UnsupportedLanguageError(
      `Unsupported ${langType} language: ${langCode}. Supported languages: ${supportedLanguages.join(', ')}`,
      { 
        langCode,
        langType,
        supportedLanguages 
      }
    );
  }
}

/**
 * Валидация методов перевода
 * @param {TranslationMethod[]} methods - массив методов перевода
 * @throws {ValidationError} при невалидных методах
 */
export function validateTranslationMethods(methods: TranslationMethod[]): void {
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new ValidationError('Translation methods must be a non-empty array');
  }

  const supportedMethods = config.translation.methods;
  const invalidMethods = methods.filter(method => !supportedMethods.includes(method));

  if (invalidMethods.length > 0) {
    throw new ValidationError(
      `Unsupported translation methods: ${invalidMethods.join(', ')}. Supported methods: ${supportedMethods.join(', ')}`,
      { invalidMethods, supportedMethods }
    );
  }

  // Проверка дубликатов
  const uniqueMethods = [...new Set(methods)];
  if (uniqueMethods.length !== methods.length) {
    throw new ValidationError('Duplicate translation methods are not allowed', { methods });
  }
}

/**
 * Валидация модулей перевода
 * @param {TranslationModule[]} modules - массив модулей перевода
 * @throws {ValidationError} при невалидных модулях
 */
export function validateTranslationModules(modules: TranslationModule[]): void {
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new ValidationError('Translation modules must be a non-empty array');
  }

  const supportedModules = config.translation.modules;
  const invalidModules = modules.filter(module => !supportedModules.includes(module));

  if (invalidModules.length > 0) {
    throw new ValidationError(
      `Unsupported translation modules: ${invalidModules.join(', ')}. Supported modules: ${supportedModules.join(', ')}`,
      { invalidModules, supportedModules }
    );
  }

  // Проверка дубликатов
  const uniqueModules = [...new Set(modules)];
  if (uniqueModules.length !== modules.length) {
    throw new ValidationError('Duplicate translation modules are not allowed', { modules });
  }
}

/**
 * Валидация опций fallback
 * @param {('yes' | 'no')[]} options - массив опций fallback
 * @throws {ValidationError} при невалидных опциях
 */
export function validateFallbackOptions(options: ('yes' | 'no')[]): void {
  if (!Array.isArray(options) || options.length === 0) {
    throw new ValidationError('Fallback options must be a non-empty array');
  }

  const supportedOptions = config.translation.fallbackOptions;
  const invalidOptions = options.filter(option => !supportedOptions.includes(option));

  if (invalidOptions.length > 0) {
    throw new ValidationError(
      `Unsupported fallback options: ${invalidOptions.join(', ')}. Supported options: ${supportedOptions.join(', ')}`,
      { invalidOptions, supportedOptions }
    );
  }

  // Проверка дубликатов
  const uniqueOptions = [...new Set(options)];
  if (uniqueOptions.length !== options.length) {
    throw new ValidationError('Duplicate fallback options are not allowed', { options });
  }
}

/**
 * Валидация ограничений запроса
 * @param {TranslationRequest} request - запрос на перевод
 * @throws {ValidationError} при превышении ограничений
 */
export function validateRequestLimits(request: TranslationRequest): void {
  // Проверка максимального количества ключей для перевода
  const maxKeys = config.translation.maxLangKeysPerFile;
  if (request.keys.length > maxKeys) {
    throw new ValidationError(
      `Maximum number of keys for translation exceeded: ${request.keys.length} > ${maxKeys}`,
      { 
        actual: request.keys.length,
        max: maxKeys,
        type: 'key_limit' 
      }
    );
  }

  // Проверка размера текстов (опционально)
  const totalTextLength = Object.values(request.texts).reduce((sum, text) => sum + text.length, 0);
  const maxTextLength = 1000000; // 1MB общий лимит текста
  if (totalTextLength > maxTextLength) {
    throw new ValidationError(
      `Total text length exceeded: ${totalTextLength} > ${maxTextLength} characters`,
      { 
        actual: totalTextLength,
        max: maxTextLength,
        type: 'text_length' 
      }
    );
  }

  // Проверка пустых значений (если настроено)
  if (config.translation.skipEmptyValues) {
    const emptyKeys = request.keys.filter(key => !request.texts[key] || request.texts[key].trim() === '');
    if (emptyKeys.length > 0 && emptyKeys.length === request.keys.length) {
      throw new ValidationError('All texts are empty. At least one non-empty text is required', { 
        emptyKeys,
        type: 'empty_texts' 
      });
    }
  }
}

/**
 * Валидация файла JAR
 * @param {Express.Multer.File} file - загруженный файл
 * @throws {InvalidFileError} при невалидном файле
 * @throws {FileSizeLimitError} при превышении размера
 */
export function validateJarFile(file: Express.Multer.File): void {
  if (!file) {
    throw new InvalidFileError('File is required');
  }

  // Валидация расширения
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (fileExtension !== '.jar') {
    throw new InvalidFileError(`Invalid file extension. Only .jar files are allowed. Got: ${fileExtension}`, { 
      originalName: file.originalname,
      extension: fileExtension,
      allowedExtensions: ['.jar']
    });
  }

  // Валидация MIME типа
  const allowedMimeTypes = ['application/java-archive', 'application/x-java-archive', 'application/zip'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    logger.warn('Unexpected MIME type for JAR file', { 
      filename: file.originalname,
      mimetype: file.mimetype,
      allowedMimeTypes 
    });
    // Не выбрасываем ошибку, так как MIME тип может быть некорректно определен
  }

  // Валидация размера файла
  const maxSize = config.limits.maxFileSize;
  if (file.size > maxSize) {
    throw new FileSizeLimitError(
      `File size exceeds limit: ${formatFileSize(file.size)} > ${formatFileSize(maxSize)}`,
      { 
        actualSize: file.size,
        maxSize,
        filename: file.originalname 
      }
    );
  }

  logger.debug('JAR file validated successfully', { 
    filename: file.originalname,
    size: formatFileSize(file.size),
    mimetype: file.mimetype
  });
}

/**
 * Валидация параметров обработки файла
 * @param {Object} params - параметры обработки
 * @throws {ValidationError} при невалидных параметрах
 */
export function validateFileProcessingParams(params: {
  fb?: string;
  cl?: string | number;
  m?: string;
  f?: string;
  t?: string;
  aiProvider?: string;
}): void {
  // Валидация fallback переводчика
  if (params.fb !== undefined) {
    const fbValue = String(params.fb).toLowerCase();
    const supportedFallbackOptions = config.translation.fallbackOptions;
    if (!supportedFallbackOptions.includes(fbValue as any)) {
      throw new ValidationError(
        `Invalid fallback option: ${params.fb}. Supported options: ${supportedFallbackOptions.join(', ')}`,
        { fb: params.fb, supportedFallbackOptions }
      );
    }
  }

  // Валидация максимального числа запросов
  if (params.cl !== undefined) {
    const clValue = Number(params.cl);
    if (isNaN(clValue) || !Number.isInteger(clValue) || clValue <= 0) {
      throw new ValidationError(
        `Invalid concurrent limit: ${params.cl}. Must be a positive integer`,
        { cl: params.cl }
      );
    }
    
    const maxConcurrent = config.limits.maxConcurrentRequests;
    if (clValue > maxConcurrent) {
      throw new ValidationError(
        `Concurrent limit exceeds maximum: ${clValue} > ${maxConcurrent}`,
        { actual: clValue, max: maxConcurrent, type: 'concurrent_limit' }
      );
    }
  }

  // Валидация метода перевода
  if (params.m !== undefined) {
    const methodValue = String(params.m).toLowerCase();
    const supportedModules = config.translation.modules;
    if (!supportedModules.includes(methodValue as any)) {
      throw new ValidationError(
        `Invalid translation module: ${params.m}. Supported modules: ${supportedModules.join(', ')}`,
        { m: params.m, supportedModules }
      );
    }
  }

  // Валидация исходного языка
  if (params.f !== undefined) {
    validateLanguage(String(params.f), 'source');
  }

  // Валидация целевого языка
  if (params.t !== undefined) {
    validateLanguage(String(params.t), 'target');
  }

  if (params.aiProvider !== undefined) {
    const providerValue = String(params.aiProvider).toLowerCase();
    const supportedProviders = config.translation.aiProviders;
    if (!supportedProviders.includes(providerValue as any)) {
      throw new ValidationError(
        `Invalid AI provider: ${params.aiProvider}. Supported providers: ${supportedProviders.join(', ')}`,
        { aiProvider: params.aiProvider, supportedProviders }
      );
    }
  }
}

/**
 * Валидация конфигурации API ключей
 * @param {string[]} keys - массив API ключей
 * @param {string} provider - провайдер ('openrouter' или 'ollama')
 * @throws {ValidationError} при невалидных ключах
 */
export function validateApiKeys(keys: string[], provider: 'openrouter' | 'ollama'): void {
  if (!Array.isArray(keys)) {
    throw new ValidationError(`${provider} API keys must be an array`);
  }

  // Фильтруем пустые и пробельные ключи
  const validKeys = keys
    .map(key => key?.trim())
    .filter(key => key && key.length > 0);

  if (validKeys.length === 0) {
    logger.warn(`No valid ${provider} API keys configured. ${provider} translation will be disabled.`);
    return;
  }

  // Проверка дубликатов
  const uniqueKeys = [...new Set(validKeys)];
  if (uniqueKeys.length !== validKeys.length) {
    logger.warn(`${provider} API keys contain duplicates. Only unique keys will be used.`, {
      totalKeys: validKeys.length,
      uniqueKeys: uniqueKeys.length
    });
  }

  logger.info(`${provider} API keys validated`, { 
    keyCount: uniqueKeys.length,
    provider
  });
}

/**
 * Форматирование размера файла в человекочитаемый формат
 * @param {number} bytes - размер в байтах
 * @returns {string} отформатированный размер
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Проверка, является ли путь абсолютным
 * @param {string} pathStr - путь для проверки
 * @returns {boolean} true если путь абсолютный
 */
export function isAbsolutePath(pathStr: string): boolean {
  return path.isAbsolute(pathStr);
}

/**
 * Валидация имени файла
 * @param {string} filename - имя файла
 * @returns {boolean} true если имя валидно
 */
export function isValidFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Запрещенные символы в именах файлов для большинства ОС
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(filename)) {
    return false;
  }

  // Проверка длины (максимум 255 символов)
  if (filename.length > 255) {
    return false;
  }

  // Запрещенные имена файлов в Windows
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const baseName = path.basename(filename, path.extname(filename)).toUpperCase();
  if (reservedNames.includes(baseName)) {
    return false;
  }

  return true;
}

/**
 * Валидация директории для записи
 * @param {string} dirPath - путь к директории
 * @throws {ValidationError} если директория не доступна для записи
 */
export function validateWritableDirectory(dirPath: string): void {
  if (!dirPath || typeof dirPath !== 'string') {
    throw new ValidationError('Directory path must be a non-empty string');
  }

  if (!isAbsolutePath(dirPath)) {
    throw new ValidationError(`Directory path must be absolute: ${dirPath}`);
  }

  try {
    // Проверяем существование директории
    if (!require('fs').existsSync(dirPath)) {
      throw new ValidationError(`Directory does not exist: ${dirPath}`);
    }

    // Проверяем права на запись
    try {
      const testFilePath = path.join(dirPath, '.write_test');
      require('fs').writeFileSync(testFilePath, 'test');
      require('fs').unlinkSync(testFilePath);
    } catch (writeError) {
      throw new ValidationError(`Directory is not writable: ${dirPath}`, { 
        error: writeError instanceof Error ? writeError.message : String(writeError) 
      });
    }

    logger.debug('Directory validated for writing', { dirPath });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to validate directory: ${dirPath}`, { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Комплексная валидация параметров запроса
 * @param {Object} queryParams - параметры запроса
 * @param {Object} bodyParams - параметры тела запроса
 * @param {Express.Multer.File} [file] - загруженный файл (опционально)
 * @throws {ValidationError} при невалидных параметрах
 */
export function validateRequestParams(
  queryParams: Record<string, any>,
  bodyParams: Record<string, any>,
  file?: Express.Multer.File
): void {
  // Валидация файла (если есть)
  if (file) {
    validateJarFile(file);
  }

  // Объединяем параметры для валидации
  const params = { ...queryParams, ...bodyParams };
  
  // Валидация параметров обработки файла
  validateFileProcessingParams({
    fb: params.fb,
    cl: params.cl,
    m: params.m,
    f: params.f,
    t: params.t
  });

  logger.debug('Request parameters validated successfully', { 
    params: Object.keys(params),
    hasFile: !!file
  });
}

/**
 * Валидация конфигурации приложения
 * @throws {ValidationError} при невалидной конфигурации
 */
export function validateAppConfig(): void {
  try {
    // Валидация путей
    const paths = config.paths;
    validateWritableDirectory(paths.tempDir);
    validateWritableDirectory(paths.uploadDir);
    validateWritableDirectory(paths.logsDir);

    // Валидация серверных настроек
    if (config.server.port <= 0 || config.server.port > 65535) {
      throw new ValidationError(`Invalid server port: ${config.server.port}. Must be between 1 and 65535`);
    }

    // Валидация языков
    if (!config.translation.supportedLanguages || config.translation.supportedLanguages.length === 0) {
      throw new ValidationError('No supported languages configured');
    }

    // Валидация API ключей
    validateApiKeys(config.api.openrouter.keys, 'openrouter');

    logger.info('Application configuration validated successfully');
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error('Application configuration validation failed', { error: error.message });
      throw error;
    }
    throw new ValidationError(`Failed to validate application configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}