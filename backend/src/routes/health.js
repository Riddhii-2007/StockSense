import express from 'express';

const router = express.Router();

// GET /api/health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'StockSense backend is running',
  });
});

export default router;
