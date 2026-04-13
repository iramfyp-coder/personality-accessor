const { createHttpError } = require('./httpError');

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const ensureJsonObjectPayload = (payload) => {
  if (!isPlainObject(payload)) {
    throw createHttpError(400, 'Request payload is required and must be a JSON object');
  }

  return payload;
};

const extractSubmittedSessionId = (payload = {}) => String(payload.sessionId || '').trim();

const extractSubmittedQuestionId = (payload = {}) =>
  String(
    payload.questionId || payload.currentQuestion?.id || payload.currentQuestion?.questionId || ''
  ).trim();

const extractSubmittedQuestionSequence = (payload = {}) =>
  Number(payload.questionSequence ?? payload.sequence ?? payload.currentQuestion?.sequence);

const assertSessionMatch = ({ submittedSessionId, activeSessionId }) => {
  if (submittedSessionId && submittedSessionId !== String(activeSessionId)) {
    throw createHttpError(400, 'sessionId does not match the active session');
  }
};

const assertQuestionProvided = ({ submittedQuestionId }) => {
  if (!submittedQuestionId) {
    throw createHttpError(400, 'questionId is required');
  }
};

module.exports = {
  ensureJsonObjectPayload,
  extractSubmittedSessionId,
  extractSubmittedQuestionId,
  extractSubmittedQuestionSequence,
  assertSessionMatch,
  assertQuestionProvided,
};
