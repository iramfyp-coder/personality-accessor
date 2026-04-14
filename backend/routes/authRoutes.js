const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { validateSignup, validateLogin } = require('../middleware/validateInput');
const createRateLimiter = require('../middleware/rateLimiter');
const { config } = require('../config/env');
const { sendSuccess } = require('../utils/response');
const { createHttpError } = require('../utils/httpError');
const { signAuthToken, serializeAuthUser } = require('../services/auth-token.service');

const router = express.Router();

const authRateLimiter = createRateLimiter({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  message: 'Too many authentication attempts. Please try again later.',
});

router.use(authRateLimiter);

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

router.post('/signup', validateSignup, async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createHttpError(400, 'User already exists'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      provider: 'local',
    });

    await user.save();

    console.info(`[AUTH] signup success userId=${user._id} email=${email}`);

    return sendSuccess(res, {
      status: 201,
      data: { userId: user._id, role: user.role },
      message: 'Account created',
    });
  } catch (error) {
    console.info(`[AUTH] signup failed email=${req.body?.email || 'unknown'}`);
    return next(error);
  }
});

router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return next(createHttpError(401, 'Invalid credentials'));
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return next(createHttpError(401, 'Invalid credentials'));
    }

    const token = signAuthToken(user);

    console.info(`[AUTH] login success userId=${user._id} email=${email}`);

    return sendSuccess(res, {
      data: {
        token,
        user: serializeAuthUser(user),
        userId: String(user._id),
        role: user.role,
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.info(`[AUTH] login failed email=${req.body?.email || 'unknown'}`);
    return next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('_id name email role provider avatar')
      .lean();

    if (!user) {
      return next(createHttpError(404, 'User not found'));
    }

    return sendSuccess(res, {
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider,
        avatar: user.avatar || '',
      },
      message: 'Authenticated user profile fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
