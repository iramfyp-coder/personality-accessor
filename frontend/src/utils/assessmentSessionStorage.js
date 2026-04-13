const STORAGE_PREFIX = 'assessment_draft_v1';

const getDraftKey = (userId) => `${STORAGE_PREFIX}:${userId}`;

export const readAssessmentDraft = (userId) => {
  if (!userId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(getDraftKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      sessionId: parsed.sessionId || null,
      answers: parsed.answers || {},
      currentIndex: Number(parsed.currentIndex || 0),
      startedAt: parsed.startedAt || null,
      lastUpdatedAt: parsed.lastUpdatedAt || null,
    };
  } catch (error) {
    return null;
  }
};

export const persistAssessmentDraft = (userId, payload) => {
  if (!userId) {
    return;
  }

  const draft = {
    sessionId: payload.sessionId || null,
    answers: payload.answers || {},
    currentIndex: Number(payload.currentIndex || 0),
    startedAt: payload.startedAt || new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  localStorage.setItem(getDraftKey(userId), JSON.stringify(draft));
};

export const clearAssessmentDraft = (userId) => {
  if (!userId) {
    return;
  }

  localStorage.removeItem(getDraftKey(userId));
};

export const hasResumableAssessmentDraft = (userId) => {
  const draft = readAssessmentDraft(userId);
  return Boolean(draft && draft.currentIndex > 0 && Object.keys(draft.answers || {}).length > 0);
};
