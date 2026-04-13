const sendSuccess = (res, { status = 200, data = {}, message = 'OK' } = {}) =>
  res.status(status).json({
    success: true,
    data,
    message,
  });

const sendError = (res, { status = 500, message = 'Internal Server Error' } = {}) =>
  res.status(status).json({
    success: false,
    message,
  });

module.exports = {
  sendSuccess,
  sendError,
};
