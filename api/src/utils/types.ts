// src/utils/types.ts
export interface TranslationOptions {
  fb: 'yes' | 'no';
  cl: number;
  m: 'google' | 'google2' | 'bing';
  f: string;
  t: string;
  translateMethod: 'local' | 'ai';
  aiProvider?: 'openrouter' | 'ollama';
  fileType?: 'json' | 'lang';
}

export interface TranslationRequest {
  sourceLang: string;
  targetLang: string;
  keys: string[];
  texts: Record<string, string>;
  methods?: ('local' | 'ai')[];
  modules?: ('google' | 'google2' | 'bing')[];
  fallbackOptions?: ('yes' | 'no')[];
  aiProvider?: string; 
}

export interface TranslationResponse {
  translations: Record<string, string>;
  metadata: {
    provider: string;
    model?: string;
    processingTime: number;
    tokensUsed?: number;
    successfulKeys: number;
    failedKeys: number;
    fallbackUsed?: boolean;
    cacheHits?: number;
    cacheMisses?: number;
  };
  errors: any[];
}

export type TranslationMethod = 'local' | 'ai';
export type TranslationModule = 'google' | 'google2' | 'bing';
export type SupportedLanguage = string;

export interface SecurityConfig {
  allowedFileExtensions: string[];
  maxUploadFiles: number;
  enableRateLimiting: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enablePathValidation: boolean;
  enableFileValidation: boolean;
}

export interface ApiLimits {
  rate_limit: {
    requests: number;
    interval: string;
  };
  credits?: {
    remaining: number;
    total: number;
  };
}

export interface TranslationResult {
  success: boolean;
  data?: Record<string, string>;
  translatedData?: Record<string, string>;
  error?: string;
  filePath?: string;
  fileType?: 'json' | 'lang';
  successfulTranslations?: Record<string, string>;
  failedTranslations?: any[];
}

export interface JarProcessingResult {
  success: boolean;
  finalJarPath?: string;
  error?: string;
  processedFiles?: number;
  processedJsonFiles?: number;
  processedLangFiles?: number;
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_LANG_FORMAT = 'INVALID_LANG_FORMAT',
  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  JAR_PROCESSING_FAILED = 'JAR_PROCESSING_FAILED',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MAX_ATTEMPTS_EXCEEDED = 'MAX_ATTEMPTS_EXCEEDED',
  NO_API_KEYS_AVAILABLE = 'NO_API_KEYS_AVAILABLE',
  FILE_TYPE_NOT_SUPPORTED = 'FILE_TYPE_NOT_SUPPORTED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

export interface FileInfo {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface LangDirectoryInfo {
  path: string;
  enUsFile?: string;
  ruRuFile?: string;
  exists: boolean;
  files?: {
    json: string[];
    lang: string[];
  };
}

export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  api: {
    openrouter: {
      baseURL: string;
      model: string;
      keys: string[];
    };
    ollama: {
      baseURL: string;
      model: string;
      timeout: number;
      healthCheckTimeout: number;
    };
  };
  paths: {
    tempDir: string;
    uploadDir: string;
    logsDir: string;
  };
  translation: {
    supportedLanguages: string[];
    methods: ('local' | 'ai')[];
    modules: ('google' | 'google2' | 'bing')[];
    fallbackOptions: ('yes' | 'no')[];
    aiProviders: ('openrouter' | 'ollama')[];
    maxLangKeysPerFile: number;
    skipEmptyValues: boolean;
  };
  limits: {
    maxFileSize: number;
    maxConcurrentRequests: number;
    requestTimeout: number;
    maxRetriesPerKey: number;
    maxOllamaRetries: number;
  };
  security: SecurityConfig;
  batchProcessing: {
    openrouter: {
      maxBatchSize: number;
      maxConcurrent: number;
      delayBetweenBatches: number;
    };
    ollama: {
      maxBatchSize: number;
      maxConcurrent: number;
      delayBetweenBatches: number;
      minRequestInterval: number;
    };
  };
  modelSettings: {
    openrouter: {
      maxTokens: number;
      temperature: number;
    };
    ollama: {
      numCtx: number;
      numPredict: number;
      temperature: number;
      topP: number;
      repeatPenalty: number;
    };
  };
  fileProcessing: {
    supportedExtensions: string[];
  };
}

export interface ModMetadata {
  modId: string;
  version: string;
  displayName: string;
  description?: string;
  authors?: string[];
  credits?: string;
  license?: string;
  logoFile?: string;
  source?: string;
  filePath?: string;
}

export interface LangFileEntry {
  key: string;
  value: string;
  comment?: string;
  lineNumber: number;
}

export interface LangFileContent {
  entries: LangFileEntry[];
  comments: string[];
  headerComments: string[];
}