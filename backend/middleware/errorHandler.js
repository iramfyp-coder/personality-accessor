const { sendError } = require('../utils/response');

const notFoundHandler = (req, res) =>
  sendError(res, {
    status: 404,
    message: 'Route not found',
  });

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === 'entity.parse.failed') {
    return sendError(res, {
      status: 400,
      message: 'Invalid JSON payload',
    });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message =
    status >= 500 && isProduction
      ? 'Internal Server Error'
      : err?.message || 'Internal Server Error';

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  return sendError(res, {
    status,
    message,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
