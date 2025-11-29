import fetch from 'node-fetch';
import { config } from '../../config/config';
import { TranslationRequest, TranslationResponse, TranslationError, TranslationResult } from '../../utils/types';
import { logger } from '../../utils/logger';
import { ApiKeyManager } from './ApiKeyManager';
import { ServiceUnavailableError, TranslationTimeoutError, ModelNotFoundError } from '../../utils/errorUtils';
import { delay } from '../../utils/timeUtils';

/**
 * Сервис для взаимодействия с Ollama API (локальная LLM)
 * Предоставляет методы для перевода текста с использованием локальных моделей
 * 
 * Особенности:
 * - Автоматические повторные попытки при ошибках
 * - Проверка доступности модели перед переводом
 * - Ограничение частоты запросов для предотвращения перегрузки
 * - Поддержка streaming режима (опционально)
 * - Детальное логирование для отладки
 */
export class OllamaService {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private healthCheckTimeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private lastRequestTime: number = 0;
  private minRequestInterval: number;

  constructor() {
    this.baseUrl = config.api.ollama.baseURL;
    this.model = config.api.ollama.model;
    this.timeout = config.api.ollama.timeout;
    this.healthCheckTimeout = config.api.ollama.healthCheckTimeout;
    this.maxRetries = config.limits.maxOllamaRetries;
    this.retryDelay = config.batchProcessing.ollama.delayBetweenBatches;
    this.minRequestInterval = config.batchProcessing.ollama.minRequestInterval;
    logger.info('Intialized OllamaService', { 
      baseUrl: this.baseUrl,
      model: this.model,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Проверяет доступность Ollama сервера и модели
   * @returns {Promise<boolean>} true если сервис доступен
   * @throws {ServiceUnavailableError} если сервис недоступен
   */
  public async checkHealth(): Promise<boolean> {
    try {
      // Проверка доступности сервера
      const serverResponse = await fetch(`${this.baseUrl.replace('/api/generate', '/api/tags')}`, {
        method: 'GET',
        timeout: this.healthCheckTimeout,
      });

      if (!serverResponse.ok) {
        throw new ServiceUnavailableError(`Ollama server unavailable: ${serverResponse.status} ${serverResponse.statusText}`);
      }

      const data = await serverResponse.json();
      
      // Проверка наличия модели
      const models = data.models || [];
      const modelAvailable = models.some((model: any) => 
        model.name === this.model || model.name.includes(this.model)
      );

      if (!modelAvailable) {
        logger.warn('Ollama model not found', { 
          requestedModel: this.model, 
          availableModels: models.map((m: any) => m.name) 
        });
        throw new ModelNotFoundError(`Model "${this.model}" not found in Ollama. Available models: ${models.map((m: any) => m.name).join(', ')}`);
      }

      logger.info('Ollama service is healthy', { model: this.model });
      return true;
    } catch (error) {
      logger.error('Ollama health check failed', { error: error instanceof Error ? error.message : String(error) });
      throw new ServiceUnavailableError(`Ollama health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Выполняет перевод текста с использованием Ollama
   * @param {TranslationRequest} request - запрос на перевод
   * @returns {Promise<TranslationResponse>} результат перевода
   * @throws {TranslationError} при ошибках перевода
   */
  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    logger.debug('Starting Ollama translation', { 
      sourceLang: request.sourceLang, 
      targetLang: request.targetLang, 
      keyCount: request.keys.length 
    });

    try {
      // Применяем ограничение частоты запросов
      await this.applyRateLimit();

      // Формируем промпт для перевода
      const prompt = this.buildTranslationPrompt(request);

      // Выполняем запрос с retry логикой
      const response = await this.executeWithRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              model: this.model,
              prompt: prompt,
              stream: false,
              options: {
                temperature: config.modelSettings.ollama.temperature,
                top_p: config.modelSettings.ollama.topP,
                repeat_penalty: config.modelSettings.ollama.repeatPenalty,
                num_ctx: config.modelSettings.ollama.numCtx,
                num_predict: config.modelSettings.ollama.numPredict,
              }
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.text();
            logger.error('Ollama API error', { 
              status: response.status, 
              statusText: response.statusText, 
              errorData 
            });

            if (response.status === 404) {
              throw new ModelNotFoundError(`Model "${this.model}" not found in Ollama`);
            } else if (response.status === 503 || response.status === 504) {
              throw new ServiceUnavailableError(`Ollama service unavailable: ${response.status}`);
            } else {
              throw new TranslationError(`Ollama API error: ${response.status} ${response.statusText} - ${errorData}`);
            }
          }

          const result = await response.json();
          return result;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            throw new TranslationTimeoutError(`Ollama request timed out after ${this.timeout}ms`);
          }
          throw error;
        }
      });

      // Обрабатываем результат
      const translationResult = await this.parseTranslationResponse(response, request);

      const duration = Date.now() - startTime;
      logger.info('Ollama translation completed', { 
        duration: `${duration}ms`, 
        successCount: translationResult.successfulTranslations.length,
        errorCount: translationResult.failedTranslations.length
      });

      return {
        translations: translationResult.successfulTranslations,
        metadata: {
          provider: 'ollama',
          model: this.model,
          processingTime: duration,
          tokensUsed: this.estimateTokens(prompt),
          successfulKeys: translationResult.successfulTranslations.length,
          failedKeys: translationResult.failedTranslations.length,
          fallbackUsed: false
        },
        errors: translationResult.failedTranslations
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Ollama translation failed', { 
        duration: `${duration}ms`, 
        error: error instanceof Error ? error.message : String(error) 
      });

      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(`Ollama translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Формирует промпт для перевода на основе запроса
   * @private
   */
  private buildTranslationPrompt(request: TranslationRequest): string {
    const systemPrompt = `You are a professional translator specializing in Minecraft mod localization. 
Translate the following JSON key-value pairs from ${request.sourceLang} to ${request.targetLang}.
Return ONLY a valid JSON object with the same structure, containing the translated values.
Do not add any comments, explanations, or additional text.
Preserve all keys exactly as they are.
If a value contains variables like {0}, {player}, %s, etc., keep them exactly the same in the translation.`;

    const examples = [
      { key: 'item.example.sword', value: 'Sharp Sword', translation: request.targetLang === 'ru' ? 'Острый меч' : 'Sharp Sword' },
      { key: 'gui.example.button', value: 'Click me!', translation: request.targetLang === 'ru' ? 'Нажми меня!' : 'Click me!' },
      { key: 'message.example.welcome', value: 'Welcome, {player}!', translation: request.targetLang === 'ru' ? 'Добро пожаловать, {player}!' : 'Welcome, {player}!' }
    ].slice(0, 2); // Используем 2 примера для экономии контекста

    const examplePairs = examples.map(ex => 
      `"${ex.key}": "${ex.value}" -> "${ex.translation}"`
    ).join('\n');

    const translationPairs = request.keys.map(key => 
      `"${key}": "${request.texts[key]}"`
    ).join('\n');

    return `${systemPrompt}

Examples:
${examplePairs}

Translate these JSON key-value pairs:
${translationPairs}

Return ONLY the JSON object with translations:`;
  }

  /**
   * Парсит ответ от Ollama и извлекает переводы
   * @private
   */
  private async parseTranslationResponse(response: any, request: TranslationRequest): Promise<TranslationResult> {
    const successfulTranslations: Record<string, string> = {};
    const failedTranslations: TranslationError[] = [];

    try {
      // Извлекаем текст из ответа Ollama
      const responseText = response.response || response.message?.content || response.content || '';
      
      if (!responseText) {
        throw new TranslationError('Empty response from Ollama');
      }

      logger.debug('Raw Ollama response', { responseText: responseText.substring(0, 200) + '...' });

      // Извлекаем JSON из текста (Ollama может добавлять дополнительный текст)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new TranslationError('No JSON object found in Ollama response');
      }

      const jsonString = jsonMatch[0];
      let translations: Record<string, string>;

      try {
        translations = JSON.parse(jsonString);
      } catch (parseError) {
        // Попробуем исправить распространенные ошибки в JSON
        const cleanedJson = this.cleanJsonResponse(jsonString);
        try {
          translations = JSON.parse(cleanedJson);
        } catch (secondParseError) {
          logger.error('JSON parsing failed after cleaning', { 
            originalJson: jsonString.substring(0, 200),
            cleanedJson: cleanedJson.substring(0, 200),
            error: secondParseError instanceof Error ? secondParseError.message : String(secondParseError)
          });
          throw new TranslationError(`Failed to parse JSON response: ${secondParseError instanceof Error ? secondParseError.message : 'Unknown error'}`);
        }
      }

      // Валидируем и фильтруем переводы
      for (const key of request.keys) {
        if (translations[key]) {
          successfulTranslations[key] = this.postProcessTranslation(translations[key], request.targetLang);
        } else {
          failedTranslations.push(new TranslationError(`Missing translation for key: ${key}`));
        }
      }

      // Проверяем, что все ключи переведены
      if (Object.keys(successfulTranslations).length === 0) {
        throw new TranslationError('No valid translations found in response');
      }

      return {
        successfulTranslations,
        failedTranslations
      };

    } catch (error) {
      logger.error('Error parsing Ollama response', { error: error instanceof Error ? error.message : String(error) });
      
      // Если парсинг не удался, попробуем альтернативный подход
      if (error instanceof TranslationError && error.message.includes('JSON')) {
        return await this.fallbackParseResponse(responseText, request);
      }

      throw error;
    }
  }

  /**
   * Очищает JSON ответ от лишних символов и исправляет распространенные ошибки
   * @private
   */
  private cleanJsonResponse(jsonString: string): string {
    // Удаляем комментарии
    let cleaned = jsonString.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Исправляем одинарные кавычки на двойные для ключей и значений
    cleaned = cleaned.replace(/'([^']+)'/g, '"$1"');
    
    // Исправляем неэкранированные кавычки внутри значений
    cleaned = cleaned.replace(/":\s*"([^"]*)"/g, (match, p1) => {
      return `": "${p1.replace(/"/g, '\\"')}"`;
    });
    
    // Удаляем запятые перед закрывающими скобками
    cleaned = cleaned.replace(/,\s*}/g, '}');
    cleaned = cleaned.replace(/,\s*\]/g, ']');
    
    // Удаляем запятые в конце объектов
    cleaned = cleaned.replace(/\}\s*,\s*\}/g, '}}');
    
    return cleaned;
  }

  /**
   * Альтернативный метод парсинга ответа при ошибке основного метода
   * @private
   */
  private async fallbackParseResponse(responseText: string, request: TranslationRequest): Promise<TranslationResult> {
    const successfulTranslations: Record<string, string> = {};
    const failedTranslations: TranslationError[] = [];

    // Попробуем извлечь переводы построчно
    const lines = responseText.split('\n');
    const keyTranslations: Record<string, string> = {};

    for (const line of lines) {
      const lineTrimmed = line.trim();
      if (lineTrimmed.startsWith('"') && lineTrimmed.includes(':')) {
        try {
          // Извлекаем ключ и значение из строки вида "key": "value"
          const keyMatch = lineTrimmed.match(/^"([^"]+)":\s*"([^"]*)"/);
          if (keyMatch) {
            const key = keyMatch[1];
            const value = keyMatch[2].replace(/\\"/g, '"');
            keyTranslations[key] = value;
          }
        } catch (e) {
          logger.debug('Line parsing failed', { line, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // Сопоставляем с запрошенными ключами
    for (const key of request.keys) {
      if (keyTranslations[key]) {
        successfulTranslations[key] = this.postProcessTranslation(keyTranslations[key], request.targetLang);
      } else {
        failedTranslations.push(new TranslationError(`Fallback parsing: missing translation for key: ${key}`));
      }
    }

    if (Object.keys(successfulTranslations).length > 0) {
      logger.warn('Used fallback parsing for Ollama response', { 
        successCount: Object.keys(successfulTranslations).length,
        errorCount: failedTranslations.length
      });
      return { successfulTranslations, failedTranslations };
    }

    throw new TranslationError('Fallback parsing also failed to extract translations');
  }

  /**
   * Постобработка переведенного текста
   * @private
   */
  private postProcessTranslation(text: string, targetLang: string): string {
    // Удаляем лишние пробелы в начале и конце
    let processed = text.trim();
    
    // Исправляем двойные кавычки
    processed = processed.replace(/\\"/g, '"');
    
    // Восстанавливаем escape-последовательности
    processed = processed.replace(/\\n/g, '\n');
    processed = processed.replace(/\\t/g, '\t');
    
    // Для китайского и японского языков удаляем пробелы между иероглифами
    if (['zh-CN', 'zh-TW', 'ja', 'ko'].includes(targetLang)) {
      processed = processed.replace(/\s+/g, '');
    }
    
    // Ограничиваем длину текста (максимум 1000 символов на значение)
    if (processed.length > 1000) {
      processed = processed.substring(0, 997) + '...';
    }
    
    return processed;
  }

  /**
   * Применяет ограничение частоты запросов
   * @private
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delayTime = this.minRequestInterval - timeSinceLastRequest;
      logger.debug('Applying rate limit delay', { delayTime });
      await delay(delayTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Выполняет функцию с retry логикой
   * @private
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retries: number = this.maxRetries): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }
      
      // Не повторяем попытки для некоторых типов ошибок
      if (error instanceof ModelNotFoundError || error instanceof TranslationTimeoutError) {
        throw error;
      }
      
      logger.warn('Retrying Ollama request', { 
        retriesLeft: retries, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      await delay(this.retryDelay * (this.maxRetries - retries + 1));
      return this.executeWithRetry(fn, retries - 1);
    }
  }

  /**
   * Оценивает количество токенов в тексте
   * @private
   */
  private estimateTokens(text: string): number {
    // Простая оценка: 1 токен = 4 символа
    return Math.ceil(text.length / 4);
  }
}