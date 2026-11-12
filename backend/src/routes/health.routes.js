import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// Basic API health check
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cinema Booking API is running',
    timestamp: new Date().toISOString(),
  });
});

// Database connectivity health check
router.get('/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'PostgreSQL connected successfully',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      database: 'disconnected',
    });
  }
});

export default router;

