import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import config, { connectDB } from './config/index.js';
import app from './app.js';
import { startScheduler, stopScheduler } from './services/scheduler.service.js';

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = config.port || 5000;

// Ensure upload directory exists
const uploadDirName = config.uploadDir || 'uploads';
const uploadDirPath = path.join(__dirname, '..', uploadDirName);
if (!fs.existsSync(uploadDirPath)) {
  fs.mkdirSync(uploadDirPath, { recursive: true });
}

// Bootstrap Server and Database Connection
const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Start background post scheduler
  const schedulerIntervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS) || 15000;
  startScheduler(schedulerIntervalMs);

  // Start HTTP Server
  const server = app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Server running in [${process.env.NODE_ENV || 'development'}] mode`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
    console.log('====================================================');
  });

  // Graceful shutdown handler
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    stopScheduler();
    server.close(async () => {
      console.log('🔌 HTTP server closed.');
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
        console.log('🍃 MongoDB connection closed.');
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

export default startServer();
