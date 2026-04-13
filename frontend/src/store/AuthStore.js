import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getCurrentUser } from '../api/authApi';

const AUTH_STORAGE_KEY = 'auth_state';
const LEGACY_KEYS = ['token', 'userId', 'role', 'userName', 'userEmail'];

export const AuthContext = createContext(null);

const getFallbackName = (email = '') => {
  if (!email) {
    return 'User';
  }

  const [prefix = 'User'] = email.split('@');
  return prefix
    .split(/[._-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const normalizeAuthState = (payload = {}) => {
  const token = payload.token || '';
  const email = payload.email || '';

  return {
    token,
    userId: payload.userId || payload.id || '',
    role: payload.role || 'user',
    name: payload.name || getFallbackName(email),
    email,
    isAuthenticated: Boolean(token),
  };
};

const readStoredAuthState = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeAuthState(JSON.parse(raw));
  } catch (error) {
    return null;
  }
};

const readLegacyAuthState = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  return normalizeAuthState({
    token,
    userId: localStorage.getItem('userId') || '',
    role: localStorage.getItem('role') || 'user',
    name: localStorage.getItem('userName') || '',
    email: localStorage.getItem('userEmail') || '',
  });
};

const getInitialAuthState = () =>
  readStoredAuthState() || readLegacyAuthState() || normalizeAuthState();

const persistAuthState = (state) => {
  const normalized = normalizeAuthState(state);

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));

  if (normalized.token) {
    localStorage.setItem('token', normalized.token);
    localStorage.setItem('userId', normalized.userId);
    localStorage.setItem('role', normalized.role);
    localStorage.setItem('userName', normalized.name);
    localStorage.setItem('userEmail', normalized.email);
  }
};

const clearAuthState = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const AuthProvider = ({ children }) => {
  const initialAuthRef = useRef(getInitialAuthState());
  const [authState, setAuthState] = useState(initialAuthRef.current);
  const [isProfileLoading, setIsProfileLoading] = useState(
    Boolean(initialAuthRef.current.token)
  );

  const applyAuthState = useCallback((payload = {}) => {
    const nextState = normalizeAuthState(payload);
    setAuthState(nextState);

    if (nextState.token) {
      persistAuthState(nextState);
    } else {
      clearAuthState();
    }

    return nextState;
  }, []);

  const login = useCallback(
    (payload) => {
      applyAuthState(payload);
      setIsProfileLoading(Boolean(payload?.token));
    },
    [applyAuthState]
  );

  const logout = useCallback(() => {
    applyAuthState();
    setIsProfileLoading(false);
  }, [applyAuthState]);

  const updateProfile = useCallback((profilePayload = {}) => {
    setAuthState((currentState) => {
      const nextState = normalizeAuthState({
        ...currentState,
        ...profilePayload,
      });

      persistAuthState(nextState);
      return nextState;
    });
  }, []);

  useEffect(() => {
    if (!authState.token) {
      setIsProfileLoading(false);
      return;
    }

    let isActive = true;

    setIsProfileLoading(true);

    getCurrentUser()
      .then((profile) => {
        if (!isActive) {
          return;
        }

        updateProfile({
          id: profile.id,
          name: profile.name,
          email: profile.email,
        });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        applyAuthState();
      })
      .finally(() => {
        if (isActive) {
          setIsProfileLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [authState.token, applyAuthState, updateProfile]);

  const value = useMemo(
    () => ({
      ...authState,
      isProfileLoading,
      login,
      logout,
      updateProfile,
    }),
    [authState, isProfileLoading, login, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
