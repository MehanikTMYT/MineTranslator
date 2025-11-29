// src/services/ImprovedJarProcessingService.ts
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/config';
import { FileSystemService } from './file/FileSystemService';
import { AiTranslationService } from './ai/AiTranslationService';
import { LocalTranslationService } from './translation/LocalTranslationService';
import { PackParserService } from './PackParserService';
import { ProcessingError, AppError } from '../utils/errorUtils';
import { TranslationOptions, JarProcessingResult, LangDirectoryInfo, ErrorCode } from '../utils/types';
import { logger } from '../utils/logger';

export class ImprovedJarProcessingService {
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

    let processingSuccess = false;
    let newJarPath: string | undefined;

    try {
      logger.info('Starting JAR processing', { jarPath, options });

      // Validate input file before processing
      await this.validateInputFile(jarPath);

      await FileSystemService.ensureDirectoryExists(uniqueTempDir);

      await this.extractJar(jarPath, uniqueTempDir);

      const assetsDir = path.join(uniqueTempDir, 'assets');
      if (!await FileSystemService.pathExists(assetsDir)) {
        throw new ProcessingError('Missing "assets" directory in JAR archive', ErrorCode.JAR_PROCESSING_FAILED, { jarPath });
      }

      const langDirs = await FileSystemService.findLangDirectoriesAsync(assetsDir);
      if (langDirs.length === 0) {
        throw new ProcessingError('No "lang" directories found in assets', ErrorCode.JAR_PROCESSING_FAILED, { assetsDir });
      }

      logger.info('Found lang directories', { count: langDirs.length, directories: langDirs.map(dir => dir.path) });

      const processingStats = await this.processLangDirectories(langDirs, options, uniqueTempDir);

      newJarPath = await this.createModifiedJar(uniqueTempDir, jarPath);

      logger.info('JAR processing completed successfully', { 
        processedFiles: processingStats.total,
        processedJsonFiles: processingStats.json,
        processedLangFiles: processingStats.lang 
      });
      
      processingSuccess = true;
      
      return { 
        success: true, 
        finalJarPath: newJarPath,
        processedFiles: processingStats.total,
        processedJsonFiles: processingStats.json,
        processedLangFiles: processingStats.lang
      };

    } catch (error: any) {
      logger.error('JAR processing failed', { 
        error: error instanceof AppError ? error.toJSON() : error.message,
        jarPath,
        options
      });

      // Cleanup on failure
      await this.cleanupTempFiles(jarPath, uniqueTempDir);
      throw error instanceof AppError ? error : new ProcessingError(error.message, ErrorCode.JAR_PROCESSING_FAILED);
    } finally {
      // Cleanup original file if processing was successful
      if (processingSuccess) {
        await FileSystemService.safeDeleteAsync(jarPath);
        await FileSystemService.safeDeleteAsync(uniqueTempDir, true);
      }
    }
  }

  private async validateInputFile(jarPath: string): Promise<void> {
    // Check if file exists
    if (!await FileSystemService.pathExists(jarPath)) {
      throw new ProcessingError(`File does not exist: ${jarPath}`, ErrorCode.FILE_NOT_FOUND);
    }

    // Check file size
    const stats = await fs.stat(jarPath);
    if (stats.size === 0) {
      throw new ProcessingError(`File is empty: ${jarPath}`, ErrorCode.JAR_PROCESSING_FAILED);
    }

    if (stats.size > config.limits.maxFileSize) {
      throw new ProcessingError(
        `File too large: ${stats.size} bytes (max: ${config.limits.maxFileSize})`, 
        ErrorCode.JAR_PROCESSING_FAILED
      );
    }

    // Validate file extension
    const ext = path.extname(jarPath).toLowerCase();
    if (ext !== '.jar') {
      throw new ProcessingError(`Invalid file extension: ${ext}`, ErrorCode.JAR_PROCESSING_FAILED);
    }

    // Validate JAR content (basic check)
    const isValidJar = await this.validateJarContent(jarPath);
    if (!isValidJar) {
      throw new ProcessingError(`File is not a valid JAR archive: ${jarPath}`, ErrorCode.JAR_PROCESSING_FAILED);
    }
  }

  private async validateJarContent(jarPath: string): Promise<boolean> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);
      // Test if we can read the zip structure
      const zipEntries = zip.getEntries();
      return zipEntries.length > 0;
    } catch (error) {
      logger.warn('Invalid JAR content detected', { jarPath, error: error.message });
      return false;
    }
  }

  private async extractJar(jarPath: string, targetDir: string): Promise<void> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);
      zip.extractAllTo(targetDir, true);
      logger.debug('JAR extracted successfully', { jarPath, targetDir });
    } catch (error: any) {
      logger.error('Failed to extract JAR', { jarPath, error: error.message });
      throw new ProcessingError(`Failed to extract JAR: ${error.message}`, ErrorCode.JAR_PROCESSING_FAILED, { jarPath });
    }
  }

  private async processLangDirectories(
    langDirs: LangDirectoryInfo[], 
    options: TranslationOptions, 
    tempDir: string
  ): Promise<{ total: number; json: number; lang: number }> {
    let totalProcessed = 0;
    let jsonCount = 0;
    let langCount = 0;

    for (const langDir of langDirs) {
      try {
        logger.debug('Processing lang directory', { path: langDir.path });
        
        if (!langDir.exists) continue;

        // Process JSON files
        if (langDir.enUsFile && await FileSystemService.pathExists(langDir.enUsFile)) {
          try {
            await FileSystemService.validateAndCleanJsonAsync(langDir.enUsFile);
            
            let translatedResult;

            if (options.translateMethod === 'ai') {
              logger.info('Using AI translation for JSON file', { file: langDir.enUsFile });
              const descriptions = await this.packParserService.extractDescriptions(tempDir);
              translatedResult = await this.aiTranslationService.translateJsonFile(langDir.enUsFile, options, descriptions);
            } else {
              logger.info('Using local translation for JSON file', { file: langDir.enUsFile });
              translatedResult = await this.localTranslationService.translateJsonFile(langDir.enUsFile, options);
            }

            if (translatedResult.success && translatedResult.data && langDir.ruRuFile) {
              await fs.writeFile(langDir.ruRuFile, JSON.stringify(translatedResult.data, null, 4), 'utf8');
              logger.info('JSON translation saved', { file: langDir.ruRuFile });
              jsonCount++;
              totalProcessed++;
            }
          } catch (error: any) {
            logger.error('Failed to process JSON file', { 
              file: langDir.enUsFile, 
              error: error.message 
            });
          }
        }

      } catch (error: any) {
        logger.error('Failed to process lang directory', { 
          path: langDir.path, 
          error: error.message 
        });
      }
    }

    logger.info('Language directory processing summary', { 
      totalProcessed, 
      jsonCount, 
      langCount 
    });
    
    return { total: totalProcessed, json: jsonCount, lang: langCount };
  }

  private async createModifiedJar(sourceDir: string, originalJarPath: string): Promise<string> {
    const newJarName = `${path.basename(originalJarPath, path.extname(originalJarPath))}_modified.jar`;
    const newJarPath = path.join(process.cwd(), newJarName);
    
    await FileSystemService.createJarAsync(sourceDir, newJarPath);
    return newJarPath;
  }

  private async cleanupTempFiles(originalJarPath: string, tempDir: string): Promise<void> {
    try {
      // Delete original file if it still exists
      if (await FileSystemService.pathExists(originalJarPath)) {
        await FileSystemService.safeDeleteAsync(originalJarPath);
      }
      
      // Delete temp directory if it still exists
      if (await FileSystemService.pathExists(tempDir)) {
        await FileSystemService.safeDeleteAsync(tempDir, true);
      }
    } catch (cleanupError) {
      logger.error('Error during cleanup', { error: cleanupError.message });
    }
  }
}