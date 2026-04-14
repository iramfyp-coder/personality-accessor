const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const LOCALHOST_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const VERCEL_PREVIEW_DOMAIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseOrigins = (value) => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const buildCorsOrigins = () =>
  Array.from(
    new Set([
      ...LOCALHOST_ORIGINS,
      ...parseOrigins(process.env.FRONTEND_URL),
      ...parseOrigins(process.env.ALLOWED_ORIGINS),
      ...parseOrigins(process.env.CORS_ORIGINS),
    ])
  );

const corsOrigins = buildCorsOrigins();

const isAllowedCorsOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (corsOrigins.includes(origin)) {
    return true;
  }

  return VERCEL_PREVIEW_DOMAIN_PATTERN.test(origin);
};

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  frontendUrl: process.env.FRONTEND_URL || '',
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  corsOrigins,
  isAllowedCorsOrigin,
  authRateLimitWindowMs: toInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 30),
  apiRateLimitWindowMs: toInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: toInt(process.env.API_RATE_LIMIT_MAX, 300),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folders: {
      cvUploads: process.env.CLOUDINARY_CV_UPLOADS_FOLDER || 'personality-assessor/cv-uploads',
      generatedPdfReports:
        process.env.CLOUDINARY_PDF_REPORTS_FOLDER || 'personality-assessor/generated-reports',
      assets: process.env.CLOUDINARY_ASSETS_FOLDER || 'personality-assessor/assets',
    },
  },
};

const validateRequiredEnv = () => {
  const required = [
    { key: 'mongoUri', envName: 'MONGODB_URI' },
    { key: 'jwtSecret', envName: 'JWT_SECRET' },
  ];
  const missing = required
    .filter(({ key }) => !config[key])
    .map(({ envName }) => envName);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = {
  config,
  validateRequiredEnv,
};
