// src/services/ai/ApiKeyManager.ts
import { config } from '../../config/config';
import { ApiError } from '../../utils/errorUtils';
import { ErrorCode } from '../../utils/types';

export class ApiKeyManager {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;

  constructor() {
    this.apiKeys = config.api.openrouter.keys;
    if (this.apiKeys.length === 0) {
      console.warn('⚠️ No API keys configured. AI translation will not work.');
    }
  }

  get currentKey(): string {
    if (this.apiKeys.length === 0) {
      throw new ApiError('No API keys available', ErrorCode.NO_API_KEYS_AVAILABLE, 503);
    }
    return this.apiKeys[this.currentKeyIndex];
  }

  switchKey(): string {
    if (this.apiKeys.length === 0) {
      throw new ApiError('No API keys available', ErrorCode.NO_API_KEYS_AVAILABLE, 503);
    }
    
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`🔄 Switched to API key: ${this.currentKey.substring(0, 8)}...`);
    return this.currentKey;
  }

  hasKeys(): boolean {
    return this.apiKeys.length > 0;
  }

  reset(): void {
    this.currentKeyIndex = 0;
  }

  getKeyCount(): number {
    return this.apiKeys.length;
  }

  getCurrentKeyIndex(): number {
    return this.currentKeyIndex;
  }
}