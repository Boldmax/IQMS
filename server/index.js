require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const { connectDB } = require('./config/database');
const routes    = require('./routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── SECURITY ──────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// Trust proxy so req.ip is real IP behind nginx/load balancer
app.set('trust proxy', 1);

// CORS ─────────────────────────────────────────────────────────────────────────
// Build allowed origins list from CLIENT_URL env var (comma-separated).
// Always include localhost variants for development regardless of env var so
// the dev server (port 3000) and direct API calls (port 5000) both work.
const allowedOrigins = [
  ...(process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim()),
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server, same-origin
    // browser requests when the React build is served by Express itself)
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin === o || origin.startsWith(o))) {
      return cb(null, true);
    }
    // In development, allow all localhost regardless of port
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limit (auth endpoints have their own tighter limit in routes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
app.use('/api/', globalLimiter);

// ── BODY PARSING ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── LOGGING ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── STATIC FILES ──────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API ROUTES ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    version: '3.0.0',
    mode: 'saas-multitenant',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── SERVE REACT IN PRODUCTION ─────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found.` });
});

// ── START ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n✓ IQMS SaaS Server running on port ${PORT}`);
    console.log(`  API:    http://localhost:${PORT}/api`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
    console.log(`  Mode:   multi-tenant SaaS`);
    console.log(`  Env:    ${process.env.NODE_ENV || 'development'}\n`);
  });
};

start();
module.exports = app;
