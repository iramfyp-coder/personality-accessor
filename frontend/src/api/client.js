import axios from 'axios';
import { API_URL } from '../config/env';

const getStoredAuthState = () => {
  try {
    const raw = localStorage.getItem('auth_state');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const getAuthToken = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return token;
  }

  return getStoredAuthState()?.token || '';
};

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new Error('Request timed out while waiting for AI processing. Please retry once.')
      );
    }

    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong while processing your request.';

    return Promise.reject(new Error(message));
  }
);

export default client;
