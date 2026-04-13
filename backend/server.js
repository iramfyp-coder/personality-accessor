const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { config, validateRequiredEnv } = require('./config/env');
const { sendSuccess } = require('./utils/response');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const corsOptions = {
  origin(origin, callback) {
    if (config.isAllowedCorsOrigin(origin)) {
      return callback(null, true);
    }

    const error = new Error('Origin not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
};

const createApp = () => {
  const app = express();
  const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
  const apiRateLimiter = rateLimit({
    windowMs: config.apiRateLimitWindowMs,
    max: config.apiRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  });

  app.set('trust proxy', 1);
  app.use(morgan(morganFormat));
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', apiRateLimiter);

  app.get('/', (req, res) => {
    return sendSuccess(res, {
      data: { status: 'ok' },
      message: 'API running',
    });
  });

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/questions', require('./routes/questionRoutes'));
  app.use('/api/assessments', require('./routes/assessmentRoutes'));
  app.use('/api/assessment', require('./routes/assessmentFlowRoutes'));
  app.use('/api/cv', require('./routes/cvRoutes'));
  app.use('/api/analytics', require('./routes/analyticsRoutes'));
  app.use('/api/ai', require('./routes/aiRoutes'));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const app = createApp();

const startServer = async () => {
  validateRequiredEnv();
  await connectDB();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  app,
  createApp,
  startServer,
};
