// src/services/PackParserService.ts
import fs from 'fs';
import path from 'path';
import { TomlParserService } from './file/TomlParserService';
import { ModMetadata } from '../utils/types';

export class PackParserService {
  private tomlParserService: TomlParserService;

  constructor() {
    this.tomlParserService = new TomlParserService();
  }

  async extractDescriptions(rootDir: string): Promise<string[]> {
    try {
      const descriptions: string[] = [];
      
      console.log(`📂 Starting mod description extraction from: ${rootDir}`);
      
      const modMetadata = await this.extractModMetadata(rootDir);
      
      if (modMetadata.length > 0) {
        console.log(`🎯 Found ${modMetadata.length} mod metadata files`);
        
        for (const metadata of modMetadata) {
          const descriptionText = this.formatModDescription(metadata);
          if (descriptionText) {
            descriptions.push(descriptionText);
          }
        }
      } else {
        console.log('⚠️ No TOML metadata files found, falling back to legacy method');
      }

      console.log(`📜 Total descriptions found: ${descriptions.length}`);
      return descriptions;
    } catch (error: any) {
      console.error('❌ Error extracting descriptions:', error.message);
      return [];
    }
  }

  private async extractModMetadata(rootDir: string): Promise<ModMetadata[]> {
    const metadataList: ModMetadata[] = [];
    
    const metaInfDir = path.join(rootDir, 'META-INF');
    if (fs.existsSync(metaInfDir) && fs.statSync(metaInfDir).isDirectory()) {
      console.log(`🔍 Searching for mod metadata in META-INF: ${metaInfDir}`);
      const metaInfMetadata = await this.tomlParserService.findModMetadataInDirectory(metaInfDir);
      metadataList.push(...metaInfMetadata);
    }
    
    console.log(`🔍 Searching for mod metadata in root directory: ${rootDir}`);
    const rootMetadata = await this.tomlParserService.findModMetadataInDirectory(rootDir);
    metadataList.push(...rootMetadata);
    
    const modsDir = path.join(rootDir, 'mods');
    if (fs.existsSync(modsDir) && fs.statSync(modsDir).isDirectory()) {
      console.log(`🔍 Searching for mod metadata in mods directory: ${modsDir}`);
      const modsMetadata = await this.tomlParserService.findModMetadataInDirectory(modsDir);
      metadataList.push(...modsMetadata);
    }
    
    return metadataList;
  }

  private formatModDescription(metadata: ModMetadata): string {
    const parts: string[] = [];
    
    if (metadata.displayName) {
      parts.push(`Mod Name: ${metadata.displayName}`);
    }
    
    if (metadata.modId) {
      parts.push(`Mod ID: ${metadata.modId}`);
    }
    
    if (metadata.version) {
      parts.push(`Version: ${metadata.version}`);
    }
    
    if (metadata.description) {
      parts.push(`Description: ${metadata.description}`);
    }
    
    if (metadata.authors && metadata.authors.length > 0) {
      parts.push(`Authors: ${metadata.authors.join(', ')}`);
    }
    
    if (metadata.credits) {
      parts.push(`Credits: ${metadata.credits}`);
    }
    
    if (metadata.license) {
      parts.push(`License: ${metadata.license}`);
    }
    
    if (parts.length === 0) {
      return '';
    }
    
    return parts.join('\n');
  }
}