const { sendError } = require('../utils/response');

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, { status: 403, message: 'Access denied' });
  }

  return next();
};

module.exports = {
  isAdmin,
};
