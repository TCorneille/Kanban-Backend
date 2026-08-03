const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fileUpload = require("express-fileupload");

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const boardRoutes = require('./routes/boardRoutes');
const taskRoutes = require('./routes/taskRoutes');
// const columnRoutes = require('./routes/columnRoutes');

const app = express();

/* =====================================================
    1. CORS CONFIGURATION
===================================================== */
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      callback(null, true); 
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

/* =====================================================
    2. MIDDLEWARES
===================================================== */
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(fileUpload({
  useTempFiles: false,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 },
}));

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log(`[${req.method}] ${req.originalUrl} - ${req.requestTime}`);
  next();
});

/* =====================================================
    3. MOUNT ROUTES
===================================================== */

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);
app.use('/api/v1/boards', boardRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/workspaces/:workspaceId/boards', boardRoutes);
// app.use('/api/v1/columns', columnRoutes);

/* =====================================================
    4. ERROR HANDLING
===================================================== */

// Catch-all for undefined routes
app.all(/.*/, (req, res, next) => {
  const err = new Error(`Cannot find ${req.originalUrl} on this server!`);
  err.statusCode = 404;
  err.status = 'fail'; 
  next(err);
});

// Global Error Middleware
app.use((err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;

  // 1. Log the original error for backend debugging
  console.error("GLOBAL ERROR LOG:", err);

  // 2. Handle Duplicate MongoDB Field Errors (e.g. Email already exists)
  if (error.code === 11000) {
    const value = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/)[0] : 'field value';
    error.message = `Duplicate field value: ${value}. Please use another value!`;
    error.statusCode = 400;
    error.status = 'fail';
  }

  // 3. Handle Mongoose Validation Errors (e.g. Password missing/mismatch)
  if (error.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    error.message = `Invalid input data. ${errors.join('. ')}`;
    error.statusCode = 400;
    error.status = 'fail';
  }

  // 4. Handle Invalid Database Object IDs (CastError)
  if (error.name === 'CastError') {
    error.message = `Invalid ${err.path}: ${err.value}.`;
    error.statusCode = 400;
    error.status = 'fail';
  }

  // 5. Handle JWT Errors
  if (error.name === 'JsonWebTokenError') {
    error.message = 'Invalid token. Please log in again!';
    error.statusCode = 401;
    error.status = 'fail';
  }

  if (error.name === 'TokenExpiredError') {
    error.message = 'Your token has expired! Please log in again.';
    error.statusCode = 401;
    error.status = 'fail';
  }

  // Ensure statusCode and status are valid formats
  let statusCode = 500;
  if (Number.isInteger(error.statusCode)) {
    statusCode = error.statusCode;
  } else if (Number.isInteger(err.statusCode)) {
    statusCode = err.statusCode;
  }

  const statusMessage = error.status && typeof error.status === 'string' 
    ? error.status 
    : (statusCode >= 400 && statusCode < 500 ? 'fail' : 'error');

  res.status(statusCode).json({
    status: statusMessage,
    success: false,
    message: error.message || "Internal Server Error",
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;