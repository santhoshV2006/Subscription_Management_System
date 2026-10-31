const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./config/database');
const { initializeMailer } = require('./utils/email');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────────

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  }
});

// Apply rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api', generalLimiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── API Routes ─────────────────────────────────────────────────────────────────

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/taxes', require('./routes/taxes'));
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/pricing', require('./routes/pricing'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Brightloop API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ─── Catch-all: Serve frontend for SPA routes ──────────────────────────────────

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  } else {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found.'
    });
  }
});

// ─── Global Error Handler ───────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.'
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────────

async function start() {
  try {
    // Initialize database
    initializeDatabase();
    console.log('✅ Database initialized');

    // Initialize mailer
    await initializeMailer();
    console.log('✅ Mailer initialized');

    app.listen(PORT, () => {
      console.log(`\n🚀 Brightloop API Server running on http://localhost:${PORT}`);
      console.log(`📁 Frontend served from http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
