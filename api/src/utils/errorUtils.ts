// src/utils/errorUtils.ts
import { NextFunction, Request, Response } from 'express';
import { ErrorCode } from './types';

export class AppError extends Error {
  public readonly name: string;
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code?: ErrorCode,
    statusCode: number = 500,
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || ErrorCode.INTERNAL_SERVER_ERROR;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.JAR_PROCESSING_FAILED, details: Record<string, any> = {}) {
    super(message, code, 500, details); // Changed from 400 to 500 for internal processing errors
  }
}

export class TranslationError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.TRANSLATION_FAILED, details: Record<string, any> = {}) {
    super(message, code, 500, details); // Changed from 400 to 500 for internal processing errors
  }
}

export class ApiError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.API_ERROR, statusCode: number = 500, details: Record<string, any> = {}) {
    super(message, code, statusCode, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.API_ERROR, 503, details);
  }
}

export class TranslationTimeoutError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.API_ERROR, 408, details);
  }
}

export class ModelNotFoundError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.API_ERROR, 404, details);
  }
}

export class UnsupportedLanguageError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class FileSizeLimitError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.VALIDATION_ERROR, 413, details);
  }
}

export class InvalidFileError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('🚨 Unhandled error:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        details: err.details,
        timestamp: err.timestamp.toISOString(),
      },
    });
    return;
  }

  // Handle specific error types
  if (err.name === 'SyntaxError' && err.message.includes('JSON')) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid JSON format in request body',
        code: ErrorCode.INVALID_JSON,
        statusCode: 400,
      },
    });
    return;
  }

  if (err.name === 'RangeError') {
    res.status(413).json({
      success: false,
      error: {
        message: 'Request entity too large',
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 413,
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      statusCode: 500,
    },
  });
  next();
};

export const notFoundHandler = ( 
  req: Request,
  res: Response, 
  next: NextFunction
): void => {
  const error = new AppError(
    `Route not found: ${req.originalUrl}`,
    ErrorCode.VALIDATION_ERROR,
    404
  );
  next(error);
};