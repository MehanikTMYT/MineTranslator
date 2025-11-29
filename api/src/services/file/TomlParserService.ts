// src/services/file/TomlParserService.ts
import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';
import { ModMetadata } from '../../utils/types';

export class TomlParserService {
  async parseModsToml(filePath: string): Promise<ModMetadata | null> {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`📄 mods.toml file not found at: ${filePath}`);
        return null;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsed = toml.parse(fileContent);
      
      console.log(`🔍 Parsed mods.toml content:`, parsed);
      
      const metadata: ModMetadata = {
        modId: String(parsed.modId || parsed.modid || 'unknown_mod'),
        version: String(parsed.version || '1.0.0'),
        displayName: String(parsed.displayName || parsed.displayname || parsed.name || 'Unknown Mod'),
        description: this.extractDescription(parsed),
        authors: this.extractAuthors(parsed),
        credits: parsed.credits ? String(parsed.credits) : undefined,
        license: parsed.license ? String(parsed.license) : undefined,
        logoFile: parsed.logoFile || parsed.logofile ? String(parsed.logoFile || parsed.logofile) : undefined,
        source: parsed.source || parsed.github || parsed.url ? String(parsed.source || parsed.github || parsed.url) : undefined,
        filePath: filePath
      };

      console.log(`✅ Successfully parsed mods.toml metadata:`, metadata);
      return metadata;
    } catch (error: any) {
      console.error(`❌ Error parsing mods.toml at ${filePath}:`, error.message);
      return null;
    }
  }

  async parseNeoforgeModsToml(filePath: string): Promise<ModMetadata | null> {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`📄 neoforge.mods.toml file not found at: ${filePath}`);
        return null;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsed = toml.parse(fileContent);
      
      console.log(`🔍 Parsed neoforge.mods.toml content:`, parsed);
      
      const metadata: ModMetadata = {
        modId: String(parsed.modId || parsed.modid || parsed.id || 'unknown_mod'),
        version: String(parsed.version || '1.0.0'),
        displayName: String(parsed.displayName || parsed.displayname || parsed.name || 'Unknown Mod'),
        description: this.extractDescription(parsed),
        authors: this.extractAuthors(parsed),
        credits: parsed.credits || parsed.attribution ? String(parsed.credits || parsed.attribution) : undefined,
        license: parsed.license ? String(parsed.license) : undefined,
        logoFile: parsed.logoFile || parsed.logofile ? String(parsed.logoFile || parsed.logofile) : undefined,
        source: parsed.source || parsed.repository || parsed.url ? String(parsed.source || parsed.repository || parsed.url) : undefined,
        filePath: filePath
      };

      console.log(`✅ Successfully parsed neoforge.mods.toml metadata:`, metadata);
      return metadata;
    } catch (error: any) {
      console.error(`❌ Error parsing neoforge.mods.toml at ${filePath}:`, error.message);
      return null;
    }
  }

  private extractDescription(parsed: any): string | undefined {
    const descriptionFields = [
      'description',
      'modDescription',
      'moddescription',
      'desc',
      'summary',
      'about'
    ];

    for (const field of descriptionFields) {
      if (parsed[field]) {
        return this.cleanDescription(String(parsed[field]));
      }
    }

    return undefined;
  }

  private extractAuthors(parsed: any): string[] {
    const authorsFields = [
      'authors',
      'author',
      'creator',
      'creators',
      'contributors'
    ];

    for (const field of authorsFields) {
      if (parsed[field]) {
        if (Array.isArray(parsed[field])) {
          return parsed[field].map((author: any) => String(author));
        } else if (typeof parsed[field] === 'string') {
          return [parsed[field]];
        }
        return [String(parsed[field])];
      }
    }

    return [];
  }

  private cleanDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .trim()
      .slice(0, 1000);
  }

  async findModMetadataInDirectory(dirPath: string): Promise<ModMetadata[]> {
    const metadataList: ModMetadata[] = [];
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          const subMetadata = await this.findModMetadataInDirectory(filePath);
          metadataList.push(...subMetadata);
        } else if (file.toLowerCase() === 'mods.toml' || file.toLowerCase() === 'neoforge.mods.toml') {
          console.log(`🔍 Found mod metadata file: ${filePath}`);
          
          let metadata: ModMetadata | null = null;
          
          if (file.toLowerCase() === 'mods.toml') {
            metadata = await this.parseModsToml(filePath);
          } else if (file.toLowerCase() === 'neoforge.mods.toml') {
            metadata = await this.parseNeoforgeModsToml(filePath);
          }
          
          if (metadata) {
            metadataList.push(metadata);
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Error searching for mod metadata in ${dirPath}:`, error.message);
    }
    
    return metadataList;
  }
}