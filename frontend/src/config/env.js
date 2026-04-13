const normalizeBaseUrl = (value) => {
  if (!value) {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const API_URL = normalizeBaseUrl(process.env.REACT_APP_API_URL) || '/api';
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
export const APP_RUNTIME_ENV = process.env.REACT_APP_ENV || 'development';

export const APP_ENV = {
  API_URL,
  GOOGLE_CLIENT_ID,
  APP_RUNTIME_ENV,
};
