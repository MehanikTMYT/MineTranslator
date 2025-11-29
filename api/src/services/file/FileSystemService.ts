// src/services/file/FileSystemService.ts
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { LangDirectoryInfo } from '../../utils/types';
import { AppError } from '../../utils/errorUtils';
import { ErrorCode } from '../../utils/types';

export class FileSystemService {
  static async safeDelete(targetPath: string, isDirectory: boolean = false): Promise<boolean> {
    try {
      // Sanitize path to prevent directory traversal
      const normalizedPath = path.normalize(targetPath);
      if (normalizedPath.includes('..')) {
        throw new AppError('Invalid path: contains directory traversal', ErrorCode.VALIDATION_ERROR, 400);
      }

      if (isDirectory) {
        await fs.promises.rm(normalizedPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(normalizedPath);
      }
      console.log(`🗑️ Deleted: ${normalizedPath}`);
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
    // Sanitize path to prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      throw new AppError('Invalid path: contains directory traversal', ErrorCode.VALIDATION_ERROR, 400);
    }

    const data = await fs.promises.readFile(normalizedPath, 'utf8');
    const cleanedData = data.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').trim();

    try {
      JSON.parse(cleanedData);
      await fs.promises.writeFile(normalizedPath, cleanedData, 'utf8');
      console.log(`✅ JSON validated and cleaned: ${normalizedPath}`);
    } catch (parseErr: any) {
      throw new AppError(`Invalid JSON format in ${normalizedPath}: ${parseErr.message}`, ErrorCode.INVALID_JSON, 400);
    }
  }

  static async findLangDirectories(dir: string): Promise<LangDirectoryInfo[]> {
    // Sanitize path to prevent directory traversal
    const normalizedDir = path.normalize(dir);
    if (normalizedDir.includes('..')) {
      throw new AppError('Invalid path: contains directory traversal', ErrorCode.VALIDATION_ERROR, 400);
    }

    const langDirs: LangDirectoryInfo[] = [];
    const items = await fs.promises.readdir(normalizedDir);

    for (const item of items) {
      const itemPath = path.join(normalizedDir, item);
      const stat = await fs.promises.stat(itemPath);

      if (stat.isDirectory()) {
        if (item === 'lang') {
          const enUsFile = path.join(itemPath, 'en_us.json');
          const ruRuFile = path.join(itemPath, 'ru_ru.json');

          langDirs.push({
            path: itemPath,
            enUsFile: await this.fileExists(enUsFile) ? enUsFile : undefined,
            ruRuFile: ruRuFile,
            exists: await this.fileExists(enUsFile)
          });
        } else {
          const subLangDirs = await this.findLangDirectories(itemPath);
          langDirs.push(...subLangDirs);
        }
      }
    }

    return langDirs;
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async createJar(sourceDir: string, outPath: string): Promise<void> {
    // Sanitize paths to prevent directory traversal
    const normalizedSourceDir = path.normalize(sourceDir);
    const normalizedOutPath = path.normalize(outPath);

    if (normalizedSourceDir.includes('..') || normalizedOutPath.includes('..')) {
      throw new AppError('Invalid path: contains directory traversal', ErrorCode.VALIDATION_ERROR, 400);
    }

    const zip = new AdmZip();

    const addFilesToZip = async (dir: string, baseDir: string): Promise<void> => {
      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {
          await addFilesToZip(filePath, baseDir);
        } else {
          const relativePath = path.relative(baseDir, filePath);
          zip.addLocalFile(filePath, path.dirname(relativePath));
          console.log(`📦 Added to JAR: ${relativePath}`);
        }
      }
    };

    await addFilesToZip(normalizedSourceDir, normalizedSourceDir);
    zip.writeZip(normalizedOutPath);
    console.log(`✅ JAR archive created: ${normalizedOutPath}`);
  }

  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    // Sanitize path to prevent directory traversal
    const normalizedPath = path.normalize(dirPath);
    if (normalizedPath.includes('..')) {
      throw new AppError('Invalid path: contains directory traversal', ErrorCode.VALIDATION_ERROR, 400);
    }

    await fs.promises.mkdir(normalizedPath, { recursive: true });
  }
}