// src/controllers/JarController.ts
import { Request, Response, NextFunction } from 'express';
import { JarProcessingService } from '../services/JarProcessingService';
import { FileSystemService } from '../services/file/FileSystemService';
import path from 'path';
import { AppError } from '../utils/errorUtils';
import { ErrorCode } from '../utils/types';

export class JarController {
  private jarProcessingService: JarProcessingService;

  constructor() {
    this.jarProcessingService = new JarProcessingService();
  }

  async processJarFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = req.body;
      const jarPath = req.file?.path;

      if (!jarPath) {
        throw new AppError('No file uploaded', ErrorCode.VALIDATION_ERROR, 400);
      }

      console.log('🎯 Processing JAR file with parameters:', {
        fallback: options.fb,
        concurrency: options.cl,
        module: options.m,
        from: options.f,
        to: options.t,
        method: options.translateMethod
      });

      const result = await this.jarProcessingService.processJar(jarPath, options);

      if (result.success && result.finalJarPath) {
        console.log(`📤 Sending processed file: ${result.finalJarPath}`);
        
        res.download(
          result.finalJarPath, 
          path.basename(result.finalJarPath),
          (err) => {
            if (err) {
              console.error('❌ Error sending file:', err.message);
              if (result.finalJarPath) {
                FileSystemService.safeDelete(result.finalJarPath);
              }
              res.status(500).json({ 
                success: false, 
                error: 'Failed to send processed file' 
              });
              return;
            }
            // Clean up after successful download
            if (result.finalJarPath) {
              FileSystemService.safeDelete(result.finalJarPath);
            }
          }
        );
        return;
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error || 'Processing failed' 
        });
        return;
      }

    } catch (error: any) {
      console.error('🔥 Controller error:', error);
      next(error);
    }
  }
}