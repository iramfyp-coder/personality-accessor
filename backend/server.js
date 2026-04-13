const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { config, validateRequiredEnv } = require('./config/env');
const { sendSuccess, sendError } = require('./utils/response');

validateRequiredEnv();

const app = express();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('Origin not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

app.get('/', (req, res) => {
  return sendSuccess(res, {
    data: { status: 'ok' },
    message: 'API running',
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/assessments', require('./routes/assessmentRoutes'));
app.use('/api/assessment', require('./routes/assessmentFlowRoutes'));
app.use('/api/cv', require('./routes/cvRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

app.use((req, res) => {
  return sendError(res, {
    status: 404,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error('ERROR:', err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const startServer = async () => {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
};

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
