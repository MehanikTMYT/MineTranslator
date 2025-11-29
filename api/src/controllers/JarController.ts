// src/controllers/JarController.ts
import { Request, Response, NextFunction } from 'express';
import { JarProcessingService } from '../services/JarProcessingService';
import { FileSystemService } from '../services/file/FileSystemService';
import path from 'path';
import { AppError, ValidationError } from '../utils/errorUtils';
import { ErrorCode } from '../utils/types';
import { config } from '../config/config';

export class JarController {
  private jarProcessingService: JarProcessingService;

  constructor() {
    this.jarProcessingService = new JarProcessingService();
  }

  async processJarFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    let jarPath: string | undefined;

    try {
      const options = req.body;
      jarPath = req.file?.path;

      if (!jarPath) {
        throw new ValidationError('No file uploaded', { body: req.body });
      }

      // Validate file path to prevent directory traversal
      const normalizedPath = path.normalize(jarPath);
      if (normalizedPath.includes('..') || !normalizedPath.startsWith(config.paths.uploadDir)) {
        throw new ValidationError('Invalid file path', { jarPath });
      }

      // Validate file extension
      const ext = path.extname(jarPath).toLowerCase();
      if (ext !== '.jar') {
        throw new ValidationError('Only .jar files are allowed', { jarPath });
      }

      console.log('🎯 Processing JAR file with parameters:', {
        fallback: options.fb,
        concurrency: options.cl,
        module: options.m,
        from: options.f,
        to: options.t,
        method: options.translateMethod
      });

      // Validate translation options
      if (!options.f || !options.t) {
        throw new ValidationError('Missing required translation parameters (from/to)', { 
          from: options.f, 
          to: options.t 
        });
      }

      const result = await this.jarProcessingService.processJar(jarPath, options);

      if (result.success && result.finalJarPath) {
        console.log(`📤 Sending processed file: ${result.finalJarPath}`);
        
        res.download(
          result.finalJarPath, 
          path.basename(result.finalJarPath),
          async (err) => {
            if (err) {
              console.error('❌ Error sending file:', err.message);
              if (result.finalJarPath) {
                try {
                  await FileSystemService.safeDelete(result.finalJarPath);
                } catch (deleteErr) {
                  console.error('❌ Error deleting processed file:', deleteErr);
                }
              }
              res.status(500).json({ 
                success: false, 
                error: 'Failed to send processed file' 
              });
              return;
            }
            // Clean up after successful download
            if (result.finalJarPath) {
              try {
                await FileSystemService.safeDelete(result.finalJarPath);
              } catch (deleteErr) {
                console.error('❌ Error deleting processed file after download:', deleteErr);
              }
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
      
      // Clean up uploaded file if processing failed
      if (jarPath) {
        try {
          await FileSystemService.safeDelete(jarPath);
        } catch (deleteErr) {
          console.error('❌ Error deleting uploaded file:', deleteErr);
        }
      }
      
      next(error);
    }
  }
}