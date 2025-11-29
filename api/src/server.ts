// src/server.ts
import { Application } from './app';

async function startServer(): Promise<void> {
  try {
    console.log('🔧 Starting application...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    const app = new Application();
    await app.start();

  } catch (error: any) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

startServer();

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught exception:', error.message);
  console.error('Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled rejection at:', promise);
  console.error('Reason:', reason);
});