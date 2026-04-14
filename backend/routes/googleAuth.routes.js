const express = require('express');
const createRateLimiter = require('../middleware/rateLimiter');
const { config } = require('../config/env');
const { googleAuthController } = require('../controllers/googleAuth.controller');

const router = express.Router();

const authRateLimiter = createRateLimiter({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  message: 'Too many authentication attempts. Please try again later.',
});

router.use(authRateLimiter);

router.post('/google', googleAuthController);

module.exports = router;
