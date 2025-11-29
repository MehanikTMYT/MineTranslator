// src/services/ai/OpenAIService.ts
import { OpenAI } from 'openai';
import { config } from '../../config/config';
import { ApiKeyManager } from './ApiKeyManager';
import { ApiError } from '../../utils/errorUtils';
import { ErrorCode, ApiLimits } from '../../utils/types';
import * as timeUtils from '../../utils/timeUtils';

export class OpenAIService {
  private apiKeyManager: ApiKeyManager;
  private apiLimits: ApiLimits | null = null;

  constructor() {
    this.apiKeyManager = new ApiKeyManager();
  }

  createInstance(): OpenAI {
    if (!this.apiKeyManager.hasKeys()) {
      throw new ApiError('No API keys available for OpenAI service', ErrorCode.NO_API_KEYS_AVAILABLE, 503);
    }

    return new OpenAI({
      baseURL: config.api.openrouter.baseURL,
      apiKey: this.apiKeyManager.currentKey,
    });
  }

  async checkApiLimits(): Promise<ApiLimits> {
    if (!this.apiKeyManager.hasKeys()) {
      throw new ApiError('No API keys available', ErrorCode.NO_API_KEYS_AVAILABLE, 503);
    }

    try {
      const response = await fetch(`${config.api.openrouter.baseURL}/auth/key`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKeyManager.currentKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          `API limits check failed: ${response.statusText}`,
          ErrorCode.API_ERROR,
          response.status,
          { response: errorData }
        );
      }

      const data = await response.json();
      this.apiLimits = data.data as ApiLimits;
      console.log(`📊 API Limits for current key:`, {
        requests: this.apiLimits.rate_limit.requests,
        interval: this.apiLimits.rate_limit.interval,
        credits: this.apiLimits.credits
      });
      return this.apiLimits;
    } catch (error: any) {
      console.error('❌ Error checking API limits:', error.message);
      throw error;
    }
  }

  async waitForRateLimit(): Promise<void> {
    if (!this.apiLimits?.rate_limit) return;

    if (this.apiLimits.rate_limit.requests <= 0) {
      const interval = parseInt(this.apiLimits.rate_limit.interval.replace('s', ''), 10) * 1000;
      console.log(`⏳ Rate limit reached. Waiting ${interval}ms...`);
      await timeUtils.sleep(interval);
      await this.checkApiLimits();
    }
  }

  decrementRequestCount(): void {
    if (this.apiLimits?.rate_limit) {
      this.apiLimits.rate_limit.requests = Math.max(0, this.apiLimits.rate_limit.requests - 1);
    }
  }

  getApiKeyManager(): ApiKeyManager {
    return this.apiKeyManager;
  }
}