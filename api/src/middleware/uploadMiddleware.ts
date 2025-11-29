// src/middleware/uploadMiddleware.ts
import multer from 'multer';
import path from 'path';
import { config } from '../config/config';
import { ValidationError } from '../utils/errorUtils';
import { NextFunction, Request, Response } from 'express';

export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => {
      cb(null, config.paths.uploadDir);
    },
    filename: (_, file, cb) => {
      const originalName = path.basename(file.originalname, path.extname(file.originalname));
      const uniqueName = `${originalName}_${Date.now()}_${Math.floor(Math.random() * 10000)}.jar`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: config.limits.maxFileSize
  },
  fileFilter: (_, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.jar') {
      cb(new ValidationError('Only .jar files are allowed', { file: file.originalname }) as any, false);
    } else {
      cb(null, true);
    }
  }
});

export const handleFileUploadError = (err: Error, _: Request, res: Response, next: NextFunction): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: {
          message: `File too large. Maximum size is ${config.limits.maxFileSize / 1000000}MB`,
          code: 'VALIDATION_ERROR',
          statusCode: 413,
        },
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: {
        message: `File upload error: ${err.message}`,
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      },
    });
    return;
  }
  next(err);
};