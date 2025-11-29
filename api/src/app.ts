// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config, ensureDirectories } from './config/config';
import jarRoutes from './routes/jarRoutes';
import { errorHandler, notFoundHandler } from './utils/errorUtils';

export class Application {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.initialize();
  }

  private setupMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: false,
    }));

    this.app.use(cors({
      origin: process.env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true
    }));

    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use('/uploads', express.static(config.paths.uploadDir, { fallthrough: false, index: false}));
    this.app.use('/logs', express.static(config.paths.logsDir, { fallthrough: false, index: false }));
  }

  private setupRoutes(): void {
    this.app.get('/', (_, res) => {
      res.json({
        name: 'Minecraft Mod Translator',
        version: '3.0.0',
        status: 'online',
        uptime: process.uptime(),
        endpoints: {
          'POST /process': 'Upload and process JAR file for translation'
        }
      });
    });

    this.app.use('/process', jarRoutes);
    this.app.use('*', notFoundHandler);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private initialize(): void {
    ensureDirectories();

    console.log('🔧 Application initialized with configuration:', {
      port: config.server.port,
      tempDir: config.paths.tempDir,
      uploadDir: config.paths.uploadDir,
      apiKeys: config.api.openrouter.keys.length,
      supportedLanguages: config.translation.supportedLanguages.length
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(config.server.port, config.server.host, () => {
        console.log(`🚀 Server started on http://${config.server.host}:${config.server.port}`);
        console.log(`📁 Temp directory: ${config.paths.tempDir}`);
        console.log(`📤 Upload directory: ${config.paths.uploadDir}`);
        console.log(`🔑 AI API keys available: ${config.api.openrouter.keys.length}`);
        
        if (config.api.openrouter.keys.length === 0) {
          console.warn('⚠️ No AI API keys configured. AI translation will not work.');
        }

        resolve();
      });

      process.on('SIGINT', () => {
        console.log('🛑 Shutting down server...');
        server.close(() => {
          console.log('✅ Server shut down gracefully');
          process.exit(0);
        });
      });
    });
  }
}