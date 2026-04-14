const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { sendError } = require('../utils/response');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, { status: 401, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const normalizedUserId = decoded.userId || decoded.id || '';
    req.user = {
      ...decoded,
      id: normalizedUserId,
      userId: normalizedUserId,
    };
    return next();
  } catch (error) {
    return sendError(res, { status: 401, message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
