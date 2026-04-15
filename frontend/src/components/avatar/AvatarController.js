import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AvatarSpeechBubble from './AvatarSpeechBubble';
import { AVATAR_STATES } from './AvatarAnimations';
import { AVATAR_EVENTS, useAvatarEvents } from './AvatarEvents';
import { calculateAvatarPosition, detectPageKey, isMobileAvatarViewport, resolveAvatarSize } from './AvatarPositionEngine';

const Avatar3D = lazy(() => import('./Avatar3D'));

const PAGE_PLAYBOOK = {
  login: {
    intro: 'Welcome back. Sign in to continue your guided assessment.',
    idle: 'Complete the form and I will guide the next step.',
  },
  signup: {
    intro: 'Create your account and I will guide the flow.',
    idle: 'Submit this form to open your dashboard.',
  },
  dashboard: {
    intro: 'Start from the main assessment action to continue.',
    idle: 'You can also explore analytics and history sections.',
  },
  start: {
    intro: 'Set your profile details and launch the adaptive test.',
    idle: 'When you are ready, begin the assessment.',
  },
  question: {
    intro: 'Choose responses that match your real behavior.',
    idle: 'Take your time and answer honestly.',
  },
  behavior: {
    intro: 'Describe one concrete behavior example with context and result.',
    idle: 'Specific detail improves recommendation quality.',
  },
  results: {
    intro: 'Your profile is ready. I will walk through key outcomes.',
    idle: 'Scroll for career matches, roadmap, and chat guidance.',
  },
  report: {
    intro: 'This report summarizes your full personality assessment.',
    idle: 'Use report actions for PDF and sharing.',
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SPEECH_MIN_GAP_MS = 5000;
const SPEECH_DELAY_MS = 400;
const SPEECH_DISPLAY_MS = 3000;
const THINK_HOLD_MS = 1600;
const IDLE_HINT_DELAY_MS = 6200;
const MOTION_LEVELS = new Set(['low', 'medium', 'off']);

const normalizeMotionLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return MOTION_LEVELS.has(normalized) ? normalized : 'low';
};

const readStoredMotionLevel = () => {
  if (typeof window === 'undefined') {
    return 'low';
  }

  return normalizeMotionLevel(window.localStorage.getItem('avatarMotionLevel'));
};

const resolveBubbleAnchor = (rect) => ({
  x: (rect?.x || 24) + (rect?.width || 120) * 0.9,
  y: (rect?.y || 24) + (rect?.height || 180) * 0.16,
});

const AvatarController = () => {
  const location = useLocation();
  const { emit, subscribe } = useAvatarEvents();

  const [mobileMode, setMobileMode] = useState(() => isMobileAvatarViewport());
  const [motionLevel] = useState(() => readStoredMotionLevel());
  const [avatarState, setAvatarState] = useState(AVATAR_STATES.IDLE);
  const [speech, setSpeech] = useState('');
  const [speechVisible, setSpeechVisible] = useState(false);
  const [speechTurnSignal, setSpeechTurnSignal] = useState(0);

  const initialRect = useMemo(
    () => calculateAvatarPosition({ mobileMode: isMobileAvatarViewport() }),
    []
  );

  const [renderRect, setRenderRect] = useState(initialRect);
  const [bubbleAnchor, setBubbleAnchor] = useState(() => resolveBubbleAnchor(initialRect));

  const pageKey = useMemo(() => detectPageKey(location.pathname), [location.pathname]);
  const pageScript = PAGE_PLAYBOOK[pageKey] || PAGE_PLAYBOOK.dashboard;

  const renderRectRef = useRef(initialRect);
  const progressMilestoneRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const lastSpeechRef = useRef({ message: '', timestamp: 0 });

  const speechDelayTimeoutRef = useRef(0);
  const speechTimeoutRef = useRef(0);
  const speechResetTimeoutRef = useRef(0);
  const thinkingTimeoutRef = useRef(0);
  const idleHintTimeoutRef = useRef(0);

  useEffect(() => {
    renderRectRef.current = renderRect;
  }, [renderRect]);

  const updateFixedRect = useCallback((nextMobileMode) => {
    const nextRect = calculateAvatarPosition({ mobileMode: nextMobileMode });
    renderRectRef.current = nextRect;
    setRenderRect(nextRect);
    setBubbleAnchor(resolveBubbleAnchor(nextRect));
  }, []);

  const beginThinking = useCallback((holdMs = THINK_HOLD_MS) => {
    if (isSpeakingRef.current) {
      return;
    }

    window.clearTimeout(thinkingTimeoutRef.current);
    setAvatarState(AVATAR_STATES.THINK);
    thinkingTimeoutRef.current = window.setTimeout(() => {
      if (isSpeakingRef.current) {
        return;
      }

      setAvatarState((current) => (current === AVATAR_STATES.THINK ? AVATAR_STATES.IDLE : current));
    }, Math.max(300, Number(holdMs || THINK_HOLD_MS)));
  }, []);

  const speak = useCallback(
    (message, options = {}) => {
      const normalizedMessage = String(message || '').trim();
      if (!normalizedMessage) {
        return;
      }

      const now = Date.now();
      const { duration = SPEECH_DISPLAY_MS, force = false } = options;
      const previous = lastSpeechRef.current;

      if (!force) {
        if (normalizedMessage === previous.message) {
          return;
        }

        if (now - Number(previous.timestamp || 0) < SPEECH_MIN_GAP_MS) {
          return;
        }
      }

      lastSpeechRef.current = {
        message: normalizedMessage,
        timestamp: now,
      };

      window.clearTimeout(thinkingTimeoutRef.current);
      window.clearTimeout(speechDelayTimeoutRef.current);
      window.clearTimeout(speechTimeoutRef.current);
      window.clearTimeout(speechResetTimeoutRef.current);

      isSpeakingRef.current = true;
      setSpeech(normalizedMessage);
      setSpeechVisible(false);
      setAvatarState(AVATAR_STATES.SPEAKING);
      setSpeechTurnSignal((current) => current + 1);
      setBubbleAnchor(resolveBubbleAnchor(renderRectRef.current));

      speechDelayTimeoutRef.current = window.setTimeout(() => {
        setSpeechVisible(true);
      }, SPEECH_DELAY_MS);

      speechTimeoutRef.current = window.setTimeout(() => {
        setSpeechVisible(false);
        speechResetTimeoutRef.current = window.setTimeout(() => {
          isSpeakingRef.current = false;
          setAvatarState(AVATAR_STATES.IDLE);
        }, 220);
      }, SPEECH_DELAY_MS + Math.max(1200, Number(duration || SPEECH_DISPLAY_MS)));
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const onResize = () => {
      const nextMobileMode = isMobileAvatarViewport();
      setMobileMode(nextMobileMode);
      updateFixedRect(nextMobileMode);
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [updateFixedRect]);

  useEffect(() => {
    updateFixedRect(mobileMode);
  }, [mobileMode, updateFixedRect]);

  useEffect(() => {
    emit(AVATAR_EVENTS.PAGE_CHANGE, {
      pathname: location.pathname,
      pageKey,
    });

    progressMilestoneRef.current = 0;
    setAvatarState(AVATAR_STATES.IDLE);

    speak(pageScript.intro, { duration: 3200, force: true });

    window.clearTimeout(idleHintTimeoutRef.current);
    idleHintTimeoutRef.current = window.setTimeout(() => {
      speak(pageScript.idle, { duration: 3000 });
    }, IDLE_HINT_DELAY_MS);
    return () => {
      window.clearTimeout(idleHintTimeoutRef.current);
    };
  }, [emit, location.pathname, pageKey, pageScript.idle, pageScript.intro, speak]);

  useEffect(() => {
    const unsubscribe = subscribe('*', (event) => {
      if (!event) {
        return;
      }

      if (event.type === AVATAR_EVENTS.AI_LOADING) {
        beginThinking(2200);
        speak('Preparing your personalized questions…', { duration: 3000 });
        return;
      }

      if (event.type === AVATAR_EVENTS.RESULTS_LOADED) {
        speak(event.payload?.message || 'Results are ready. I highlighted your strongest matches.', {
          duration: 3000,
        });
        return;
      }

      if (event.type === AVATAR_EVENTS.ASSESSMENT_COMPLETE) {
        speak('Assessment complete. Great work.', { duration: 3000 });
        return;
      }

      if (event.type === AVATAR_EVENTS.CHAT_MESSAGE) {
        beginThinking(1200);
        speak('Listening.', { duration: 2400 });
        return;
      }

      if (event.type === AVATAR_EVENTS.CHAT_RESPONSE) {
        speak('Here is guidance based on your profile.', { duration: 3000 });
        return;
      }

      if (event.type === AVATAR_EVENTS.INPUT_TYPING || event.type === AVATAR_EVENTS.ANSWER_CHANGED) {
        beginThinking(1500);
        return;
      }

      if (event.type === AVATAR_EVENTS.ANSWER_SELECTED) {
        const progress = Number(event.payload?.progress || 0);
        let milestone = 0;

        if (progress >= 100) milestone = 100;
        else if (progress >= 75) milestone = 75;
        else if (progress >= 50) milestone = 50;
        else if (progress >= 25) milestone = 25;

        if (milestone > progressMilestoneRef.current) {
          progressMilestoneRef.current = milestone;
          if (milestone === 100) speak('Final question complete.', { duration: 3000 });
          else speak(`${milestone}% completed.`, { duration: 3000 });
        }
        return;
      }

      if (event.type === AVATAR_EVENTS.BUTTON_CLICK && event.payload?.hint) {
        speak(event.payload.hint, { duration: 2800 });
        return;
      }

      if (event.type === AVATAR_EVENTS.ERROR_STATE) {
        speak(event.payload?.message || 'I found an issue. Check your connection and try again.', {
          duration: 3200,
          force: true,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [beginThinking, speak, subscribe]);

  useEffect(() => {
    return () => {
      window.clearTimeout(speechDelayTimeoutRef.current);
      window.clearTimeout(speechTimeoutRef.current);
      window.clearTimeout(speechResetTimeoutRef.current);
      window.clearTimeout(thinkingTimeoutRef.current);
      window.clearTimeout(idleHintTimeoutRef.current);
    };
  }, []);

  const layerStyle = useMemo(
    () => ({
      '--avatar-width': `${Math.round(clamp(renderRect.width || resolveAvatarSize({ mobileMode }).width, 80, 160))}px`,
      '--avatar-height': `${Math.round(clamp(renderRect.height || resolveAvatarSize({ mobileMode }).height, 120, 220))}px`,
    }),
    [mobileMode, renderRect.height, renderRect.width]
  );

  return (
    <div className="avatar-overlay-layer" data-avatar-ignore="true" style={layerStyle}>
      <Suspense fallback={null}>
        <Avatar3D
          avatarState={avatarState}
          rect={renderRect}
          mobileMode={mobileMode}
          motionLevel={motionLevel}
          speechTurnSignal={speechTurnSignal}
        />
      </Suspense>

      <AvatarSpeechBubble message={speech} visible={speechVisible} anchor={bubbleAnchor} side="left" />
    </div>
  );
};

export default AvatarController;
