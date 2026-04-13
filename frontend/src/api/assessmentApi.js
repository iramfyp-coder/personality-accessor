import client from './client';

const unwrap = (response) => response?.data?.data || {};
const AI_REPORT_TIMEOUT_MS = 120000;

export const getQuestions = async () => {
  const response = await client.get('/questions');
  return unwrap(response).questions || [];
};

export const startSession = async () => {
  const response = await client.post('/assessment/legacy/session/start', {});
  return unwrap(response);
};

export const getActiveSession = async (userId) => {
  const response = await client.get(`/assessment/legacy/session/${userId}`);
  return unwrap(response);
};

export const syncSessionProgress = async ({ sessionId, answers }) => {
  const response = await client.patch(`/assessment/legacy/session/${sessionId}`, { answers });
  return unwrap(response);
};

export const saveAssessment = async ({ answers, sessionId }) => {
  const response = await client.post('/assessment/legacy/save', { answers, sessionId });
  return unwrap(response);
};

export const getAssessmentReport = async (assessmentId) => {
  const response = await client.get(`/assessment/report/${assessmentId}`);
  return unwrap(response).report || null;
};

export const getAssessmentsByUser = async (userId) => {
  const response = await client.get(`/assessment/history/${userId}`);
  return unwrap(response).assessments || [];
};

export const generateAiReport = async ({ assessmentId, forceRefresh = false }) => {
  const response = await client.post(
    `/assessment/report/${assessmentId}/ai`,
    {},
    {
      params: forceRefresh ? { forceRefresh: 'true' } : {},
      timeout: AI_REPORT_TIMEOUT_MS,
      timeoutErrorMessage:
        'AI report generation is taking longer than expected. Please retry in a moment.',
    }
  );

  return unwrap(response);
};
