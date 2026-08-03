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

// Catch-all for undefined routes (Fixed: replaced '*' string with regex /.*/)
app.all(/.*/, (req, res, next) => {
  const err = new Error(`Cannot find ${req.originalUrl} on this server!`);
  err.statusCode = 404;
  err.status = 'fail'; 
  next(err);
});

// Global Error Middleware
app.use((err, req, res, next) => {
  // 1. Log the error for your own debugging
  console.error("GLOBAL ERROR:", err);

  // 2. Ensure statusCode is a valid NUMBER.
  // We check err.statusCode first, then err.status. If neither is a number, default to 500.
  let statusCode = 500;
  if (Number.isInteger(err.statusCode)) {
    statusCode = err.statusCode;
  } else if (Number.isInteger(err.status)) {
    statusCode = err.status;
  }

  // 3. Ensure the status message is a STRING (fail or error)
  const statusMessage = err.status && typeof err.status === 'string' 
    ? err.status 
    : (statusCode >= 400 && statusCode < 500 ? 'fail' : 'error');

  res.status(statusCode).json({
    status: statusMessage,
    success: false,
    message: err.message || "Internal Server Error",
    // Only reveal stack trace if you are in a local/dev environment
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;