const trimTrailingSlash = (value) => (value.endsWith('/') ? value.slice(0, -1) : value);

const normalizeBaseUrl = (value) => {
  if (!value) {
    return '';
  }

  const trimmedValue = trimTrailingSlash(value.trim());

  if (!trimmedValue) {
    return '';
  }

  // If a full URL is provided without a path, default to `/api` because
  // backend routes are mounted under that prefix.
  try {
    const parsed = new URL(trimmedValue);
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (!pathname || pathname === '/') {
      parsed.pathname = '/api';
      return trimTrailingSlash(parsed.toString());
    }
  } catch (error) {
    // Non-URL values (for example `/api`) are returned as-is after trimming.
  }

  return trimmedValue;
};

export const API_URL = normalizeBaseUrl(process.env.REACT_APP_API_URL) || '/api';
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
export const APP_RUNTIME_ENV = process.env.REACT_APP_ENV || 'development';

export const APP_ENV = {
  API_URL,
  GOOGLE_CLIENT_ID,
  APP_RUNTIME_ENV,
};
