import client from './client';
import { API_URL } from '../config/env';

const unwrap = (response) => response?.data?.data || {};

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) {
    return direct;
  }

  try {
    const authState = JSON.parse(localStorage.getItem('auth_state') || '{}');
    return authState.token || '';
  } catch (error) {
    return '';
  }
};

export const uploadCv = async ({ file, userRole, userProfile } = {}) => {
  if (!file) {
    throw new Error('CV file is required');
  }

  const formData = new FormData();
  formData.append('cv', file);
  if (userRole) {
    formData.append('userRole', String(userRole));
  }
  if (userProfile && typeof userProfile === 'object') {
    formData.append('userProfile', JSON.stringify(userProfile));
  }

  const response = await client.post('/assessment/cv/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000,
  });

  return unwrap(response);
};

export const getActiveFlowSession = async () => {
  const response = await client.get('/assessment/session/active');
  return unwrap(response);
};

export const getFlowSession = async (sessionId) => {
  const response = await client.get(`/assessment/${sessionId}`);
  return unwrap(response);
};

export const startAdaptiveAssessment = async ({
  sessionId,
  userRole,
  userProfile,
  skipCv = false,
} = {}) => {
  const response = await client.post(
    '/assessment/start',
    {
      sessionId,
      userRole,
      userProfile,
      skipCv,
    },
    {
      timeout: 45000,
    }
  );

  return unwrap(response);
};

export const getAdaptiveQuestion = async (sessionId) => {
  const response = await client.get(`/assessment/${sessionId}/question`);
  return unwrap(response);
};

export const getPreviousAdaptiveQuestion = async (sessionId) => {
  const response = await client.post(`/assessment/${sessionId}/question/previous`);
  return unwrap(response);
};

export const submitAdaptiveAnswer = async ({ sessionId, payload }) => {
  const response = await client.post(`/assessment/${sessionId}/answer`, payload);
  return unwrap(response);
};

export const getAssessmentFlowResult = async (sessionId) => {
  const response = await client.get(`/assessment/${sessionId}/result`);
  return unwrap(response);
};

export const askCareerChat = async ({ sessionId, message }) => {
  const response = await client.post(`/assessment/${sessionId}/chat`, { message });
  return unwrap(response);
};

export const askWhyNotCareer = async ({ sessionId, career }) => {
  const response = await client.post(`/assessment/${sessionId}/why-not`, { career });
  return unwrap(response);
};

export const downloadAssessmentFlowPdf = async (sessionId) => {
  const response = await client.get(`/assessment/${sessionId}/result/pdf`, {
    responseType: 'blob',
  });

  return response?.data || null;
};

const parseSseChunk = (rawChunk = '', onEvent) => {
  const blocks = rawChunk.split('\n\n').filter(Boolean);

  blocks.forEach((block) => {
    const lines = block.split('\n').map((line) => line.trim());
    const idLine = lines.find((line) => line.startsWith('id:'));
    const eventLine = lines.find((line) => line.startsWith('event:'));
    const dataLines = lines.filter((line) => line.startsWith('data:'));

    if (dataLines.length === 0) {
      return;
    }

    const eventId = idLine ? idLine.replace('id:', '').trim() : '';
    const event = eventLine ? eventLine.replace('event:', '').trim() : 'message';
    const dataPayload = dataLines
      .map((line) => line.replace('data:', '').trim())
      .join('\n');

    try {
      const payload = JSON.parse(dataPayload);
      onEvent({ event, payload, eventId });
    } catch (error) {
      onEvent({ event, payload: null, eventId });
    }
  });
};

export const streamAssessmentProgress = async ({ sessionId, onEvent, signal, lastEventId }) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/assessment/${sessionId}/events`, {
    method: 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'text/event-stream',
      ...(lastEventId ? { 'Last-Event-ID': String(lastEventId) } : {}),
    },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error('Unable to connect to progress stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const boundaryIndex = buffer.lastIndexOf('\n\n');
    if (boundaryIndex !== -1) {
      const complete = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      parseSseChunk(complete, onEvent);
    }
  }

  if (buffer.trim()) {
    parseSseChunk(buffer, onEvent);
  }
};
