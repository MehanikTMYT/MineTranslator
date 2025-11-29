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
    super(message, code, 400, details);
  }
}

export class TranslationError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.TRANSLATION_FAILED, details: Record<string, any> = {}) {
    super(message, code, 400, details);
  }
}

export class ApiError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.API_ERROR, statusCode: number = 500, details: Record<string, any> = {}) {
    super(message, code, statusCode, details);
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
  _: Response, 
  next: NextFunction
): void => {
  const error = new AppError(
    `Route not found: ${req.originalUrl}`,
    ErrorCode.VALIDATION_ERROR,
    404
  );
  next(error);
};