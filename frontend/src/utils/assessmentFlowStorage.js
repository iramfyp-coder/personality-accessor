const STORAGE_KEY_PREFIX = 'assessment_flow_v1';
const QUESTION_DRAFT_KEY_PREFIX = 'assessment_flow_question_draft_v1';

const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}:${userId || 'anonymous'}`;
const getQuestionDraftKey = ({ userId, sessionId, questionId }) =>
  `${QUESTION_DRAFT_KEY_PREFIX}:${userId || 'anonymous'}:${sessionId || 'session'}:${questionId || 'question'}`;

export const readAssessmentFlowState = (userId) => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      sessionId: parsed.sessionId || '',
      stage: parsed.stage || 'cv_upload',
      userRole: parsed.userRole || '',
      userProfile:
        parsed.userProfile && typeof parsed.userProfile === 'object'
          ? parsed.userProfile
          : null,
      inputMode: parsed.inputMode || 'cv',
      updatedAt: parsed.updatedAt || null,
    };
  } catch (error) {
    return null;
  }
};

export const saveAssessmentFlowState = (userId, payload = {}) => {
  const current = readAssessmentFlowState(userId) || {};
  const state = {
    sessionId: payload.sessionId ?? current.sessionId ?? '',
    stage: payload.stage ?? current.stage ?? 'cv_upload',
    userRole: payload.userRole ?? current.userRole ?? '',
    userProfile:
      payload.userProfile && typeof payload.userProfile === 'object'
        ? payload.userProfile
        : current.userProfile && typeof current.userProfile === 'object'
        ? current.userProfile
        : null,
    inputMode: payload.inputMode ?? current.inputMode ?? 'cv',
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
};

export const clearAssessmentFlowState = (userId) => {
  localStorage.removeItem(getStorageKey(userId));
};

export const readQuestionDraft = ({ userId, sessionId, questionId }) => {
  if (!sessionId || !questionId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(getQuestionDraftKey({ userId, sessionId, questionId }));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
};

export const saveQuestionDraft = ({ userId, sessionId, questionId, payload = {} }) => {
  if (!sessionId || !questionId) {
    return;
  }

  const draft = {
    questionId: String(questionId),
    updatedAt: new Date().toISOString(),
    ...payload,
  };

  localStorage.setItem(getQuestionDraftKey({ userId, sessionId, questionId }), JSON.stringify(draft));
};

export const clearQuestionDraft = ({ userId, sessionId, questionId }) => {
  if (!sessionId || !questionId) {
    return;
  }

  localStorage.removeItem(getQuestionDraftKey({ userId, sessionId, questionId }));
};
