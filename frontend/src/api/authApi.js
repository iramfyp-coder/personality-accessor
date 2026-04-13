import client from './client';

const unwrap = (response) => response?.data?.data || {};

export const signup = async (payload) => {
  const response = await client.post('/auth/signup', payload);
  return unwrap(response);
};

export const login = async (payload) => {
  const response = await client.post('/auth/login', payload);
  return unwrap(response);
};

export const googleLogin = async (googleToken) => {
  const response = await client.post('/auth/google', { token: googleToken });
  return unwrap(response);
};

export const getCurrentUser = async () => {
  const response = await client.get('/auth/me');
  return unwrap(response);
};
