// src/services/JarProcessingService.ts
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';
import { FileSystemService } from './file/FileSystemService';
import { AiTranslationService } from './ai/AiTranslationService';
import { LocalTranslationService } from './translation/LocalTranslationService';
import { PackParserService } from './PackParserService';
import { ProcessingError, AppError } from '../utils/errorUtils';
import { TranslationOptions, JarProcessingResult, LangDirectoryInfo, ErrorCode } from '../utils/types';

export class JarProcessingService {
  private aiTranslationService: AiTranslationService;
  private localTranslationService: LocalTranslationService;
  private packParserService: PackParserService;

  constructor() {
    this.aiTranslationService = new AiTranslationService();
    this.localTranslationService = new LocalTranslationService();
    this.packParserService = new PackParserService();
  }

  async processJar(jarPath: string, options: TranslationOptions): Promise<JarProcessingResult> {
    const uniqueTempDir = path.join(
      config.paths.tempDir, 
      `${path.basename(jarPath, path.extname(jarPath))}_${Date.now()}`
    );

    try {
      console.log(`🚀 Starting JAR processing: ${jarPath}`);
      console.log(`📂 Creating temp directory: ${uniqueTempDir}`);

      await FileSystemService.ensureDirectoryExists(uniqueTempDir);

      await this.extractJar(jarPath, uniqueTempDir);

      const assetsDir = path.join(uniqueTempDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        throw new ProcessingError('Missing "assets" directory in JAR archive', ErrorCode.JAR_PROCESSING_FAILED, { jarPath });
      }

      const langDirs = await FileSystemService.findLangDirectories(assetsDir);
      if (langDirs.length === 0) {
        throw new ProcessingError('No "lang" directories found in assets', ErrorCode.JAR_PROCESSING_FAILED, { assetsDir });
      }

      console.log(`📁 Found ${langDirs.length} lang directories:`, langDirs.map(dir => dir.path));

      const processingStats = await this.processLangDirectories(langDirs, options, uniqueTempDir);

      const newJarPath = await this.createModifiedJar(uniqueTempDir, jarPath);

      console.log(`✅ JAR processing completed successfully`);
      
      await FileSystemService.safeDelete(jarPath);
      await FileSystemService.safeDelete(uniqueTempDir, true);

      return { 
        success: true, 
        finalJarPath: newJarPath,
        processedFiles: processingStats.total,
        processedJsonFiles: processingStats.json,
        processedLangFiles: processingStats.lang
      };

    } catch (error: any) {
      await FileSystemService.safeDelete(jarPath);
      if (fs.existsSync(uniqueTempDir)) {
        await FileSystemService.safeDelete(uniqueTempDir, true);
      }

      console.error('❌ JAR processing failed:', error.message);
      throw error instanceof AppError ? error : new ProcessingError(error.message, ErrorCode.JAR_PROCESSING_FAILED);
    }
  }

  private async extractJar(jarPath: string, targetDir: string): Promise<void> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);
      zip.extractAllTo(targetDir, true);
      console.log(`📦 JAR extracted to: ${targetDir}`);
    } catch (error: any) {
      throw new ProcessingError(`Failed to extract JAR: ${error.message}`, ErrorCode.JAR_PROCESSING_FAILED, { jarPath });
    }
  }

  private async processLangDirectories(langDirs: LangDirectoryInfo[], options: TranslationOptions, tempDir: string): Promise<{ total: number; json: number; lang: number }> {
    let totalProcessed = 0;
    let jsonCount = 0;
    let langCount = 0;

    for (const langDir of langDirs) {
      try {
        console.log(`🌍 Processing lang directory: ${langDir.path}`);
        
        if (!langDir.exists) continue;

        // Обработка JSON файлов
        if (langDir.enUsFile && fs.existsSync(langDir.enUsFile)) {
          try {
            await FileSystemService.validateAndCleanJson(langDir.enUsFile);
            
            let translatedResult;
            
            if (options.translateMethod === 'ai') {
              console.log('🤖 Using AI translation for JSON file');
              const descriptions = await this.packParserService.extractDescriptions(tempDir);
              translatedResult = await this.aiTranslationService.translateJsonFile(langDir.enUsFile, options, descriptions);
            } else {
              console.log('⚙️ Using local translation for JSON file');
              translatedResult = await this.localTranslationService.translateJsonFile(langDir.enUsFile, options);
            }

            if (translatedResult.success && translatedResult.data && langDir.ruRuFile) {
              await fs.promises.writeFile(langDir.ruRuFile, JSON.stringify(translatedResult.data, null, 4), 'utf8');
              console.log(`✅ JSON translation saved to: ${langDir.ruRuFile}`);
              jsonCount++;
              totalProcessed++;
            }
          } catch (error: any) {
            console.error(`❌ Failed to process JSON file ${langDir.enUsFile}:`, error.message);
          }
        }

      } catch (error: any) {
        console.error(`❌ Failed to process lang directory ${langDir.path}:`, error.message);
      }
    }

    console.log(`📊 Processing summary: ${totalProcessed} total files (${jsonCount} JSON, ${langCount} .lang)`);
    return { total: totalProcessed, json: jsonCount, lang: langCount };
  }

  private async createModifiedJar(sourceDir: string, originalJarPath: string): Promise<string> {
    const newJarName = `${path.basename(originalJarPath, path.extname(originalJarPath))}_modified.jar`;
    const newJarPath = path.join(process.cwd(), newJarName);
    
    await FileSystemService.createJar(sourceDir, newJarPath);
    return newJarPath;
  }
}