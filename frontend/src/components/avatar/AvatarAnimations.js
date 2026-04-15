import { AVATAR_EVENTS } from './AvatarEvents';

export const AVATAR_STATES = {
  IDLE: 'idle',
  SPEAKING: 'speaking',
  THINK: 'think',
  GUIDE_SECTION: 'guide_section',
  POINT_TARGET: 'point_target',
  CELEBRATE: 'celebrate',
};

const CLIP_PATTERNS = {
  [AVATAR_STATES.IDLE]: [/idle_neutral/i, /^idle$/i, /idle/i],
  [AVATAR_STATES.SPEAKING]: [/idle_neutral/i, /^idle$/i, /idle/i, /interact/i, /wave/i],
  [AVATAR_STATES.THINK]: [/idle_neutral/i, /^idle$/i, /idle/i, /interact/i],
  [AVATAR_STATES.GUIDE_SECTION]: [/interact/i, /idle_neutral/i, /^idle$/i, /idle/i],
  [AVATAR_STATES.POINT_TARGET]: [/interact/i, /wave/i, /idle_neutral/i, /^idle$/i, /idle/i],
  [AVATAR_STATES.CELEBRATE]: [/wave/i, /interact/i, /idle_neutral/i, /^idle$/i, /idle/i],
};
const DISALLOWED_CLIP_PATTERNS = [/gun/i, /rifle/i, /pistol/i, /weapon/i];

export const PAGE_DEFAULT_STATES = {
  login: AVATAR_STATES.IDLE,
  signup: AVATAR_STATES.IDLE,
  dashboard: AVATAR_STATES.IDLE,
  start: AVATAR_STATES.IDLE,
  question: AVATAR_STATES.IDLE,
  behavior: AVATAR_STATES.THINK,
  results: AVATAR_STATES.IDLE,
  report: AVATAR_STATES.IDLE,
};

const TRANSIENT_STATE_HOLD = {
  [AVATAR_STATES.SPEAKING]: 1600,
  [AVATAR_STATES.THINK]: 1700,
  [AVATAR_STATES.GUIDE_SECTION]: 2000,
  [AVATAR_STATES.POINT_TARGET]: 1500,
  [AVATAR_STATES.CELEBRATE]: 2400,
};

export const getStateHoldDuration = (state) => TRANSIENT_STATE_HOLD[state] || 0;

export const resolveClipName = ({ state, clipNames = [] }) => {
  if (!clipNames.length) {
    return '';
  }

  const safeClipNames = clipNames.filter(
    (clipName) => !DISALLOWED_CLIP_PATTERNS.some((pattern) => pattern.test(clipName))
  );
  const sourceNames = safeClipNames.length ? safeClipNames : clipNames;
  const patterns = CLIP_PATTERNS[state] || CLIP_PATTERNS[AVATAR_STATES.IDLE];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = sourceNames.find((clipName) => patterns[index].test(clipName));
    if (match) {
      return match;
    }
  }

  return sourceNames[0] || '';
};

export const resolveAnimationStateFromEvent = ({ event, pageKey }) => {
  if (!event) {
    return PAGE_DEFAULT_STATES[pageKey] || AVATAR_STATES.IDLE;
  }

  switch (event.type) {
    case AVATAR_EVENTS.PAGE_CHANGE:
      return PAGE_DEFAULT_STATES[pageKey] || AVATAR_STATES.IDLE;

    case AVATAR_EVENTS.BUTTON_HOVER:
    case AVATAR_EVENTS.BUTTON_CLICK:
      return AVATAR_STATES.SPEAKING;

    case AVATAR_EVENTS.ANSWER_CHANGED:
    case AVATAR_EVENTS.INPUT_TYPING:
    case AVATAR_EVENTS.CHAT_MESSAGE:
    case AVATAR_EVENTS.AI_LOADING:
      return AVATAR_STATES.THINK;

    case AVATAR_EVENTS.ANSWER_SELECTED:
    case AVATAR_EVENTS.SCROLL_SECTION:
      return AVATAR_STATES.SPEAKING;

    case AVATAR_EVENTS.RESULTS_LOADED:
    case AVATAR_EVENTS.ASSESSMENT_COMPLETE:
    case AVATAR_EVENTS.CHAT_RESPONSE:
      return AVATAR_STATES.CELEBRATE;

    case AVATAR_EVENTS.ERROR_STATE:
      return AVATAR_STATES.THINK;

    default:
      return AVATAR_STATES.IDLE;
  }
};
