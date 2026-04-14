const crypto = require('crypto');

const OPTION_IDS = ['A', 'B', 'C', 'D'];
const OPTION_WEIGHTS = [5, 4, 3, 2];
const OPTION_ROLES = ['action', 'analysis', 'collaboration', 'delay'];
const SIMILARITY_THRESHOLD = 0.82;

const GENERIC_PATTERNS = [/^agree$/i, /^disagree$/i, /^neutral$/i, /^yes$/i, /^no$/i, /^maybe$/i];

const FAMILY_TEMPLATES = {
  leadership: {
    action: 'Set direction immediately and assign one clear owner',
    analysis: 'Review team constraints first, then select one direction',
    collaboration: 'Ask everyone for input, then decide together',
    delay: 'Postpone the decision until someone else leads',
  },
  decision: {
    action: 'Choose the strongest option now and execute the first step',
    analysis: 'Compare evidence first, then choose one clear option',
    collaboration: 'Discuss tradeoffs with the team before deciding',
    delay: 'Delay the choice until more certainty appears',
  },
  creativity: {
    action: 'Try a small new approach immediately',
    analysis: 'Evaluate current method limits before changing',
    collaboration: 'Brainstorm options with teammates before acting',
    delay: 'Stay with current method and postpone experimentation',
  },
  risk: {
    action: 'Take a controlled risk now with clear safeguards',
    analysis: 'Assess downside first before moving',
    collaboration: 'Review risk with the team before committing',
    delay: 'Wait for stronger certainty before taking action',
  },
  team: {
    action: 'Resolve it now with a clear team decision',
    analysis: 'Clarify each role first, then decide',
    collaboration: 'Facilitate group discussion before acting',
    delay: 'Pause the decision and revisit later',
  },
  adaptability: {
    action: 'Adjust the plan immediately and move forward',
    analysis: 'Map impacts first, then change the plan',
    collaboration: 'Align everyone on changes before acting',
    delay: 'Keep current plan and delay adjustments',
  },
  analytical: {
    action: 'Decide now using the strongest available signal',
    analysis: 'Validate assumptions first and then decide',
    collaboration: 'Review interpretations with others before choosing',
    delay: 'Hold the decision until cleaner data arrives',
  },
  communication: {
    action: 'Respond directly now and set next steps',
    analysis: 'Understand concerns first, then respond',
    collaboration: 'Invite dialogue before deciding your response',
    delay: 'Delay the response until tension decreases',
  },
  general: {
    action: 'Take immediate action with one clear next step',
    analysis: 'Analyze options first, then commit one direction',
    collaboration: 'Discuss options with the team before acting',
    delay: 'Delay action until uncertainty drops',
  },
};

const normalizeText = (value = '') =>
  String(value || '')
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

const normalizeForSimilarity = (value = '') =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

  if (/leader|assertive|direction/.test(token)) return 'leadership';
  if (/decision|tradeoff|priority|confidence/.test(token)) return 'decision';
  if (/creativ|innovat|novel/.test(token)) return 'creativity';
  if (/risk|uncertain|stress|pressure/.test(token)) return 'risk';
  if (/team|cooperat|empathy|trust/.test(token)) return 'team';
  if (/adapt|change|pivot/.test(token)) return 'adaptability';
  if (/analysis|data|evidence|logic/.test(token)) return 'analytical';
  if (/communicat|feedback|conflict/.test(token)) return 'communication';
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
    'campaign',
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

  return `${clean} around ${contextToken}`;
};

const buildLabelsByRole = ({ family = 'general', contextToken = '', seed = '' }) => {
  const templates = FAMILY_TEMPLATES[family] || FAMILY_TEMPLATES.general;
  const contextVariant = hashToIndex(seed, 3);
  const contextHint =
    contextVariant === 0
      ? ''
      : contextVariant === 1
      ? contextToken
      : contextToken
      ? `under ${contextToken} pressure`
      : '';

  return OPTION_ROLES.map((role) => ({
    role,
    label: injectContext(`${templates[role]} ${contextHint}`.trim(), contextToken),
  }));
};

const buildFallbackOptions = (contextToken = '') => {
  const suffixByRole = {
    action: 'using immediate action',
    analysis: 'using quick analysis',
    collaboration: 'with team collaboration',
    delay: 'with delayed commitment',
  };

  return OPTION_ROLES.map((role) => ({
    role,
    label: injectContext(
      `${FAMILY_TEMPLATES.general[role]} ${suffixByRole[role] || ''}`.trim(),
      contextToken
    ),
  }));
};

const ensureRoleLabelDiversity = ({ items = [], contextToken = '' }) => {
  const byRole = OPTION_ROLES.map((role) => {
    const candidate = items.find((entry) => entry.role === role);
    return {
      role,
      label: normalizeText(candidate?.label || ''),
    };
  });

  const diversified = [];

  byRole.forEach((entry) => {
    let label = entry.label;
    if (!label || GENERIC_PATTERNS.some((pattern) => pattern.test(label))) {
      label = buildFallbackOptions(contextToken).find((item) => item.role === entry.role)?.label || '';
    }

    const similarIndex = diversified.findIndex(
      (existing) => cosineSimilarity(existing.label, label) >= SIMILARITY_THRESHOLD
    );

    if (similarIndex >= 0) {
      const roleHint =
        entry.role === 'action'
          ? 'using direct action'
          : entry.role === 'analysis'
          ? 'after checking evidence'
          : entry.role === 'collaboration'
          ? 'with team discussion'
          : 'after waiting for clarity';
      label = `${label} ${roleHint}`;
    }

    diversified.push({
      role: entry.role,
      label: normalizeText(label),
    });
  });

  return diversified;
};

const generateMcqOptions = ({
  questionText = '',
  intentTag = '',
  questionType = '',
  traitFocus = '',
} = {}) => {
  const family = inferIntentFamily({ intentTag, questionText, traitFocus });
  const contextToken = extractContextToken(questionText);
  const seed = `${intentTag}|${questionText}|${questionType}|${traitFocus}`;

  const roleItems = ensureRoleLabelDiversity({
    items: buildLabelsByRole({ family, contextToken, seed }),
    contextToken,
  });

  return roleItems.slice(0, 4).map((item, index) => ({
    id: OPTION_IDS[index],
    label: item.label,
    weight: OPTION_WEIGHTS[index] || 3,
    role: item.role,
  }));
};

module.exports = {
  generateMcqOptions,
};
