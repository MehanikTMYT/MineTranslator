# Minecraft Mod Translator - Refactoring Plan

## Project Overview
This is a Minecraft mod translation system with an API server (Node.js/TypeScript) and a client (Python) that processes JAR files to translate Minecraft mod content using both local and AI translation methods.

## Critical Issues & Improvements Needed

### 1. **Architecture & Structure Issues**

#### Current Problems:
- Tight coupling between services and components
- Missing dependency injection pattern
- No clear separation of concerns in some services
- Hardcoded dependencies in config file

#### Recommended Changes:
```typescript
// Create dependency injection container
// src/container/DependencyContainer.ts
import { Container } from 'typedi';
import { JarProcessingService } from '../services/JarProcessingService';
import { AiTranslationService } from '../services/ai/AiTranslationService';
// ... other services

export const setupDependencies = () => {
  Container.set(JarProcessingService, new JarProcessingService());
  Container.set(AiTranslationService, new AiTranslationService());
  // ... register other dependencies
};
```

### 2. **Security Improvements**

#### Current Problems:
- Dynamic require() usage in config file
- File upload without proper content validation
- Potential path traversal vulnerabilities
- Missing input sanitization

#### Recommended Changes:
```typescript
// src/middleware/securityMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import path from 'path';

export const validateFilePath = (filePath: string): boolean => {
  const resolvedPath = path.resolve(filePath);
  const baseDir = path.resolve(config.paths.uploadDir);
  return resolvedPath.startsWith(baseDir);
};

export const sanitizeFileName = (filename: string): string => {
  // Remove dangerous characters and normalize
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/(\.\.\/)+/g, '');
};
```

### 3. **Performance Optimizations**

#### Current Problems:
- Synchronous file operations in critical paths
- Inefficient memory usage during large file processing
- No caching mechanism for frequently accessed data
- Blocking operations in translation loops

#### Recommended Changes:
```typescript
// src/services/file/AsyncFileService.ts
import fs from 'fs/promises';

export class AsyncFileService {
  static async readFileAsync(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  static async writeFileAsync(filePath: string, data: string): Promise<void> {
    return await fs.writeFile(filePath, data, 'utf-8');
  }

  static async processLargeJsonFile(filePath: string, processor: (chunk: any) => any): Promise<void> {
    // Use streaming for large JSON files
    const data = await this.readFileAsync(filePath);
    const jsonData = JSON.parse(data);
    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < Object.keys(jsonData).length; i += batchSize) {
      const batch = Object.fromEntries(
        Object.entries(jsonData).slice(i, i + batchSize)
      );
      await processor(batch);
    }
  }
}
```

### 4. **Error Handling Improvements**

#### Current Problems:
- Inconsistent error handling patterns
- Missing error context in some cases
- Generic error messages that don't help debugging

#### Recommended Changes:
```typescript
// src/utils/EnhancedErrorUtils.ts
export class DetailedAppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, any>;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly stackTrace: string;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details: Record<string, any> = {},
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.context = context;
    this.timestamp = new Date();
    this.stackTrace = new Error().stack || '';
    
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, DetailedAppError.prototype);
  }

  toJSON() {
    return {
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: process.env.NODE_ENV === 'development' ? this.stackTrace : undefined
    };
  }
}
```

### 5. **Configuration Management**

#### Current Problems:
- Configuration is a static object with dynamic loading
- No validation of configuration values
- Missing environment-specific configurations

#### Recommended Changes:
```typescript
// src/config/validatedConfig.ts
import Joi from 'joi';

const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().port().default(8250),
    host: Joi.string().default('0.0.0.0'),
  }).required(),
  api: Joi.object({
    openrouter: Joi.object({
      baseURL: Joi.string().uri().default('https://openrouter.ai/api/v1'),
      model: Joi.string().default('meta-llama/llama-3.1-405b-instruct:free'),
      keys: Joi.array().items(Joi.string()).default([]),
    }).required(),
    // ... other API configs
  }).required(),
  // ... rest of config
});

export const loadValidatedConfig = () => {
  const { error, value: validatedConfig } = configSchema.validate(process.env);
  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }
  return validatedConfig;
};
```

### 6. **Testing & Monitoring**

#### Current Problems:
- No automated tests
- Limited monitoring capabilities
- No performance metrics

#### Recommended Changes:
```typescript
// Add Jest configuration and tests
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};

// Example test file
// src/services/__tests__/JarProcessingService.test.ts
import { JarProcessingService } from '../JarProcessingService';

describe('JarProcessingService', () => {
  let service: JarProcessingService;

  beforeEach(() => {
    service = new JarProcessingService();
  });

  it('should process valid jar file successfully', async () => {
    // Test implementation
  });
});
```

### 7. **Logging & Monitoring**

#### Current Problems:
- Console.log used instead of proper logging
- No structured logging
- No log levels or rotation

#### Recommended Changes:
```typescript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'minecraft-mod-translator' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
```

### 8. **API Design Improvements**

#### Current Problems:
- Inconsistent API response format
- Missing proper status codes
- No API versioning

#### Recommended Changes:
```typescript
// src/middleware/apiVersionMiddleware.ts
export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const version = req.headers['api-version'] || req.query.version || 'v1';
  req.apiVersion = version;
  next();
};

// Standardized response format
export const sendSuccess = (res: Response, data: any, statusCode: number = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    version: res.req?.apiVersion || 'v1'
  });
};

export const sendError = (res: Response, error: AppError) => {
  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    }
  });
};
```

### 9. **Client-Side Improvements (Python)**

#### Current Problems:
- Large monolithic file
- Missing type hints
- Inefficient error handling

#### Recommended Changes:
```python
# Split into modules
# client/core/translator_client.py
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class MinecraftTranslatorClient:
    def __init__(self, base_url: str = "http://localhost:8250/process"):
        self.base_url = base_url
        self.session = self._create_session()
        
    def _create_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session
        
    def translate_jar(self, file_path: Path, params: Dict[str, str]) -> bool:
        # Implementation
        pass
```

### 10. **Documentation & Type Safety**

#### Current Problems:
- Missing JSDoc comments
- Inconsistent type usage
- No API documentation

#### Recommended Changes:
```typescript
/**
 * Processes a JAR file by extracting, translating language files, and repackaging
 * @param jarPath - Path to the input JAR file
 * @param options - Translation options including source/target languages, method, etc.
 * @returns Promise resolving to processing result with success status and file paths
 * @throws ProcessingError if the JAR file is invalid or processing fails
 */
async processJar(jarPath: string, options: TranslationOptions): Promise<JarProcessingResult> {
  // Implementation
}
```

### 11. **Build & Deployment Improvements**

#### Recommended Changes:
```dockerfile
# Dockerfile improvements
FROM node:18-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS dependencies
COPY api/package*.json ./
RUN npm ci --only=production

# Build stage
FROM base AS build
COPY api/package*.json ./
RUN npm ci
COPY api/ .
RUN npm run build

# Production stage
FROM base AS production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY api/package*.json ./

EXPOSE 8250
CMD ["node", "dist/server.js"]
```

### 12. **Code Quality & Linting**

#### Current Problems:
- Inconsistent code style
- No automated formatting
- Missing linting rules

#### Recommended Changes:
```json
// .eslintrc.json improvements
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

## Implementation Priority

### Phase 1 (Critical Security & Performance)
1. Security improvements (input validation, path sanitization)
2. Performance optimizations (async operations, memory management)
3. Error handling improvements

### Phase 2 (Architecture & Maintainability)
4. Dependency injection implementation
5. Configuration validation
6. Code structure improvements

### Phase 3 (Testing & Monitoring)
7. Test suite implementation
8. Logging improvements
9. Monitoring setup

### Phase 4 (Enhancements)
10. API improvements
11. Documentation updates
12. Client-side improvements

## Summary

This refactoring plan addresses critical security, performance, and maintainability issues while preserving the core functionality of the Minecraft mod translation system. The changes will make the codebase more robust, secure, and easier to maintain and extend in the future.