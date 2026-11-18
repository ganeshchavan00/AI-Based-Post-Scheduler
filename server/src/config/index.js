import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDBHealth } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before accessing process.env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const rawBaseUrl = process.env.ZERNIO_BASE_URL || 'https://zernio.com/api';
const zernioBaseUrl = rawBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

// Support both FRONTEND_URL and CLIENT_URL, normalize without trailing slash
const rawFrontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
const clientUrl = rawFrontendUrl.split(',')[0].trim().replace(/\/+$/, '');

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: rawFrontendUrl,
  clientUrl,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_social_scheduler',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  zernioApiKey: process.env.ZERNIO_API_KEY || '',
  zernioBaseUrl,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
};

export { connectDB, getDBHealth };
export default config;
