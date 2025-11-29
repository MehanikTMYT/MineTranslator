// src/middleware/validationMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/config';
import { ValidationError } from '../utils/errorUtils';
import { TranslationOptions } from '../utils/types';
import path from 'path';

export const validateTranslationParams = (req: Request, _: Response, next: NextFunction): void => {
  try {
    const params: TranslationOptions = {
      fb: (req.body.fb || 'no') as 'yes' | 'no',
      cl: parseInt(req.body.cl || '3', 10),
      m: (req.body.m || 'google') as 'google' | 'google2' | 'bing',
      f: req.body.f || 'en',
      t: req.body.t || 'ru',
      translateMethod: (req.body.translateMethod || 'local') as 'local' | 'ai',
      aiProvider: req.body.aiProvider as 'openrouter' | 'ollama' | undefined,
    };

    if (!config.translation.fallbackOptions.includes(params.fb)) {
      throw new ValidationError(`Invalid fallback value: ${params.fb}. Must be one of: ${config.translation.fallbackOptions.join(', ')}`);
    }

    if (isNaN(params.cl) || params.cl < 0) {
      throw new ValidationError(`Invalid concurrency limit: ${params.cl}. Must be a non-negative number`);
    }

    if (!config.translation.modules.includes(params.m)) {
      throw new ValidationError(`Invalid module: ${params.m}. Must be one of: ${config.translation.modules.join(', ')}`);
    }

    if (!config.translation.supportedLanguages.includes(params.f)) {
      throw new ValidationError(`Invalid source language: ${params.f}. Must be a supported language code`);
    }

    if (!config.translation.supportedLanguages.includes(params.t)) {
      throw new ValidationError(`Invalid target language: ${params.t}. Must be a supported language code`);
    }

    if (!config.translation.methods.includes(params.translateMethod)) {
      throw new ValidationError(`Invalid translation method: ${params.translateMethod}. Must be one of: ${config.translation.methods.join(', ')}`);
    }

    if (params.translateMethod === 'ai') {
      if (!params.aiProvider) {
        params.aiProvider = 'openrouter';
        console.log('💡 AI provider not specified, using default: openrouter');
      }
      
      if (!config.translation.aiProviders.includes(params.aiProvider)) {
        throw new ValidationError(`Invalid AI provider: ${params.aiProvider}. Must be one of: ${config.translation.aiProviders.join(', ')}`);
      }

      if (params.aiProvider === 'openrouter' && !config.api.openrouter.keys.length) {
        throw new ValidationError('OpenRouter translation is not available. No API keys configured', { provider: params.aiProvider });
      }

      if (params.aiProvider === 'ollama') {
        console.log('🔍 Validating Ollama configuration');
        if (!config.api.ollama.baseURL || !config.api.ollama.model) {
          throw new ValidationError('Ollama configuration is incomplete. Check OLLAMA_BASE_URL and OLLAMA_MODEL environment variables', { provider: params.aiProvider });
        }
      }
    }

    req.body = params;
    next();
  } catch (error: any) {
    next(error);
  }
};

export const validateFileUpload = (req: Request, _: Response, next: NextFunction): void => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    if (path.extname(req.file.originalname).toLowerCase() !== '.jar') {
      throw new ValidationError('Only .jar files are allowed');
    }

    next();
  } catch (error: any) {
    next(error);
  }
};