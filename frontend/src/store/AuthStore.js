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
const LEGACY_KEYS = ['token', 'user', 'userId', 'role', 'userName', 'userEmail'];

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
  const user = payload.user || {};
  const token = payload.token || '';
  const userId = payload.userId || payload.id || user.id || user._id || '';
  const email = payload.email || user.email || '';
  const role = payload.role || user.role || 'user';
  const provider = payload.provider || user.provider || (token ? 'local' : '');
  const avatar = payload.avatar || user.avatar || '';
  const name = payload.name || user.name || getFallbackName(email);

  return {
    token,
    userId,
    role,
    name,
    email,
    provider,
    avatar,
    user: {
      id: userId,
      name,
      email,
      role,
      provider,
      avatar,
    },
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

  let legacyUser = {};
  try {
    legacyUser = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (error) {
    legacyUser = {};
  }

  return normalizeAuthState({
    token,
    user: legacyUser,
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
    localStorage.setItem('user', JSON.stringify(normalized.user));
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
          role: profile.role,
          provider: profile.provider,
          avatar: profile.avatar,
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
