// src/services/file/FileSystemService.ts
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { LangDirectoryInfo } from '../../utils/types';

export class FileSystemService {
  static safeDelete(targetPath: string, isDirectory: boolean = false): boolean {
    try {
      if (isDirectory) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      console.log(`🗑️ Deleted: ${targetPath}`);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.warn(`⚠️ Not found for deletion: ${targetPath}`);
        return false;
      }
      console.error(`❌ Error deleting ${targetPath}:`, err.message);
      throw err;
    }
  }

  static async validateAndCleanJson(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          return reject(new Error(`Error reading file: ${err.message}`));
        }

        try {
          const cleanedData = data.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').trim();
          JSON.parse(cleanedData);
          
          fs.writeFile(filePath, cleanedData, 'utf8', (writeErr) => {
            if (writeErr) {
              return reject(new Error(`Error writing file: ${writeErr.message}`));
            }
            console.log(`✅ JSON validated and cleaned: ${filePath}`);
            resolve();
          });
        } catch (parseErr: any) {
          reject(new Error(`Invalid JSON format in ${filePath}: ${parseErr.message}`));
        }
      });
    });
  }

  static findLangDirectories(dir: string): LangDirectoryInfo[] {
    const langDirs: LangDirectoryInfo[] = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        if (item === 'lang') {
          const enUsFile = path.join(itemPath, 'en_us.json');
          const ruRuFile = path.join(itemPath, 'ru_ru.json');
          
          langDirs.push({
            path: itemPath,
            enUsFile: fs.existsSync(enUsFile) ? enUsFile : undefined,
            ruRuFile: ruRuFile,
            exists: fs.existsSync(enUsFile)
          });
        } else {
          langDirs.push(...this.findLangDirectories(itemPath));
        }
      }
    }
    
    return langDirs;
  }

  static async createJar(sourceDir: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const zip = new AdmZip();
        
        function addFilesToZip(dir: string, baseDir: string): void {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const relativePath = path.relative(baseDir, filePath);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              addFilesToZip(filePath, baseDir);
            } else {
              zip.addLocalFile(filePath, path.dirname(relativePath));
              console.log(`📦 Added to JAR: ${relativePath}`);
            }
          }
        }
        
        addFilesToZip(sourceDir, sourceDir);
        zip.writeZip(outPath);
        console.log(`✅ JAR archive created: ${outPath}`);
        resolve();
      } catch (error: any) {
        reject(new Error(`Failed to create JAR archive: ${error.message}`));
      }
    });
  }

  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.mkdir(dirPath, { recursive: true }, (err) => {
        if (err) {
          reject(new Error(`Failed to create directory ${dirPath}: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }
}