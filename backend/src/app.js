import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { cookieParser, csrfProtection } from './middleware/cookie.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration (enables credentials for HTTP-only cookies)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body & Cookie parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser);

// CSRF Origin verification for state-changing requests
app.use(csrfProtection);

// Root health alias
app.use('/health', healthRoutes);

// Modular API routes
app.use('/api', apiRoutes);

// 404 Not Found handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
