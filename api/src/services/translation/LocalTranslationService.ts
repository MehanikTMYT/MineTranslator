// src/services/translation/LocalTranslationService.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { TranslationError } from '../../utils/errorUtils';
import { TranslationOptions, TranslationResult, ErrorCode } from '../../utils/types';

const execAsync = promisify(exec);

export class LocalTranslationService {
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