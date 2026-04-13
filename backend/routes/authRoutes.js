const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { validateSignup, validateLogin } = require('../middleware/validateInput');
const createRateLimiter = require('../middleware/rateLimiter');
const { config } = require('../config/env');
const { sendSuccess } = require('../utils/response');
const { createHttpError } = require('../utils/httpError');

const router = express.Router();

const authRateLimiter = createRateLimiter({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  message: 'Too many authentication attempts. Please try again later.',
});

router.use(authRateLimiter);

const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

const signAuthToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, {
    expiresIn: '1d',
  });

router.post('/signup', validateSignup, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createHttpError(400, 'User already exists'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
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
    const { email, password } = req.body;

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
        userId: user._id,
        role: user.role,
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.info(`[AUTH] login failed email=${req.body?.email || 'unknown'}`);
    return next(error);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    if (!googleClient) {
      return next(createHttpError(503, 'Google auth is not configured'));
    }

    const { token } = req.body;
    if (!token) {
      return next(createHttpError(400, 'Google token is required'));
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name,
        email,
        googleId,
      });

      await user.save();
    }

    const jwtToken = signAuthToken(user);

    console.info(`[AUTH] google auth success userId=${user._id} email=${email}`);

    return sendSuccess(res, {
      data: {
        token: jwtToken,
        userId: user._id,
        role: user.role,
      },
      message: 'Google login successful',
    });
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('token')) {
      return next(createHttpError(400, 'Invalid Google token'));
    }

    return next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('_id name email').lean();

    if (!user) {
      return next(createHttpError(404, 'User not found'));
    }

    return sendSuccess(res, {
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      message: 'Authenticated user profile fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
