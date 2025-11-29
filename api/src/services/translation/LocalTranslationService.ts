// src/services/translation/LocalTranslationService.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { TranslationError } from '../../utils/errorUtils';
import { TranslationOptions, TranslationResult, ErrorCode, TranslationRequest, TranslationResponse } from '../../utils/types';

const execAsync = promisify(exec);

export class LocalTranslationService {
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    // For local translation, we'll implement a basic key-value mapping based on language patterns
    const startTime = Date.now();
    const translations: Record<string, string> = {};
    const errors: any[] = [];

    // For local translation, we'll use simple rules or return the same text
    // This is a basic implementation - in real scenarios, this would use local dictionaries
    for (const key of request.keys) {
      try {
        const originalText = request.texts[key];
        // Basic translation logic - in reality this would use local dictionaries
        translations[key] = this.localTranslateText(originalText, request.sourceLang, request.targetLang);
      } catch (error) {
        errors.push(error);
      }
    }

    return {
      translations,
      metadata: {
        provider: 'local',
        processingTime: Date.now() - startTime,
        successfulKeys: Object.keys(translations).length,
        failedKeys: errors.length
      },
      errors
    };
  }

  private localTranslateText(text: string, sourceLang: string, targetLang: string): string {
    // Basic implementation - in reality this would use local dictionaries or translation rules
    // For now, just return the original text (no-op translation)
    return text;
  }

  async translateJsonFile(filePath: string, options: TranslationOptions): Promise<TranslationResult> {
    try {
      const command = `jsontt ${filePath} --fallback ${options.fb} --concurrencylimit ${options.cl} --module ${options.m} --from ${options.f} --to ${options.t} --name ru`;
      
      console.log(`⚙️ Executing translation command: ${command}`);
      const { stderr } = await execAsync(command, { timeout: 300000 }); // 5 minutes timeout
      
      if (stderr) {
        console.warn(`⚠️ Command warnings: ${stderr}`);
      }

      const dir = path.dirname(filePath);
      const originalFilePath = path.join(dir, 'ru.ru.json');
      const newFilePath = path.join(dir, 'ru_ru.json');

      // Rename file
      await this.renameFile(originalFilePath, newFilePath);

      // Load and return translated data
      const fs = require('fs');
      const translatedData = JSON.parse(fs.readFileSync(newFilePath, 'utf8'));
      
      console.log(`✅ Local translation completed successfully`);
      return {
        success: true,
         translatedData,
        filePath: newFilePath
      };

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new TranslationError('jsontt command not found. Please install json-to-translation package.', ErrorCode.VALIDATION_ERROR);
      }
      throw new TranslationError(`Local translation failed: ${error.message}`, ErrorCode.TRANSLATION_FAILED, { command: error.command });
    }
  }

  private async renameFile(oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      fs.rename(oldPath, newPath, (error: Error | null) => {
        if (error) {
          reject(new Error(`Failed to rename file: ${error.message}`));
        } else {
          console.log(`✅ File renamed: ${newPath}`);
          resolve();
        }
      });
    });
  }
}