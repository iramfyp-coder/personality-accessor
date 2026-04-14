const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const signAuthToken = (user) =>
  jwt.sign(
    {
      userId: String(user._id),
      email: String(user.email || ''),
      role: String(user.role || 'user'),
    },
    config.jwtSecret,
    {
      expiresIn: '7d',
    }
  );

const serializeAuthUser = (user) => ({
  id: String(user._id),
  name: String(user.name || ''),
  email: String(user.email || ''),
  role: String(user.role || 'user'),
  provider: String(user.provider || 'local'),
  avatar: String(user.avatar || ''),
});

module.exports = {
  signAuthToken,
  serializeAuthUser,
};
