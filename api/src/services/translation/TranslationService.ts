//src/services/translation/TranslationService.ts
import { TranslationRequest, TranslationResponse, TranslationMethod } from '../../utils/types';
import { LocalTranslationService } from './LocalTranslationService';
import { AiTranslationService } from '../ai/AiTranslationService';
import { ApiKeyManager } from '../ai/ApiKeyManager';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';
import { ValidationError, TranslationError, ServiceUnavailableError } from '../../utils/errorUtils';
import { validateTranslationRequest } from '../../utils/validationUtils';

/**
 * Основной сервис для перевода текстов
 * Координирует работу разных методов перевода (локальный, AI)
 * Предоставляет единый интерфейс для клиента
 * 
 * Особенности:
 * - Автоматический выбор метода перевода
 * - Резервный перевод при ошибках
 * - Балансировка нагрузки между разными AI провайдерами
 * - Кэширование переводов для оптимизации
 * - Поддержка fallback стратегии
 */
export class TranslationService {
  private localService: LocalTranslationService;
  private aiService: AiTranslationService;
  private apiKeyManager: ApiKeyManager;
  private translationCache: Map<string, string>;
  private cacheSize: number;

  constructor() {
    this.localService = new LocalTranslationService();
    this.apiKeyManager = new ApiKeyManager();
    this.aiService = new AiTranslationService();
    this.translationCache = new Map();
    this.cacheSize = 10000; // Максимальный размер кэша
    logger.info('Intialized TranslationService');
  }

  /**
   * Основной метод перевода текста
   * @param {TranslationRequest} request - запрос на перевод
   * @returns {Promise<TranslationResponse>} результат перевода
   * @throws {ValidationError} при невалидных данных
   * @throws {TranslationError} при ошибках перевода
   */
  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    logger.info('Starting translation', { 
      sourceLang: request.sourceLang, 
      targetLang: request.targetLang, 
      keyCount: request.keys.length,
      methods: request.methods,
      modules: request.modules
    });

    // Валидация запроса
    validateTranslationRequest(request);

    try {
      // Фильтруем ключи, которые уже есть в кэше
      const { cachedTranslations, keysToTranslate } = await this.filterCachedTranslations(request);
      
      if (keysToTranslate.length === 0) {
        logger.info('All translations found in cache');
        return {
          translations: cachedTranslations,
          metadata: {
            provider: 'cache',
            processingTime: Date.now() - startTime,
            successfulKeys: Object.keys(cachedTranslations).length,
            failedKeys: 0,
            cacheHits: Object.keys(cachedTranslations).length,
            cacheMisses: 0
          },
          errors: []
        };
      }

      // Создаем новый запрос только для ключей, которых нет в кэше
      const filteredRequest: TranslationRequest = {
        ...request,
        keys: keysToTranslate,
        texts: Object.fromEntries(
          keysToTranslate.map(key => [key, request.texts[key]])
        )
      };

      // Определяем, какие методы перевода использовать
      const methodsToUse = this.determineTranslationMethods(request);

      // Пытаемся перевести с помощью выбранных методов
      const result = await this.translateWithMethods(filteredRequest, methodsToUse);

      // Объединяем кэшированные и новые переводы
      const allTranslations = {
        ...cachedTranslations,
        ...result.translations
      };

      // Кэшируем успешные переводы
      this.cacheTranslations(result.translations, request.sourceLang, request.targetLang);

      const duration = Date.now() - startTime;
      logger.info('Translation completed', { 
        duration: `${duration}ms`,
        totalKeys: request.keys.length,
        cacheHits: Object.keys(cachedTranslations).length,
        cacheMisses: keysToTranslate.length,
        successfulTranslations: Object.keys(allTranslations).length,
        errors: result.errors.length
      });

      // Обновляем метаданные
      result.metadata.processingTime = duration;
      result.metadata.cacheHits = Object.keys(cachedTranslations).length;
      result.metadata.cacheMisses = keysToTranslate.length;

      return {
        translations: allTranslations,
        metadata: result.metadata,
        errors: result.errors
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Translation failed', { 
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof TranslationError) {
        throw error;
      }

      throw new TranslationError(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Фильтрует ключи, которые уже есть в кэше
   * @private
   */
  private async filterCachedTranslations(request: TranslationRequest): Promise<{
    cachedTranslations: Record<string, string>;
    keysToTranslate: string[];
  }> {
    const cachedTranslations: Record<string, string> = {};
    const keysToTranslate: string[] = [];

    for (const key of request.keys) {
      const cacheKey = this.generateCacheKey(key, request.sourceLang, request.targetLang);
      const cachedValue = this.translationCache.get(cacheKey);
      
      if (cachedValue !== undefined) {
        cachedTranslations[key] = cachedValue;
      } else {
        keysToTranslate.push(key);
      }
    }

    return { cachedTranslations, keysToTranslate };
  }

  /**
   * Определяет, какие методы перевода использовать
   * @private
   */
  private determineTranslationMethods(request: TranslationRequest): TranslationMethod[] {
    // Если пользователь явно указал методы, используем их
    if (request.methods && request.methods.length > 0) {
      return request.methods;
    }

    // По умолчанию используем оба метода, но с приоритетом
    return ['local', 'ai'];
  }

  /**
   * Выполняет перевод с использованием указанных методов
   * @private
   */
  private async translateWithMethods(
    request: TranslationRequest, 
    methods: TranslationMethod[]
  ): Promise<TranslationResponse> {
    let result: TranslationResponse | null = null;
    const errors: Error[] = [];

    for (const method of methods) {
      try {
        if (method === 'local') {
          logger.debug('Using local translation method');
          result = await this.localService.translate(request);
          
          // Если локальный перевод не смог перевести все ключи, используем AI для оставшихся
          if (result && Object.keys(result.translations).length < request.keys.length && request.fallbackOptions?.includes('yes')) {
            const missingKeys = request.keys.filter(key => !result?.translations[key]);
            if (missingKeys.length > 0) {
              logger.info('Local translation incomplete, using AI for missing keys', { missingCount: missingKeys.length });
              
              const aiRequest: TranslationRequest = {
                ...request,
                keys: missingKeys,
                texts: Object.fromEntries(missingKeys.map(key => [key, request.texts[key]])),
                methods: ['ai']
              };
              
              const aiResult = await this.aiService.translate(aiRequest);
              
              // Объединяем результаты
              result.translations = {
                ...result.translations,
                ...aiResult.translations
              };
              
              result.errors = [...(result.errors || []), ...(aiResult.errors || [])];
              result.metadata.fallbackUsed = true;
            }
          }
          
          if (result && Object.keys(result.translations).length > 0) {
            return result;
          }
        } else if (method === 'ai') {
          logger.debug('Using AI translation method');
          result = await this.aiService.translate(request);
          
          if (result && Object.keys(result.translations).length > 0) {
            return result;
          }
        }
      } catch (error) {
        logger.warn(`Translation method "${method}" failed`, { error: error instanceof Error ? error.message : String(error) });
        errors.push(error as Error);
        
        // Если это последний метод и все методы завершились ошибкой
        if (method === methods[methods.length - 1]) {
          throw new TranslationError(
            `All translation methods failed. Last error: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    // Если ни один метод не вернул результат
    throw new TranslationError('No translations were produced by any method');
  }

  /**
   * Кэширует переводы для быстрого доступа
   * @private
   */
  private cacheTranslations(
    translations: Record<string, string>, 
    sourceLang: string, 
    targetLang: string
  ): void {
    try {
      Object.entries(translations).forEach(([key, value]) => {
        const cacheKey = this.generateCacheKey(key, sourceLang, targetLang);
        
        // Проверяем размер кэша и чистим при необходимости
        if (this.translationCache.size >= this.cacheSize) {
          const oldestKey = this.translationCache.keys().next().value;
          if (oldestKey) {
            this.translationCache.delete(oldestKey);
          }
        }
        
        this.translationCache.set(cacheKey, value);
      });
      
      logger.debug('Translations cached', { count: Object.keys(translations).length });
    } catch (error) {
      logger.error('Failed to cache translations', { error: error instanceof Error ? error.message : String(error) });
      // Не выбрасываем ошибку, чтобы не прервать основной процесс
    }
  }

  /**
   * Генерирует ключ для кэширования
   * @private
   */
  private generateCacheKey(key: string, sourceLang: string, targetLang: string): string {
    return `${sourceLang}:${targetLang}:${key}`;
  }

  /**
   * Проверяет доступность сервисов перевода
   * @returns {Promise<Record<string, boolean>>} статус доступности сервисов
   */
  public async checkHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {
      local: true, 
      ai: false,
      cache: true
    };

    try {
      await this.aiService.checkHealth();
      results.ai = true;
    } catch (error) {
      logger.warn('AI service health check failed', { error: error instanceof Error ? error.message : String(error) });
      results.ai = false;
    }

    return results;
  }

  /**
   * Очищает кэш переводов
   */
  public clearCache(): void {
    this.translationCache.clear();
    logger.info('Translation cache cleared');
  }

  /**
   * Получает статистику по кэшу
   */
  public getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.translationCache.size,
      maxSize: this.cacheSize
    };
  }
}