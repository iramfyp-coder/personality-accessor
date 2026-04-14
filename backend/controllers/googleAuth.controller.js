const { authenticateWithGoogle } = require('../services/google-auth.service');
const { signAuthToken, serializeAuthUser } = require('../services/auth-token.service');
const { sendSuccess } = require('../utils/response');
const { createHttpError } = require('../utils/httpError');

const googleAuthController = async (req, res, next) => {
  try {
    const idToken = req.body?.idToken || req.body?.token;
    if (!idToken) {
      return next(createHttpError(400, 'idToken is required'));
    }

    const user = await authenticateWithGoogle(idToken);
    const token = signAuthToken(user);

    console.info(`[AUTH] google auth success userId=${user._id} email=${user.email}`);

    return sendSuccess(res, {
      data: {
        token,
        user: serializeAuthUser(user),
      },
      message: 'Google login successful',
    });
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('token')) {
      return next(createHttpError(400, 'Invalid Google token'));
    }

    return next(error);
  }
};

module.exports = {
  googleAuthController,
};
