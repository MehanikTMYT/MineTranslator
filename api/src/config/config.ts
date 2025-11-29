// src/config/config.ts
import dotenv from 'dotenv';
import path from 'path';
import { AppConfig } from '../utils/types';

dotenv.config();

export const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '8250', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  api: {
    openrouter: {
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-405b-instruct:free',
      keys: getOpenRouterKeys(),
    },
    ollama: {
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api/generate',
      model: process.env.OLLAMA_MODEL || 'deepseek-r1:8b',
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || '300000', 10),
      healthCheckTimeout: parseInt(process.env.OLLAMA_HEALTH_CHECK_TIMEOUT || '10000', 10),
    },
  },
  paths: {
    tempDir: path.resolve(process.env.TEMP_DIR || 'temp_processing'),
    uploadDir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
    logsDir: path.resolve(process.env.LOGS_DIR || 'logs'),
  },
  translation: {
    supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,ru,es,de,fr,it,pt,pl,zh-CN,ja,ko').split(','),
    methods: ['local', 'ai'] as ('local' | 'ai')[],
    modules: ['google', 'google2', 'bing'] as ('google' | 'google2' | 'bing')[],
    fallbackOptions: ['yes', 'no'] as ('yes' | 'no')[],
    aiProviders: ['openrouter', 'ollama'] as ('openrouter' | 'ollama')[],
    maxLangKeysPerFile: parseInt(process.env.MAX_LANG_KEYS_PER_FILE || '5000', 10),
    skipEmptyValues: process.env.SKIP_EMPTY_VALUES === 'true',
  },
  limits: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '50000000', 10), // 50MB
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '300000', 10), // 5 minutes
    maxRetriesPerKey: parseInt(process.env.MAX_RETRIES_PER_KEY || '3', 10),
    maxOllamaRetries: parseInt(process.env.MAX_OLLAMA_RETRIES || '2', 10),
  },
  security: {
    allowedFileExtensions: ['.jar'],
    maxUploadFiles: 1,
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    enablePathValidation: true,
    enableFileValidation: true,
  },
  batchProcessing: {
    openrouter: {
      maxBatchSize: parseInt(process.env.OPENROUTER_BATCH_SIZE || '20', 10),
      maxConcurrent: parseInt(process.env.OPENROUTER_MAX_CONCURRENT || '3', 10),
      delayBetweenBatches: parseInt(process.env.OPENROUTER_DELAY_BETWEEN_BATCHES || '1000', 10),
    },
    ollama: {
      maxBatchSize: parseInt(process.env.OLLAMA_BATCH_SIZE || '5', 10),
      maxConcurrent: parseInt(process.env.OLLAMA_MAX_CONCURRENT || '1', 10),
      delayBetweenBatches: parseInt(process.env.OLLAMA_DELAY_BETWEEN_BATCHES || '3000', 10),
      minRequestInterval: parseInt(process.env.OLLAMA_MIN_REQUEST_INTERVAL || '1000', 10),
    }
  },
  modelSettings: {
    openrouter: {
      maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '2000', 10),
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.1'),
    },
    ollama: {
      numCtx: parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10),
      numPredict: parseInt(process.env.OLLAMA_NUM_PREDICT || '2000', 10),
      temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.1'),
      topP: parseFloat(process.env.OLLAMA_TOP_P || '0.9'),
      repeatPenalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY || '1.1'),
    }
  },
  fileProcessing: {
    supportedExtensions: (process.env.SUPPORTED_FILE_EXTENSIONS || '.json,.lang').split(','),
  }
};

function getOpenRouterKeys(): string[] {
  const keys: string[] = [];
  const keysCount = parseInt(process.env.OPENROUTER_KEYS_COUNT || '0', 10);
  
  for (let i = 0; i < keysCount; i++) {
    const key = process.env[`OPENROUTER_KEY_${i}`];
    if (key && key.trim() !== '') {
      keys.push(key.trim());
    }
  }
  
  return keys;
}

export const ensureDirectories = (): void => {
  const fs = require('fs');
  const directories = [
    config.paths.tempDir,
    config.paths.uploadDir,
    config.paths.logsDir
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
};