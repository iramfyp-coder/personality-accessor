const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

const validateSignup = [
  body('name').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, { status: 400, message: 'Invalid signup payload' });
    }
    return next();
  },
];

const validateLogin = [
  body('email').isEmail(),
  body('password').notEmpty(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, { status: 400, message: 'Invalid login payload' });
    }
    return next();
  },
];

module.exports = {
  validateSignup,
  validateLogin,
};
