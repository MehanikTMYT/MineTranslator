import { OpenAIService } from './OpenAIService';
import { OllamaService } from './OllamaService';
import { sleep } from '../../utils/timeUtils';
import { TranslationError, ServiceUnavailableError, ModelNotFoundError } from '../../utils/errorUtils';
import { TranslationOptions, TranslationResult, ErrorCode, TranslationRequest, TranslationResponse } from '../../utils/types';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export class AiTranslationService {
  private openaiService: OpenAIService;
  private ollamaService: OllamaService;
  private readonly maxRetriesPerKey: number = 3;

  constructor() {
    this.openaiService = new OpenAIService();
    this.ollamaService = new OllamaService();
    logger.info('Initialized AiTranslationService', {
      openrouterAvailable: config.api.openrouter.keys.length > 0,
      ollamaAvailable: !!config.api.ollama.baseURL
    });
  }

  /**
   * Выбирает AI сервис на основе указанного провайдера
   * @private
   */
  private getAiService(provider: string = 'openrouter') {
    if (provider === 'ollama') {
      return this.ollamaService;
    }
    return this.openaiService;
  }

  /**
   * Проверяет доступность AI сервисов
   * @returns {Promise<boolean>} true если хотя бы один сервис доступен
   */
  async checkHealth(): Promise<boolean> {
    const results = {
      openrouter: false,
      ollama: false
    };

    try {
      // Проверяем OpenRouter если есть ключи
      if (config.api.openrouter.keys.length > 0) {
        await this.openaiService.checkApiLimits();
        results.openrouter = true;
      }
    } catch (error) {
      logger.warn('OpenRouter health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    try {
      // Проверяем Ollama если указан базовый URL
      if (config.api.ollama.baseURL) {
        await this.ollamaService.checkHealth();
        results.ollama = true;
      }
    } catch (error) {
      logger.warn('Ollama health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    if (!results.openrouter && !results.ollama) {
      throw new ServiceUnavailableError('Both AI services are unavailable');
    }

    logger.info('AI service health check completed', { results });
    return true;
  }

  /**
   * Основной метод перевода текстов с использованием AI
   * @param {TranslationRequest} request - запрос на перевод
   * @returns {Promise<TranslationResponse>} результат перевода
   */
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const aiProvider = request.aiProvider || config.translation.aiProviders[0] || 'openrouter';
    const startTime = Date.now();
    
    logger.info('Starting AI translation', { 
      provider: aiProvider,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      keyCount: request.keys.length
    });

    try {
      // Выбираем сервис на основе провайдера
      const aiService = this.getAiService(aiProvider);
      
      // Для Ollama используем полный запрос перевода
      if (aiProvider === 'ollama') {
        return await this.translateWithOllama(request);
      }
      
      // Для OpenRouter переводим по ключам
      return await this.translateWithOpenRouter(request);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('AI translation failed', { 
        duration: `${duration}ms`,
        provider: aiProvider,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof TranslationError) {
        throw error;
      }
      
      throw new TranslationError(`AI translation failed with ${aiProvider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Перевод с использованием Ollama
   * @private
   */
  private async translateWithOllama(request: TranslationRequest): Promise<TranslationResponse> {
    // OllamaService поддерживает перевод всего запроса сразу
    const response = await this.ollamaService.translate(request);
    return response;
  }

  /**
   * Перевод с использованием OpenRouter
   * @private
   */
  private async translateWithOpenRouter(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    const translations: Record<string, string> = {};
    const errors: any[] = [];

    for (const key of request.keys) {
      try {
        const text = request.texts[key];
        const translatedText = await this.translateText(text, {
          fb: 'yes',
          cl: 1,
          m: 'google',
          f: request.sourceLang,
          t: request.targetLang,
          translateMethod: 'ai',
          aiProvider: 'openrouter'
        });
        translations[key] = translatedText;
      } catch (error) {
        errors.push({
          key,
          error: error instanceof Error ? error.message : String(error),
          originalText: request.texts[key]
        });
        logger.warn(`Failed to translate key "${key}" with OpenRouter`, { 
          error: error instanceof Error ? error.message : String(error),
          originalText: request.texts[key].substring(0, 100)
        });
        // Используем оригинальный текст как fallback
        translations[key] = request.texts[key];
      }
    }

    const duration = Date.now() - startTime;
    const successCount = Object.keys(translations).length - errors.length;
    
    logger.info('OpenRouter translation completed', { 
      duration: `${duration}ms`,
      successCount,
      errorCount: errors.length
    });

    return {
      translations,
      metadata: {
        provider: 'openrouter',
        model: config.api.openrouter.model,
        processingTime: duration,
        successfulKeys: successCount,
        failedKeys: errors.length,
        fallbackUsed: errors.length > 0
      },
      errors
    };
  }

  /**
   * Перевод одного текста с использованием OpenRouter
   * @param {string} text - текст для перевода
   * @param {TranslationOptions} options - опции перевода
   * @param {string[]} descriptions - контекст мода (опционально)
   * @returns {Promise<string>} переведенный текст
   */
  async translateText(text: string, options: TranslationOptions, descriptions: string[] = []): Promise<string> {
    if (!config.api.openrouter.keys.length) {
      throw new ServiceUnavailableError('No OpenRouter API keys configured');
    }

    let totalAttempts = 0;
    const maxTotalAttempts = this.maxRetriesPerKey * this.openaiService.getApiKeyManager().getKeyCount();

    while (totalAttempts < maxTotalAttempts) {
      try {
        await this.openaiService.checkApiLimits();
        await this.openaiService.waitForRateLimit();

        const contextText = this.formatModContext(descriptions);
        
        const messageContent = `
You are a professional Minecraft mod translator. Use the following mod context to provide accurate translations:

${contextText}

Translate the following text from ${options.f} into ${options.t} without any additional comments or explanations:
${text}
        `.trim();

        logger.debug('Translating with OpenRouter', { 
          apiKey: this.openaiService.getApiKeyManager().currentKey.substring(0, 8) + '...',
          textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          hasContext: contextText !== 'No mod context available.'
        });

        let retries = 0;
        while (retries < this.maxRetriesPerKey) {
          try {
            const openai = this.openaiService.createInstance();
            const response = await openai.chat.completions.create({
              model: config.api.openrouter.model,
              messages: [{ role: "user", content: messageContent }],
              temperature: config.modelSettings.openrouter.temperature,
              max_tokens: config.modelSettings.openrouter.maxTokens,
            });

            if (!response.choices[0]?.message?.content) {
              throw new Error('No content in AI response');
            }

            const translatedText = response.choices[0].message.content.trim();
            logger.debug('Translation successful', { 
              translatedPreview: translatedText.substring(0, 100) + (translatedText.length > 100 ? '...' : '')
            });
            
            this.openaiService.decrementRequestCount();
            return translatedText;

          } catch (error: any) {
            retries++;
            logger.error(`OpenRouter API attempt ${retries}/${this.maxRetriesPerKey} failed`, { 
              error: error.message,
              errorCode: error.code,
              statusCode: error.statusCode
            });

            if (error.message.includes('rate limit') || 
                error.message.includes('429') || 
                error.message.includes('quota') ||
                retries >= this.maxRetriesPerKey) {
              this.openaiService.getApiKeyManager().switchKey();
              await sleep(4000);
              break;
            }

            await sleep(2000);
          }
        }

      } catch (error: any) {
        totalAttempts++;
        logger.error(`OpenRouter attempt ${totalAttempts}/${maxTotalAttempts} failed with current key`, { 
          error: error.message,
          currentKeyIndex: this.openaiService.getApiKeyManager().getCurrentKeyIndex()
        });
        
        if (totalAttempts >= maxTotalAttempts) {
          throw new TranslationError('All OpenRouter API keys failed after maximum attempts', ErrorCode.API_ERROR);
        }

        this.openaiService.getApiKeyManager().switchKey();
        await sleep(4000);
      }
    }

    throw new TranslationError('Maximum translation attempts exceeded for OpenRouter', ErrorCode.MAX_ATTEMPTS_EXCEEDED);
  }

  /**
   * Форматирует контекст мода для OpenRouter
   * @private
   */
  private formatModContext(descriptions: string[]): string {
    if (descriptions.length === 0) {
      return 'No mod context available.';
    }
    
    if (descriptions.length === 1) {
      return `Mod Context:\n${descriptions[0]}`;
    }
    
    return `Mod Contexts:\n${descriptions.map((desc, i) => `Mod ${i + 1}:\n${desc}`).join('\n\n')}`;
  }

  /**
   * Перевод JSON файла (устаревший метод, для совместимости)
   * @deprecated Используйте метод translate вместо этого
   */
  async translateJsonFile(filePath: string, options: TranslationOptions, descriptions: string[] = []): Promise<TranslationResult> {
    try {
      const fs = require('fs');
      const rawData = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(rawData);

      const translatedData: Record<string, string> = {};
      let successCount = 0;
      let failureCount = 0;

      logger.info(`Starting JSON file translation`, { 
        keyCount: Object.keys(jsonData).length,
        sourceLang: options.f,
        targetLang: options.t
      });

      for (const [key, text] of Object.entries(jsonData)) {
        if (typeof text !== 'string') continue;

        try {
          translatedData[key] = await this.translateText(text.toString(), options, descriptions);
          successCount++;
          logger.debug(`Translated key "${key}"`, { successCount, total: Object.keys(jsonData).length });
        } catch (error: any) {
          logger.error(`Failed to translate key "${key}"`, { 
            error: error.message,
            originalText: text.toString().substring(0, 100)
          });
          translatedData[key] = text.toString();
          failureCount++;
        }
      }

      logger.info('JSON file translation completed', { 
        successCount, 
        failureCount,
        filePath
      });

      return {
        success: true,
        translatedData,
        filePath
      };
    } catch (error: any) {
      logger.error('JSON file translation failed', { error: error.message, filePath });
      throw new TranslationError(`Failed to translate JSON file: ${error.message}`, ErrorCode.TRANSLATION_FAILED);
    }
  }
}