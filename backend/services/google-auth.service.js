const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { config } = require('../config/env');
const { createHttpError } = require('../utils/httpError');

const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const verifyGoogleIdToken = async (idToken) => {
  if (!googleClient) {
    throw createHttpError(503, 'Google auth is not configured');
  }

  if (!idToken || typeof idToken !== 'string') {
    throw createHttpError(400, 'idToken is required');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.googleClientId,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw createHttpError(400, 'Invalid Google token');
  }

  if (payload.email_verified === false) {
    throw createHttpError(401, 'Google email is not verified');
  }

  const email = normalizeEmail(payload.email);
  const googleId = String(payload.sub || '').trim();

  if (!email || !googleId) {
    throw createHttpError(400, 'Google token payload is incomplete');
  }

  return {
    email,
    name: String(payload.name || '').trim(),
    picture: String(payload.picture || '').trim(),
    googleId,
  };
};

const upsertGoogleUser = async ({ email, name, picture, googleId }) => {
  const [userByEmail, userByGoogleId] = await Promise.all([
    User.findOne({ email }),
    User.findOne({ googleId }),
  ]);

  if (
    userByEmail &&
    userByGoogleId &&
    String(userByEmail._id) !== String(userByGoogleId._id)
  ) {
    throw createHttpError(409, 'Google account conflict detected');
  }

  const existingUser = userByEmail || userByGoogleId;

  if (!existingUser) {
    const user = new User({
      name: name || email.split('@')[0],
      email,
      googleId,
      provider: 'google',
      avatar: picture,
    });

    await user.save();
    return user;
  }

  if (existingUser.googleId && existingUser.googleId !== googleId) {
    throw createHttpError(409, 'Google account conflict detected');
  }

  let hasChanges = false;

  if (!existingUser.googleId) {
    existingUser.googleId = googleId;
    hasChanges = true;
  }

  if (picture && existingUser.avatar !== picture) {
    existingUser.avatar = picture;
    hasChanges = true;
  }

  if (!existingUser.name && name) {
    existingUser.name = name;
    hasChanges = true;
  }

  if (existingUser.provider !== 'google') {
    existingUser.provider = 'google';
    hasChanges = true;
  }

  if (hasChanges) {
    await existingUser.save();
  }

  return existingUser;
};

const authenticateWithGoogle = async (idToken) => {
  const googleProfile = await verifyGoogleIdToken(idToken);
  return upsertGoogleUser(googleProfile);
};

module.exports = {
  authenticateWithGoogle,
  verifyGoogleIdToken,
  upsertGoogleUser,
};
