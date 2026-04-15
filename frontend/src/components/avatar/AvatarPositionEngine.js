export const AVATAR_FIXED_ANCHOR = Object.freeze({
  left: 16,
  bottom: 24,
});

const MOBILE_BREAKPOINT = 760;

const DESKTOP_SIZE = Object.freeze({
  width: 128,
  height: 192,
});

const MOBILE_SIZE = Object.freeze({
  width: 94,
  height: 140,
});

export const detectPageKey = (pathname = '') => {
  if (pathname.startsWith('/login')) return 'login';
  if (pathname.startsWith('/signup')) return 'signup';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/assessment/start')) return 'start';
  if (pathname.startsWith('/assessment/test') || pathname.startsWith('/assessment?')) return 'question';
  if (pathname.startsWith('/assessment/behavior')) return 'behavior';
  if (pathname.startsWith('/assessment/result')) return 'results';
  if (pathname.startsWith('/result/')) return 'report';
  if (pathname.startsWith('/assessment')) return 'question';
  return 'dashboard';
};

export const isMobileAvatarViewport = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= MOBILE_BREAKPOINT;
};

export const resolveAvatarSize = ({ mobileMode = isMobileAvatarViewport() } = {}) =>
  mobileMode ? MOBILE_SIZE : DESKTOP_SIZE;

export const interpolateAvatarPosition = ({ current, target }) => {
  if (!target) {
    return current;
  }

  return {
    ...(current || target),
    ...target,
  };
};

export const calculateAvatarPosition = ({ mobileMode = isMobileAvatarViewport() } = {}) => {
  const size = resolveAvatarSize({ mobileMode });

  if (typeof window === 'undefined') {
    return {
      x: AVATAR_FIXED_ANCHOR.left,
      y: AVATAR_FIXED_ANCHOR.bottom,
      width: size.width,
      height: size.height,
      side: 'left',
      targetRect: null,
    };
  }

  return {
    x: AVATAR_FIXED_ANCHOR.left,
    y: Math.max(AVATAR_FIXED_ANCHOR.bottom, window.innerHeight - size.height - AVATAR_FIXED_ANCHOR.bottom),
    width: size.width,
    height: size.height,
    side: 'left',
    targetRect: null,
  };
};
