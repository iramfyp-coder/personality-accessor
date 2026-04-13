const normalizeBaseUrl = (value) => {
  if (!value) {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const API_BASE_URL = normalizeBaseUrl(process.env.REACT_APP_API_BASE_URL);
export const API_URL = `${API_BASE_URL}/api`;
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

export const APP_ENV = {
  API_BASE_URL,
  API_URL,
  GOOGLE_CLIENT_ID,
};
