// src/services/ai/AiTranslationService.ts
import { OpenAIService } from './OpenAIService';
import { sleep } from '../../utils/timeUtils';
import { TranslationError, ServiceUnavailableError } from '../../utils/errorUtils';
import { TranslationOptions, TranslationResult, ErrorCode, TranslationRequest, TranslationResponse } from '../../utils/types';
import { config } from '../../config/config';

export class AiTranslationService {
  private openaiService: OpenAIService;
  private readonly maxRetriesPerKey: number = 3;

  constructor() {
    this.openaiService = new OpenAIService();
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Try to make a simple API call to check if the service is working
      await this.openaiService.checkApiLimits();
      return true;
    } catch (error) {
      throw new ServiceUnavailableError(`AI service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    // Implement the translation method for AI service
    // For now, return a placeholder implementation
    const startTime = Date.now();
    const translations: Record<string, string> = {};
    const errors: any[] = [];

    for (const key of request.keys) {
      try {
        // Translate each text using the existing translateText method
        const translatedText = await this.translateText(request.texts[key], {
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
        errors.push(error);
      }
    }

    return {
      translations,
      metadata: {
        provider: 'ai',
        processingTime: Date.now() - startTime,
        successfulKeys: Object.keys(translations).length,
        failedKeys: errors.length
      },
      errors
    };
  }

  async translateText(text: string, options: TranslationOptions, descriptions: string[] = []): Promise<string> {
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

        console.log(`🤖 Translating with API key: ${this.openaiService.getApiKeyManager().currentKey.substring(0, 8)}...`);
        console.log(`📝 Text to translate: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        if (contextText && contextText !== 'No mod context available.') {
          console.log(`📚 Mod context provided for translation`);
        }

        let retries = 0;
        while (retries < this.maxRetriesPerKey) {
          try {
            const openai = this.openaiService.createInstance();
            const response = await openai.chat.completions.create({
              model: config.api.openrouter.model,
              messages: [{ role: "user", content: messageContent }],
              temperature: 0.1,
              max_tokens: config.modelSettings.openrouter.maxTokens,
            });

            if (!response.choices[0]?.message?.content) {
              throw new Error('No content in AI response');
            }

            const translatedText = response.choices[0].message.content.trim();
            console.log(`✅ Translation successful: ${translatedText.substring(0, 100)}${translatedText.length > 100 ? '...' : ''}`);
            
            this.openaiService.decrementRequestCount();
            return translatedText;

          } catch (error: any) {
            retries++;
            console.error(`🔄 API call attempt ${retries}/${this.maxRetriesPerKey} failed:`, error.message);

            if (error.message.includes('rate limit') || 
                error.message.includes('429') || 
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
        console.error(`🔄 Attempt ${totalAttempts}/${maxTotalAttempts} failed with current key:`, error.message);
        
        if (totalAttempts >= maxTotalAttempts) {
          throw new TranslationError('All API keys failed after maximum attempts', ErrorCode.API_ERROR);
        }

        this.openaiService.getApiKeyManager().switchKey();
        await sleep(4000);
      }
    }

    throw new TranslationError('Maximum translation attempts exceeded', ErrorCode.MAX_ATTEMPTS_EXCEEDED);
  }

  private formatModContext(descriptions: string[]): string {
    if (descriptions.length === 0) {
      return 'No mod context available.';
    }
    
    if (descriptions.length === 1) {
      return `Mod Context:\n${descriptions[0]}`;
    }
    
    return `Mod Contexts:\n${descriptions.map((desc, i) => `Mod ${i + 1}:\n${desc}`).join('\n\n')}`;
  }

  async translateJsonFile(filePath: string, options: TranslationOptions, descriptions: string[] = []): Promise<TranslationResult> {
    try {
      const fs = require('fs');
      const rawData = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(rawData);

      const translatedData: Record<string, string> = {};
      let successCount = 0;
      let failureCount = 0;

      console.log(`📖 Starting translation of ${Object.keys(jsonData).length} keys...`);

      for (const [key, text] of Object.entries(jsonData)) {
        if (typeof text !== 'string') continue;

        try {
          translatedData[key] = await this.translateText(text.toString(), options, descriptions);
          successCount++;
          console.log(`✅ Translated key "${key}" (${successCount}/${Object.keys(jsonData).length})`);
        } catch (error: any) {
          console.error(`❌ Failed to translate key "${key}":`, error.message);
          translatedData[key] = text.toString();
          failureCount++;
        }
      }

      console.log(`🎯 Translation completed: ${successCount} successful, ${failureCount} failed`);

      return {
        success: true,
         translatedData,
        filePath
      };
    } catch (error: any) {
      throw new TranslationError(`Failed to translate JSON file: ${error.message}`, ErrorCode.TRANSLATION_FAILED);
    }
  }
}