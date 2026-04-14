const crypto = require('crypto');

const OPTION_IDS = ['A', 'B', 'C', 'D'];
const OPTION_WEIGHTS = [5, 4, 3, 2];
const OPTION_ROLES = ['direct_action', 'analytical_check', 'collaborative_route', 'defer_route'];
const SIMILARITY_THRESHOLD = 0.78;

const ROLE_TRAIT_HINTS = {
  direct_action: 'E',
  analytical_check: 'C',
  collaborative_route: 'A',
  defer_route: 'N',
};

const FAMILY_OPTION_BANK = {
  leadership: {
    direct_action: [
      'Take initiative and set a clear direction',
      'Step forward immediately and assign ownership',
      'Lead the response and define next actions',
    ],
    analytical_check: [
      'Review constraints, then decide the leadership approach',
      'Assess team capacity first, then set direction',
      'Validate priority risks before assigning roles',
    ],
    collaborative_route: [
      'Consult the team, then align on one plan',
      'Facilitate input from key members before committing',
      'Build quick consensus before execution starts',
    ],
    defer_route: [
      'Wait for clearer authority before acting',
      'Hold action until expectations are confirmed',
      'Pause leadership move until direction is explicit',
    ],
  },
  engineering: {
    direct_action: [
      'Debug the system immediately and isolate the fault',
      'Start hands-on troubleshooting right away',
      'Implement a quick technical fix to stabilize behavior',
    ],
    analytical_check: [
      'Recalculate critical values before changing implementation',
      'Inspect logs and evidence before touching the system',
      'Validate assumptions against measurable data first',
    ],
    collaborative_route: [
      'Consult documentation and relevant teammates before acting',
      'Pair with another engineer to review root cause options',
      'Run a quick technical sync before selecting a fix path',
    ],
    defer_route: [
      'Observe system behavior longer before intervening',
      'Delay changes until reproducible evidence is stronger',
      'Wait for full clarity before making technical changes',
    ],
  },
  risk: {
    direct_action: [
      'Take a controlled risk now with safeguards',
      'Launch a small pilot immediately',
      'Move forward with a bounded high-upside step',
    ],
    analytical_check: [
      'Estimate downside and mitigation before deciding',
      'Model risk scenarios first, then commit',
      'Quantify failure impact before moving',
    ],
    collaborative_route: [
      'Discuss risk tradeoffs with stakeholders first',
      'Validate risk appetite with the team before execution',
      'Align with partners on risk controls before action',
    ],
    defer_route: [
      'Wait until uncertainty drops before acting',
      'Delay the decision for stronger confidence',
      'Hold the move until downside is clearer',
    ],
  },
  creativity: {
    direct_action: [
      'Prototype a new approach immediately',
      'Try an unconventional solution right away',
      'Launch a fast creative experiment now',
    ],
    analytical_check: [
      'Compare alternatives before changing the approach',
      'Map constraints first, then design a novel option',
      'Evaluate why the current method is failing before ideating',
    ],
    collaborative_route: [
      'Brainstorm with peers before picking one concept',
      'Co-create options with the team before execution',
      'Collect creative input from others before deciding',
    ],
    defer_route: [
      'Keep the current method until stronger evidence appears',
      'Delay experimentation and stay with routine for now',
      'Postpone creative changes until pressure drops',
    ],
  },
  teamwork: {
    direct_action: [
      'Resolve the conflict directly and set one plan',
      'Make a clear call now to unblock the team',
      'Define roles immediately to restore momentum',
    ],
    analytical_check: [
      'Clarify responsibilities before deciding next steps',
      'Analyze friction points first, then assign actions',
      'Review dependencies before issuing direction',
    ],
    collaborative_route: [
      'Invite discussion and decide together',
      'Seek team input first, then lock the decision',
      'Facilitate alignment before execution starts',
    ],
    defer_route: [
      'Wait for tensions to settle before deciding',
      'Pause and revisit the issue later',
      'Hold the decision until everyone is ready',
    ],
  },
  communication: {
    direct_action: [
      'Respond clearly now and state next steps',
      'Address the issue directly in the moment',
      'Give concise feedback immediately',
    ],
    analytical_check: [
      'Understand concerns first, then respond',
      'Ask clarifying questions before replying',
      'Separate facts from assumptions before responding',
    ],
    collaborative_route: [
      'Open dialogue and co-create the response',
      'Invite perspective from others before final wording',
      'Align the message with the group before sending',
    ],
    defer_route: [
      'Wait for more context before responding',
      'Delay the response until emotions cool down',
      'Postpone communication until clarity improves',
    ],
  },
  decision: {
    direct_action: [
      'Choose a direction now and execute the first step',
      'Commit immediately to the strongest available option',
      'Make the decision now and move',
    ],
    analytical_check: [
      'Compare evidence before selecting one direction',
      'Evaluate tradeoffs first, then commit',
      'Validate assumptions before deciding',
    ],
    collaborative_route: [
      'Discuss tradeoffs with others before choosing',
      'Collect quick input from the team before commitment',
      'Align stakeholders before finalizing the decision',
    ],
    defer_route: [
      'Delay the decision until certainty improves',
      'Wait for additional clarity before acting',
      'Pause commitment until stronger signals appear',
    ],
  },
  general: {
    direct_action: [
      'Take immediate action with one clear step',
      'Move now with a decisive first action',
      'Act quickly and commit to one route',
    ],
    analytical_check: [
      'Analyze options first, then choose one route',
      'Review evidence before acting',
      'Check assumptions first, then commit',
    ],
    collaborative_route: [
      'Consult others before acting',
      'Discuss options with the team before committing',
      'Seek quick alignment before execution',
    ],
    defer_route: [
      'Wait for clearer information before acting',
      'Delay commitment until uncertainty drops',
      'Pause action and revisit when clarity improves',
    ],
  },
};

const normalizeText = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeForSimilarity = (value = '') =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toSlug = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const hashToIndex = (seed = '', size = 1) => {
  if (!size) {
    return 0;
  }

  const digest = crypto.createHash('sha1').update(String(seed || '')).digest('hex').slice(0, 8);
  const value = Number.parseInt(digest, 16);
  return Number.isFinite(value) ? value % size : 0;
};

const cosineSimilarity = (left = '', right = '') => {
  const toVector = (text = '') =>
    normalizeForSimilarity(text)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
      .reduce((accumulator, token) => {
        accumulator[token] = Number(accumulator[token] || 0) + 1;
        return accumulator;
      }, {});

  const leftVec = toVector(left);
  const rightVec = toVector(right);
  const leftKeys = Object.keys(leftVec);
  const rightKeys = Object.keys(rightVec);

  if (!leftKeys.length || !rightKeys.length) {
    return 0;
  }

  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  leftKeys.forEach((key) => {
    const value = Number(leftVec[key] || 0);
    leftMag += value * value;
    if (rightVec[key]) {
      dot += value * Number(rightVec[key] || 0);
    }
  });

  rightKeys.forEach((key) => {
    const value = Number(rightVec[key] || 0);
    rightMag += value * value;
  });

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const inferIntentFamily = ({ intentTag = '', questionText = '', traitFocus = '' } = {}) => {
  const token = `${toSlug(intentTag)} ${normalizeText(questionText).toLowerCase()} ${String(traitFocus || '').toLowerCase()}`;

  if (/engineer|system|debug|code|algorithm|documentation|electrical|power|control|automation|embedded/.test(token)) {
    return 'engineering';
  }

  if (/leader|assertive|direction|ownership/.test(token)) return 'leadership';
  if (/decision|tradeoff|priority|confidence/.test(token)) return 'decision';
  if (/creativ|innovat|novel|experiment/.test(token)) return 'creativity';
  if (/risk|uncertain|stress|pressure/.test(token)) return 'risk';
  if (/team|cooperat|empathy|trust|conflict/.test(token)) return 'teamwork';
  if (/communicat|feedback|dialogue|message/.test(token)) return 'communication';
  return 'general';
};

const extractContextToken = (questionText = '') => {
  const lower = normalizeText(questionText).toLowerCase();
  const tokens = [
    'deadline',
    'quality',
    'team',
    'project',
    'risk',
    'change',
    'feedback',
    'data',
    'plan',
    'meeting',
    'decision',
    'system',
    'incident',
    'client',
  ];

  return tokens.find((token) => lower.includes(token)) || '';
};

const injectContext = (label = '', contextToken = '') => {
  const clean = normalizeText(label);
  if (!clean || !contextToken) {
    return clean;
  }

  if (clean.toLowerCase().includes(contextToken.toLowerCase())) {
    return clean;
  }

  return `${clean} in this ${contextToken} situation`;
};

const pickVariant = (items = [], seed = '') => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    return '';
  }

  return list[hashToIndex(seed, list.length)] || list[0];
};

const buildLabelsByRole = ({ family = 'general', contextToken = '', seed = '' }) => {
  const templates = FAMILY_OPTION_BANK[family] || FAMILY_OPTION_BANK.general;

  return OPTION_ROLES.map((role) => {
    const label = pickVariant(templates[role] || [], `${seed}:${family}:${role}`);
    return {
      role,
      label: injectContext(label, contextToken),
      trait: ROLE_TRAIT_HINTS[role] || 'O',
    };
  });
};

const ensureRoleLabelDiversity = ({ items = [] }) => {
  const normalized = [];

  OPTION_ROLES.forEach((role) => {
    const candidate = items.find((entry) => entry.role === role) || {
      role,
      label: pickVariant(FAMILY_OPTION_BANK.general[role], role),
      trait: ROLE_TRAIT_HINTS[role] || 'O',
    };

    let label = normalizeText(candidate.label);
    if (!label) {
      label = pickVariant(FAMILY_OPTION_BANK.general[role], role);
    }

    const duplicateIndex = normalized.findIndex(
      (existing) => cosineSimilarity(existing.label, label) >= SIMILARITY_THRESHOLD
    );

    if (duplicateIndex >= 0) {
      const fallback = pickVariant(
        FAMILY_OPTION_BANK.general[role],
        `${role}:${duplicateIndex}:${label}`
      );
      label = normalizeText(`${label}; alternatively ${fallback}`);
    }

    normalized.push({
      role,
      label,
      trait: candidate.trait || ROLE_TRAIT_HINTS[role] || 'O',
    });
  });

  return normalized;
};

const generateMcqOptions = ({
  questionText = '',
  intentTag = '',
  questionType = '',
  traitFocus = '',
} = {}) => {
  const family = inferIntentFamily({ intentTag, questionText, traitFocus });
  const contextToken = extractContextToken(questionText);
  const seed = `${intentTag}|${questionText}|${questionType}|${traitFocus}|${family}`;

  const roleItems = ensureRoleLabelDiversity({
    items: buildLabelsByRole({ family, contextToken, seed }),
  });

  return roleItems.slice(0, 4).map((item, index) => ({
    id: OPTION_IDS[index],
    label: item.label,
    weight: OPTION_WEIGHTS[index] || 3,
    role: item.role,
    trait: item.trait,
  }));
};

module.exports = {
  generateMcqOptions,
};
