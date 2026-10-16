import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDBHealth } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import postRoutes from './routes/post.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import aiRoutes from './routes/ai.routes.js';
import socialRoutes from './routes/social.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers with Helmet
app.use(helmet());

// CORS Configuration
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (such as mobile apps, curl, or Postman)
    if (!origin || origin === allowedOrigin || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked this origin'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Basic Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api', limiter);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// Baseline & Database Health Check Endpoint (Phase 1 & 2 verification)
app.get('/api/health', (req, res) => {
  const dbHealth = getDBHealth();

  res.status(200).json({
    success: true,
    service: 'AI-Powered Social Media Post Scheduler API',
    status: dbHealth.isConnected ? 'healthy' : 'database_disconnected',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: dbHealth,
    notes: dbHealth.isConnected
      ? 'All services and database operational'
      : 'Database is disconnected or connecting. Ensure MongoDB service or Atlas connection string is active.'
  });
});

// Root API Greeting
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the AI Social Media Scheduler API',
    version: '1.0.0',
    docs: '/api/health'
  });
});

// Authentication Routes (Phase 3)
app.use('/api/auth', authRoutes);

// Post Management Routes (Phase 4)
app.use('/api/posts', postRoutes);

// Dashboard Metrics Routes (Phase 4)
app.use('/api/dashboard', dashboardRoutes);

// AI Generation Routes (Phase 5)
app.use('/api/ai', aiRoutes);

// Social Media Integration Routes (Phase 6)
app.use('/api/social', socialRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Centralized Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error('[Global Error Handler]:', err.message || err);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;