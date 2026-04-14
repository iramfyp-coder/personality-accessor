const crypto = require('crypto');
const { config } = require('../../config/env');
const { extractOutputText, parseJsonFromText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');
const { generateMcqOptions } = require('./mcq-option-engine.service');
const { INTENT_KEYS } = require('./questionIntentLibrary');
const { buildPsychometricQuestionPlan } = require('./psychometric-question-quality.service');

const DIFFICULTY_LEVELS = ['easy', 'medium', 'advanced'];
const EXPERIENCE_LEVELS = ['junior', 'mid', 'senior'];

const MIN_QUESTION_COUNT = 22;
const BASE_QUESTION_COUNT = 22;
const MAX_QUESTION_COUNT = 26;
const QUESTION_EXTENSION_STEP = 4;
const LOW_CONFIDENCE_EXTENSION_THRESHOLD = 0.78;

const MAX_AI_QUESTION_COUNT = 0;
const MAX_AI_ATTEMPTS_PER_SLOT = 1;
const AI_GENERATION_BUDGET_MS = 12000;
const AI_REQUEST_TIMEOUT_MS = 3600;
const EMBEDDING_TIMEOUT_MS = 3200;

const QUESTION_LENGTH_MIN = 13;
const QUESTION_LENGTH_MAX = 22;
const QUESTION_LENGTH_TARGET_MIN = 17;
const QUESTION_LENGTH_TARGET_MAX = 19;

const QUESTION_TYPES = ['mcq', 'scenario', 'text', 'likert', 'scale'];
const QUESTION_STAGES = ['personality', 'cognitive', 'behavior', 'career'];
const QUESTION_THEMES = ['personal', 'social', 'decision', 'leadership', 'creative', 'stress', 'workplace'];
const ANSWER_FORMATS = ['choice', 'scenario_decision'];
const SCORING_TYPES = ['weighted', 'behavior_signal', 'cognitive_signal'];

const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

const CONTEXT_MIX_WEIGHTS = {
  personality_general: 0.7,
  cognitive_scenario: 0.2,
  cv_specific: 0.1,
};

const CATEGORY_DISTRIBUTION = {
  leadership: 3,
  decision_making: 3,
  creativity: 3,
  risk: 3,
  team_style: 3,
  adaptability: 3,
  analytical: 2,
  personality: 2,
};

const BASE_INTENT_BLUEPRINTS = [
  {
    intentTag: 'leadership_decision_alignment',
    category: 'leadership',
    trait: 'leadership',
    stage: 'personality',
    theme: 'leadership',
    description: 'Measures whether leadership is directive or consensus-led.',
  },
  {
    intentTag: 'leadership_conflict_resolution',
    category: 'leadership',
    trait: 'conflict_handling',
    stage: 'personality',
    theme: 'leadership',
    description: 'Measures leadership behavior in conflict moments.',
  },
  {
    intentTag: 'leadership_ownership_pressure',
    category: 'leadership',
    trait: 'leadership',
    stage: 'personality',
    theme: 'leadership',
    description: 'Measures ownership under pressure.',
  },

  {
    intentTag: 'decision_tradeoff_speed_quality',
    category: 'decision_making',
    trait: 'decision_quality',
    stage: 'cognitive',
    theme: 'decision',
    description: 'Measures speed-quality tradeoff style.',
  },
  {
    intentTag: 'decision_priority_conflict',
    category: 'decision_making',
    trait: 'decision_quality',
    stage: 'cognitive',
    theme: 'decision',
    description: 'Measures prioritization with competing demands.',
  },
  {
    intentTag: 'decision_ethics_constraint',
    category: 'decision_making',
    trait: 'decision_quality',
    stage: 'behavior',
    theme: 'decision',
    description: 'Measures ethical judgment under constraints.',
  },

  {
    intentTag: 'creativity_experiment_choice',
    category: 'creativity',
    trait: 'creativity',
    stage: 'cognitive',
    theme: 'creative',
    description: 'Measures willingness to test novel approaches.',
  },
  {
    intentTag: 'creativity_constraint_reframe',
    category: 'creativity',
    trait: 'creativity',
    stage: 'cognitive',
    theme: 'creative',
    description: 'Measures creative reframing under limits.',
  },
  {
    intentTag: 'creativity_process_iteration',
    category: 'creativity',
    trait: 'creativity',
    stage: 'personality',
    theme: 'creative',
    description: 'Measures iteration preference versus routine adherence.',
  },

  {
    intentTag: 'risk_uncertain_opportunity',
    category: 'risk',
    trait: 'risk_tolerance',
    stage: 'career',
    theme: 'stress',
    description: 'Measures action style under uncertainty.',
  },
  {
    intentTag: 'risk_mitigation_strategy',
    category: 'risk',
    trait: 'risk_tolerance',
    stage: 'career',
    theme: 'decision',
    description: 'Measures mitigation-first versus speed-first behavior.',
  },
  {
    intentTag: 'risk_reversal_recovery',
    category: 'risk',
    trait: 'risk_tolerance',
    stage: 'behavior',
    theme: 'stress',
    description: 'Measures recovery choices after risky outcomes.',
  },

  {
    intentTag: 'team_style_consensus_speed',
    category: 'team_style',
    trait: 'team_preference',
    stage: 'personality',
    theme: 'social',
    description: 'Measures consensus versus fast-direction tendency.',
  },
  {
    intentTag: 'team_style_feedback_handling',
    category: 'team_style',
    trait: 'team_preference',
    stage: 'personality',
    theme: 'social',
    description: 'Measures response style to team feedback.',
  },
  {
    intentTag: 'team_style_role_coordination',
    category: 'team_style',
    trait: 'team_preference',
    stage: 'behavior',
    theme: 'workplace',
    description: 'Measures coordination behavior under delivery pressure.',
  },

  {
    intentTag: 'adaptability_change_response',
    category: 'adaptability',
    trait: 'adaptability',
    stage: 'personality',
    theme: 'workplace',
    description: 'Measures first response to change.',
  },
  {
    intentTag: 'adaptability_learning_loop',
    category: 'adaptability',
    trait: 'adaptability',
    stage: 'personality',
    theme: 'personal',
    description: 'Measures adaptation through feedback loops.',
  },
  {
    intentTag: 'adaptability_plan_pivot',
    category: 'adaptability',
    trait: 'adaptability',
    stage: 'cognitive',
    theme: 'decision',
    description: 'Measures pivot behavior when plans break.',
  },

  {
    intentTag: 'analysis_incomplete_data_estimation',
    category: 'analytical',
    trait: 'analytical_reasoning',
    stage: 'cognitive',
    theme: 'decision',
    description: 'Measures estimation versus waiting style with incomplete data.',
  },
  {
    intentTag: 'analysis_signal_validation',
    category: 'analytical',
    trait: 'analytical_reasoning',
    stage: 'cognitive',
    theme: 'workplace',
    description: 'Measures validation style under conflicting evidence.',
  },

  {
    intentTag: 'personality_confidence_style',
    category: 'personality',
    trait: 'confidence_style',
    stage: 'personality',
    theme: 'personal',
    description: 'Measures confidence posture in ambiguous decisions.',
  },
  {
    intentTag: 'personality_ambiguity_tolerance',
    category: 'personality',
    trait: 'ambiguity_tolerance',
    stage: 'personality',
    theme: 'personal',
    description: 'Measures tolerance for unresolved ambiguity.',
  },
];

const SUPPLEMENTAL_INTENT_BLUEPRINTS = [
  {
    intentTag: 'leadership_delegation_calibration',
    category: 'leadership',
    trait: 'leadership',
    stage: 'behavior',
    theme: 'leadership',
    description: 'Refines delegation style confidence.',
  },
  {
    intentTag: 'risk_allocation_calibration',
    category: 'risk',
    trait: 'risk_tolerance',
    stage: 'career',
    theme: 'stress',
    description: 'Refines risk allocation confidence.',
  },
  {
    intentTag: 'creativity_reframe_calibration',
    category: 'creativity',
    trait: 'creativity',
    stage: 'cognitive',
    theme: 'creative',
    description: 'Refines innovation-versus-routine confidence.',
  },
  {
    intentTag: 'analysis_noise_calibration',
    category: 'analytical',
    trait: 'analytical_reasoning',
    stage: 'cognitive',
    theme: 'decision',
    description: 'Refines evidence quality confidence.',
  },
];

const INTENT_POOL = INTENT_KEYS;

const OCEAN_BY_TRAIT = {
  leadership: 'E',
  conflict_handling: 'A',
  decision_quality: 'C',
  creativity: 'O',
  risk_tolerance: 'N',
  team_preference: 'A',
  adaptability: 'O',
  analytical_reasoning: 'C',
  confidence_style: 'E',
  ambiguity_tolerance: 'N',
};

const DEFAULT_MCQ_WEIGHTS = [5, 4, 3, 2];
const MCQ_OPTION_IDS = ['A', 'B', 'C', 'D'];

const EMBEDDING_MODEL = 'text-embedding-3-small';

const PROMPT_ENGINE_MASTER =
  'Generate one concise psychometric decision question between 13–22 words.\nSingle scenario.\nSingle decision.\nNo explanation.\nNo scale instruction.\nNo repetition of prior intent.\nFocus on personality inference.';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const normalizeText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTextForSimilarity = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toWords = (value = '') =>
  normalizeText(value)
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

const wordCount = (value = '') => toWords(value).length;

const toQuestionSignature = (value = '') =>
  crypto.createHash('sha1').update(normalizeTextForSimilarity(value)).digest('hex');

const withTimeout = async (promise, timeoutMs = 3000) => {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const toTokenVector = (text = '') => {
  const vector = new Map();
  const tokens = normalizeTextForSimilarity(text)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  tokens.forEach((token) => {
    vector.set(token, Number(vector.get(token) || 0) + 1);
  });

  return vector;
};

const cosineFromTokenVectors = (leftText = '', rightText = '') => {
  const left = toTokenVector(leftText);
  const right = toTokenVector(rightText);

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  left.forEach((value, key) => {
    leftMag += value * value;
    if (right.has(key)) {
      dot += value * Number(right.get(key) || 0);
    }
  });

  right.forEach((value) => {
    rightMag += value * value;
  });

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const cosineFromEmbeddings = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || !right.length) {
    return 0;
  }

  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  for (let index = 0; index < size; index += 1) {
    const l = Number(left[index] || 0);
    const r = Number(right[index] || 0);
    dot += l * r;
    leftMag += l * l;
    rightMag += r * r;
  }

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const toCategoryTotals = (skills = []) =>
  (Array.isArray(skills) ? skills : []).reduce((accumulator, skill) => {
    if (!skill || typeof skill !== 'object') {
      return accumulator;
    }

    const category = String(skill.category || 'general').toLowerCase();
    const level = Number(skill.level || 1);

    accumulator[category] = (accumulator[category] || 0) + clamp(level, 1, 5);
    return accumulator;
  }, {});

const toSkillHighlights = (skills = []) =>
  (Array.isArray(skills) ? skills : [])
    .filter((skill) => skill && typeof skill === 'object')
    .sort((a, b) => Number(b.level || 0) - Number(a.level || 0))
    .slice(0, 12)
    .map((skill) => normalizeText(skill.name || ''))
    .filter(Boolean);

const inferDomainCategory = ({ cvData = {}, categoryTotals = {} }) => {
  if (cvData?.source_domain) {
    return String(cvData.source_domain);
  }

  const ranked = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategory = String(ranked[0]?.[0] || '').toLowerCase();

  if (topCategory.includes('health') || topCategory.includes('medical')) {
    return 'healthcare';
  }

  if (topCategory.includes('finance') || topCategory.includes('business')) {
    return 'business';
  }

  if (topCategory.includes('creative') || topCategory.includes('design')) {
    return 'creative';
  }

  if (topCategory.includes('education') || topCategory.includes('research')) {
    return 'education';
  }

  if (topCategory.includes('service') || topCategory.includes('operations')) {
    return 'operations';
  }

  return 'general';
};

const inferYearsOfExperience = (experience = []) => {
  const lines = Array.isArray(experience) ? experience : [];

  const years = lines.reduce((maxYears, line) => {
    const match = String(line).match(/(\d+)\+?\s*(?:years|yrs|year)/i);
    if (!match) {
      return maxYears;
    }

    return Math.max(maxYears, Number(match[1] || 0));
  }, 0);

  if (years > 0) {
    return years;
  }

  return Math.min(lines.length, 12);
};

const calculateEducationStrength = (education = []) => {
  const lines = Array.isArray(education) ? education : [];

  if (!lines.length) {
    return 28;
  }

  const score = lines.reduce((value, line) => {
    const lower = String(line).toLowerCase();
    let delta = 8;

    if (lower.includes('phd') || lower.includes('doctorate')) {
      delta += 18;
    } else if (lower.includes('master')) {
      delta += 12;
    } else if (lower.includes('bachelor')) {
      delta += 8;
    }

    if (lower.includes('certification') || lower.includes('bootcamp')) {
      delta += 4;
    }

    return value + delta;
  }, 0);

  return clamp(score, 20, 100);
};

const inferExperienceBand = ({ yearsOfExperience = 0, educationStrength = 0 }) => {
  if (yearsOfExperience >= 8 || educationStrength >= 78) {
    return 'senior';
  }

  if (yearsOfExperience >= 3 || educationStrength >= 48) {
    return 'mid';
  }

  return 'junior';
};

const inferAgeGroup = ({ yearsOfExperience = 0 }) => {
  if (yearsOfExperience <= 2) {
    return '18-25';
  }

  if (yearsOfExperience >= 16) {
    return '40+';
  }

  return yearsOfExperience <= 6 ? '25-40' : '40+';
};

const domainRoleFromCategory = (domainCategory = 'general') => {
  const lower = String(domainCategory || '').toLowerCase();

  if (lower.includes('health')) return 'healthcare professional';
  if (lower.includes('business')) return 'business professional';
  if (lower.includes('creative')) return 'creative professional';
  if (lower.includes('education')) return 'education professional';
  if (lower.includes('operations')) return 'operations professional';
  return 'professional';
};

const buildUserProfileVector = (cvData = {}) => {
  const skills = Array.isArray(cvData.skills) ? cvData.skills : [];
  const categoryTotals = toCategoryTotals(skills);
  const educationStrength = calculateEducationStrength(cvData.education || []);
  const yearsOfExperience = inferYearsOfExperience(cvData.experience || []);
  const domainCategory = inferDomainCategory({ cvData, categoryTotals });
  const experience = inferExperienceBand({ yearsOfExperience, educationStrength });
  const skillHighlights = toSkillHighlights(skills);
  const interests = (Array.isArray(cvData.interests) ? cvData.interests : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 10);
  const tools = (Array.isArray(cvData.tools) ? cvData.tools : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 10);
  const projects = (Array.isArray(cvData.projects) ? cvData.projects : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 8);
  const education = (Array.isArray(cvData.education) ? cvData.education : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 8);

  return {
    domainCategory,
    domainRole: domainRoleFromCategory(domainCategory),
    skillDominance: categoryTotals,
    skillHighlights,
    cvSignals: {
      domain: domainCategory,
      skills: skillHighlights.slice(0, 8),
      interests,
      tools,
      projects,
      education,
    },
    educationStrength,
    yearsOfExperience,
    experience,
    experienceLevel: experience,
    age_group: inferAgeGroup({ yearsOfExperience }),
    subjectVector: cvData.subjectVector || {},
    skillVector: cvData.skillVector || {},
    interestVector: cvData.interestVector || {},
  };
};

const computeCvComplexity = (cvData = {}) => {
  const skillsCount = Array.isArray(cvData.skills) ? cvData.skills.length : 0;
  const educationCount = Array.isArray(cvData.education) ? cvData.education.length : 0;
  const experienceCount = Array.isArray(cvData.experience) ? cvData.experience.length : 0;
  const subjectsCount = Array.isArray(cvData.subjects) ? cvData.subjects.length : 0;
  const marksCount = Array.isArray(cvData.marks) ? cvData.marks.length : 0;

  const weightedScore =
    skillsCount * 2.1 +
    experienceCount * 2.4 +
    educationCount * 1.5 +
    subjectsCount * 1.1 +
    marksCount * 0.8;

  return clamp(weightedScore / 40, 0, 1);
};

const determineInitialQuestionCount = () => BASE_QUESTION_COUNT;

const buildDifficultyCurve = (totalCount = BASE_QUESTION_COUNT) => {
  const safeTotal = Math.max(1, Number(totalCount || BASE_QUESTION_COUNT));
  const easyCount = Math.max(5, Math.round(safeTotal * 0.3));
  const mediumCount = Math.max(8, Math.round(safeTotal * 0.4));
  const advancedCount = Math.max(0, safeTotal - easyCount - mediumCount);

  return [
    ...Array.from({ length: easyCount }).map(() => 'easy'),
    ...Array.from({ length: mediumCount }).map(() => 'medium'),
    ...Array.from({ length: advancedCount }).map(() => 'advanced'),
  ]
    .slice(0, safeTotal)
    .concat(Array.from({ length: safeTotal }).map(() => 'advanced'))
    .slice(0, safeTotal);
};

const normalizeStage = (value, fallback = 'personality') => {
  const normalized = String(value || '').toLowerCase();
  return QUESTION_STAGES.includes(normalized) ? normalized : fallback;
};

const normalizeTheme = (value, fallback = 'personal') => {
  const normalized = String(value || '').toLowerCase();
  return QUESTION_THEMES.includes(normalized) ? normalized : fallback;
};

const normalizeAnswerFormat = (value, fallback = 'choice') => {
  const normalized = String(value || '').toLowerCase();
  return ANSWER_FORMATS.includes(normalized) ? normalized : fallback;
};

const normalizeScoringType = (value, fallback = 'weighted') => {
  const normalized = String(value || '').toLowerCase();
  return SCORING_TYPES.includes(normalized) ? normalized : fallback;
};

const toOceanTrait = (trait = '') => OCEAN_BY_TRAIT[String(trait || '').toLowerCase()] || 'O';

const sanitizePromptNoise = (text = '') =>
  normalizeText(text)
    .replace(/answer on (a )?scale[^.?!]*[.?!]?/gi, '')
    .replace(/rate from \d+ to \d+[^.?!]*[.?!]?/gi, '')
    .replace(/multi[- ]sentence[^.?!]*[.?!]?/gi, '')
    .replace(/\btechnically\b/gi, '')
    .replace(/\btherefore\b/gi, '')
    .replace(/\bmoreover\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const toSingleSentenceQuestion = (text = '') => {
  const cleaned = sanitizePromptNoise(text);
  if (!cleaned) {
    return '';
  }

  const fragments = cleaned
    .split(/[.?!]+/)
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (fragments.length >= 2 && /\bdo you\b/i.test(fragments[1])) {
    const first = fragments[0].replace(/[?]+$/g, '');
    const second = fragments[1].replace(/[?]+$/g, '');
    return `${first}. ${second}?`;
  }

  const sentence = fragments[0] || cleaned;
  return sentence.endsWith('?') ? sentence : `${sentence}?`;
};

const ensureScenarioCue = (text = '') => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '';
  }

  if (/\b(team|deadline|project|decision|situation|plan|data|feedback|stakeholder|change)\b/i.test(normalized)) {
    return normalized;
  }

  return `A real situation appears unexpectedly. ${normalized.replace(/^./, (char) => char.toLowerCase())}`;
};

const ensureDecisionCue = (text = '') => {
  const normalized = normalizeText(text).replace(/[.]+$/, '');
  if (!normalized) {
    return '';
  }

  if (/\bor\b/i.test(normalized)) {
    return normalized.endsWith('?') ? normalized : `${normalized}?`;
  }

  const withoutQuestion = normalized.replace(/\?+$/, '');
  return `${withoutQuestion} Do you act quickly or gather input first?`;
};

const padQuestionToLength = (text = '', intentTag = '') => {
  let question = normalizeText(text).replace(/\?+$/, '');

  const boostersByIntent = {
    leadership: 'while keeping team trust and accountability visible',
    decision: 'while balancing speed, quality, and long-term impact',
    creativity: 'while resources stay limited and expectations remain high',
    risk: 'while uncertainty stays high and outcomes remain unclear',
    team: 'while collaboration quality and delivery pace both matter',
    adaptability: 'while priorities shift and expectations change suddenly',
    analytical: 'while data is partial and assumptions may be wrong',
    personality: 'while confidence and ambiguity both influence your choice',
  };

  const lowerIntent = String(intentTag || '').toLowerCase();
  const families = [
    ['leadership', /lead/],
    ['decision', /decision|priority|tradeoff|ethic/],
    ['creativity', /creativ|innovat|reframe/],
    ['risk', /risk|uncertain/],
    ['team', /team|collab|consensus|conflict/],
    ['adaptability', /adapt|change|pivot/],
    ['analytical', /analysis|analytical|data|signal/],
    ['personality', /personality|confidence|ambiguity/],
  ];

  const family = families.find((entry) => entry[1].test(lowerIntent))?.[0] || 'personality';
  const booster = boostersByIntent[family];

  while (wordCount(question) < QUESTION_LENGTH_MIN) {
    question = `${question} ${booster}`;
    question = normalizeText(question);
  }

  if (wordCount(question) > QUESTION_LENGTH_TARGET_MAX && wordCount(question) <= QUESTION_LENGTH_MAX) {
    // Keep close to target style without violating max.
    const words = toWords(question);
    question = words.slice(0, QUESTION_LENGTH_TARGET_MAX).join(' ');
  }

  return `${question.replace(/\?+$/, '')}?`;
};

const trimQuestionToLength = (text = '') => {
  const fillerWords = new Set([
    'really',
    'very',
    'carefully',
    'significantly',
    'currently',
    'typically',
    'usually',
    'essentially',
    'basically',
    'specifically',
  ]);

  const words = toWords(text).filter((word) => !fillerWords.has(word.toLowerCase()));

  if (words.length <= QUESTION_LENGTH_MAX) {
    return `${words.join(' ').replace(/\?+$/, '')}?`;
  }

  const trimmed = words.slice(0, QUESTION_LENGTH_TARGET_MAX);
  return `${trimmed.join(' ').replace(/\?+$/, '')}?`;
};

const enforceQuestionLength = ({ text = '', intentTag = '' }) => {
  let next = toSingleSentenceQuestion(text);
  next = ensureScenarioCue(next);
  next = ensureDecisionCue(next);

  if (!next) {
    return '';
  }

  if (wordCount(next) > QUESTION_LENGTH_MAX) {
    next = trimQuestionToLength(next);
  }

  if (wordCount(next) < QUESTION_LENGTH_MIN) {
    next = padQuestionToLength(next, intentTag);
  }

  if (wordCount(next) > QUESTION_LENGTH_MAX) {
    next = trimQuestionToLength(next);
  }

  if (!next.endsWith('?')) {
    next = `${next.replace(/\?+$/, '')}?`;
  }

  return normalizeText(next);
};

const toStringList = (value = [], limit = 16) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, limit);

const buildFallbackQuestionText = ({ slot, profileVector = {} }) => {
  const domain = String(profileVector.domainRole || 'professional environment');
  const skill = String(profileVector.skillHighlights?.[0] || 'your strongest skill');

  const templates = {
    leadership_decision_alignment:
      'Team direction splits suddenly. Do you decide fast or gather viewpoints before committing the next step?',
    leadership_conflict_resolution:
      'Two strong voices clash publicly. Do you intervene immediately or listen first before deciding a resolution path?',
    leadership_ownership_pressure:
      'Delivery slips under pressure. Do you take ownership now or redistribute responsibility before setting a clear plan?',
    decision_tradeoff_speed_quality:
      'Deadline closes fast and quality is mixed. Do you ship now or refine further before release?',
    decision_priority_conflict:
      'Multiple urgent tasks collide today. Do you prioritize impact first or fairness across all requests before deciding?',
    decision_ethics_constraint:
      'A shortcut saves time but feels questionable. Do you proceed quickly or pause and choose the ethical route?',
    creativity_experiment_choice:
      'Current process works but feels stale. Do you test a new idea or keep the proven method this cycle?',
    creativity_constraint_reframe:
      'Resources drop unexpectedly mid-plan. Do you reframe the approach creatively or narrow scope and follow routine?',
    creativity_process_iteration:
      'A concept is promising but incomplete. Do you iterate rapidly or wait for a polished version first?',
    risk_uncertain_opportunity:
      'An uncertain opportunity appears late. Do you explore quickly or wait until evidence becomes clearer?',
    risk_mitigation_strategy:
      'Potential gain is high but downside exists. Do you pilot cautiously or commit broadly with confidence now?',
    risk_reversal_recovery:
      'A risky decision backfires publicly. Do you reverse immediately or stabilize first before changing direction?',
    team_style_consensus_speed:
      'Team members disagree on next move. Do you seek consensus first or choose direction quickly to maintain pace?',
    team_style_feedback_handling:
      'Critical feedback arrives moments before action. Do you adapt the plan now or continue with current approach?',
    team_style_role_coordination:
      'Roles overlap and confusion grows. Do you clarify ownership first or push execution while details settle?',
    adaptability_change_response:
      'Priorities shift without warning. Do you pivot immediately or keep the original plan until more clarity appears?',
    adaptability_learning_loop:
      'Your approach underperforms twice. Do you change strategy now or collect more feedback before adjusting again?',
    adaptability_plan_pivot:
      'Late information challenges the roadmap. Do you revise milestones now or protect existing commitments first?',
    analysis_incomplete_data_estimation:
      'Data stays incomplete before a deadline. Do you estimate a path or delay the decision for certainty?',
    analysis_signal_validation:
      'Signals conflict across sources today. Do you trust strongest evidence or gather more validation before deciding?',
    personality_confidence_style:
      'Confidence is low but decision is required. Do you commit now or seek reassurance before acting?',
    personality_ambiguity_tolerance:
      'Ambiguity remains after discussion. Do you choose a direction now or wait until uncertainty reduces further?',
    leadership_delegation_calibration:
      'Team workload spikes unexpectedly. Do you delegate immediately or retain control until quality risks are clearer?',
    risk_allocation_calibration:
      'Resources are limited across uncertain options. Do you spread risk gradually or focus on one bold bet?',
    creativity_reframe_calibration:
      'A familiar solution stalls progress. Do you reframe the problem now or optimize the existing approach?',
    analysis_noise_calibration:
      'Noisy data obscures patterns today. Do you decide with assumptions or pause for cleaner evidence?',
  };

  const selected = templates[slot.intentTag] ||
    `A ${domain} scenario pressures ${skill}. Do you decide immediately or collect more input before choosing?`;

  return enforceQuestionLength({
    text: selected,
    intentTag: slot.intentTag,
  });
};

const embeddingCache = new Map();

const getEmbeddings = async (texts = []) => {
  const normalized = texts
    .map((text) => normalizeText(text))
    .filter(Boolean);

  if (!normalized.length) {
    return new Map();
  }

  const uncached = normalized.filter((text) => !embeddingCache.has(text));

  if (uncached.length && config.openaiApiKey) {
    const response = await getOpenAiClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: uncached,
    });

    const rows = Array.isArray(response?.data) ? response.data : [];

    rows.forEach((row, index) => {
      const original = uncached[index];
      if (!original) {
        return;
      }

      embeddingCache.set(original, Array.isArray(row?.embedding) ? row.embedding : []);
    });
  }

  const resolved = new Map();
  normalized.forEach((text) => {
    resolved.set(text, embeddingCache.get(text) || []);
  });

  return resolved;
};

const hasSemanticDuplicate = async ({ text = '', references = [], threshold = 0.8 }) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return true;
  }

  const signature = toQuestionSignature(normalized);

  const lightweightDuplicate = references.some((entry) => {
    if (!entry) {
      return false;
    }

    if (entry.signature && entry.signature === signature) {
      return true;
    }

    const lexicalScore = cosineFromTokenVectors(normalized, entry.text || '');
    return lexicalScore >= 0.9;
  });

  if (lightweightDuplicate) {
    return true;
  }

  const lexicalScores = references.map((entry) =>
    cosineFromTokenVectors(normalized, entry?.text || '')
  );
  const lexicalMax = lexicalScores.length ? Math.max(...lexicalScores) : 0;

  if (lexicalMax < 0.55) {
    return false;
  }

  if (!config.openaiApiKey) {
    return references.some((entry) => cosineFromTokenVectors(normalized, entry?.text || '') >= threshold);
  }

  const candidates = references
    .map((entry) => normalizeText(entry?.text || ''))
    .filter(Boolean)
    .slice(-40);

  if (!candidates.length) {
    return false;
  }

  try {
    const vectors = await withTimeout(
      getEmbeddings([normalized, ...candidates]),
      EMBEDDING_TIMEOUT_MS
    );

    if (!vectors || typeof vectors.get !== 'function') {
      return references.some((entry) => cosineFromTokenVectors(normalized, entry?.text || '') >= threshold);
    }

    const source = vectors.get(normalized) || [];

    const hasDuplicate = candidates.some((candidateText) => {
      const target = vectors.get(candidateText) || [];
      const score = cosineFromEmbeddings(source, target);
      return score > threshold;
    });

    if (hasDuplicate) {
      return true;
    }

    return false;
  } catch (error) {
    return references.some((entry) => cosineFromTokenVectors(normalized, entry?.text || '') >= threshold);
  }
};

const generateOneQuestionWithAi = async ({ slot, cvData = {}, profileVector = {}, usedIntentTags = [] }) => {
  if (!config.openaiApiKey) {
    return null;
  }

  const skills = toStringList((cvData.skills || []).map((skill) => skill?.name), 8).join('; ') || 'n/a';
  const interests = toStringList(cvData.interests, 8).join('; ') || 'n/a';
  const subjects = toStringList(cvData.subjects, 6).join('; ') || 'n/a';
  const roleHint = normalizeText(
    cvData.userRole || profileVector.experienceLevel || profileVector.domainRole || 'professional'
  );

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    temperature: 0.35,
    max_output_tokens: 180,
    input: [
      {
        role: 'system',
        content: 'You generate concise psychometric decision questions. Return JSON only.',
      },
      {
        role: 'user',
        content: `${PROMPT_ENGINE_MASTER}\n\nReturn JSON: {"text":""}\n\nIntent tag: ${slot.intentTag}\nCategory: ${slot.category}\nTrait: ${slot.trait}\nStage: ${slot.stage}\nContext bucket: ${slot.contextBucket}\nAlready used intents: ${usedIntentTags.join(', ') || 'none'}\nRole hint: ${roleHint}\nDomain hint: ${profileVector.domainCategory || 'general'}\nSkills: ${skills}\nSubjects: ${subjects}\nInterests: ${interests}`,
      },
    ],
  });

  const outputText = extractOutputText(response);
  const parsed = parseJsonFromText(outputText, 'Question generation output is invalid');

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return normalizeText(parsed.text || parsed.question || parsed.prompt || '');
};

const normalizeQuestionType = (value, fallback = 'mcq') => {
  const normalized = String(value || '').toLowerCase();
  return QUESTION_TYPES.includes(normalized) ? normalized : fallback;
};

const normalizeMcqOptions = ({ options = [], questionText = '', intentTag = '' }) => {
  const normalized = (Array.isArray(options) ? options : [])
    .map((option, index) => {
      if (typeof option === 'string') {
        const label = normalizeText(option);
        if (!label) {
          return null;
        }

        return {
          id: MCQ_OPTION_IDS[index] || `OPT_${index + 1}`,
          label,
          weight: DEFAULT_MCQ_WEIGHTS[index] || 3,
        };
      }

      if (!option || typeof option !== 'object') {
        return null;
      }

      const label = normalizeText(option.label || option.text || option.option || '');
      if (!label) {
        return null;
      }

      const rawWeight = Number(option.weight ?? option.score ?? DEFAULT_MCQ_WEIGHTS[index] ?? 3);

      return {
        id: MCQ_OPTION_IDS[index] || `OPT_${index + 1}`,
        label,
        weight: clamp(Math.round(rawWeight), 1, 5),
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (normalized.length === 4) {
    const canonical = ['agree', 'disagree', 'neutral', 'yes', 'no'];
    const isGeneric = normalized.some((item) => canonical.includes(String(item.label || '').toLowerCase()));

    if (!isGeneric) {
      return normalized.map((item, index) => ({
        ...item,
        id: MCQ_OPTION_IDS[index],
        weight: clamp(Number(item.weight || DEFAULT_MCQ_WEIGHTS[index] || 3), 1, 5),
      }));
    }
  }

  return generateMcqOptions({
    questionText,
    intentTag,
  });
};

const buildContextBucketQueue = (targetCount = BASE_QUESTION_COUNT) => {
  const safeTarget = Math.max(1, Number(targetCount || BASE_QUESTION_COUNT));
  const cvSpecific = Math.floor(safeTarget * CONTEXT_MIX_WEIGHTS.cv_specific);
  const cognitiveScenario = Math.floor(safeTarget * CONTEXT_MIX_WEIGHTS.cognitive_scenario);
  const personalityGeneral = Math.max(0, safeTarget - cvSpecific - cognitiveScenario);

  const queue = [
    ...Array.from({ length: personalityGeneral }).map(() => 'personality_general'),
    ...Array.from({ length: cognitiveScenario }).map(() => 'cognitive_scenario'),
    ...Array.from({ length: cvSpecific }).map(() => 'cv_specific'),
  ];

  const reordered = [];
  while (queue.length) {
    const personIndex = queue.indexOf('personality_general');
    if (personIndex >= 0) {
      reordered.push(queue.splice(personIndex, 1)[0]);
    }

    const cogIndex = queue.indexOf('cognitive_scenario');
    if (cogIndex >= 0) {
      reordered.push(queue.splice(cogIndex, 1)[0]);
    }

    const cvIndex = queue.indexOf('cv_specific');
    if (cvIndex >= 0) {
      reordered.push(queue.splice(cvIndex, 1)[0]);
    }
  }

  return reordered.slice(0, safeTarget);
};

const withDefaultBlueprintFields = (blueprint = {}) => ({
  ...blueprint,
  answerFormat: 'choice',
  scoringType: blueprint.scoringType || (blueprint.stage === 'cognitive' ? 'cognitive_signal' : 'behavior_signal'),
  uiHint: 'Choose the option closest to your real behavior.',
  expectedLength: 0,
});

const buildIntentSlots = ({ targetCount = BASE_QUESTION_COUNT, baseIndex = 0 }) => {
  const safeTarget = Math.max(1, Number(targetCount || BASE_QUESTION_COUNT));
  const difficultyCurve = buildDifficultyCurve(baseIndex + safeTarget);
  const buckets = buildContextBucketQueue(safeTarget);

  const sourceBlueprints = baseIndex >= BASE_QUESTION_COUNT ? SUPPLEMENTAL_INTENT_BLUEPRINTS : BASE_INTENT_BLUEPRINTS;
  const startOffset = baseIndex >= BASE_QUESTION_COUNT ? baseIndex - BASE_QUESTION_COUNT : baseIndex;
  const selected = sourceBlueprints.slice(startOffset, startOffset + safeTarget).map(withDefaultBlueprintFields);

  return selected.map((blueprint, slotIndex) => ({
    ...blueprint,
    orderIndex: baseIndex + slotIndex,
    contextBucket: buckets[slotIndex] || 'personality_general',
    difficulty: difficultyCurve[baseIndex + slotIndex] || 'medium',
    type: 'mcq',
  }));
};

const buildReferenceEntries = (askedQuestions = []) =>
  (Array.isArray(askedQuestions) ? askedQuestions : [])
    .map((item) => {
      if (!item) {
        return null;
      }

      if (typeof item === 'string') {
        return {
          signature: toQuestionSignature(item),
          text: item,
        };
      }

      const text = normalizeText(item.text || item.question || '');
      const signature = normalizeText(item.signature) || (text ? toQuestionSignature(text) : '');

      if (!signature) {
        return null;
      }

      return {
        signature,
        text,
      };
    })
    .filter(Boolean);

const normalizeGeneratedQuestion = ({ generatedText = '', slot, profileVector, index }) => {
  const fallbackText = buildFallbackQuestionText({ slot, profileVector });
  const text = enforceQuestionLength({
    text: generatedText || fallbackText,
    intentTag: slot.intentTag,
  });

  const options = normalizeMcqOptions({
    options: [],
    questionText: text,
    intentTag: slot.intentTag,
  });

  const idSeed = `${text}-${slot.intentTag}-${slot.difficulty}-${index + 1}`;
  const id = `${toSlug(slot.intentTag)}-${slot.difficulty}-${crypto
    .createHash('md5')
    .update(idSeed)
    .digest('hex')
    .slice(0, 8)}`;

  const stage = normalizeStage(slot.stage, 'personality');
  const theme = normalizeTheme(slot.theme, 'personal');
  const answerFormat = normalizeAnswerFormat(slot.answerFormat, 'choice');
  const scoringType = normalizeScoringType(slot.scoringType, 'weighted');

  return {
    id,
    questionId: id,
    text,
    type: normalizeQuestionType('mcq'),
    category: slot.category,
    trait: slot.trait,
    traitFocus: toOceanTrait(slot.trait),
    traitTarget: slot.trait,
    difficulty: slot.difficulty,
    activeDifficulty: slot.difficulty,
    options,
    scaleMin: null,
    scaleMax: null,
    expectedAnswer: 'A',
    intent: slot.intentTag,
    intentTag: slot.intentTag,
    source: generatedText ? 'planner_ai' : 'planner_fallback',
    answerFormat,
    scoringType,
    theme,
    stage,
    uiHint: slot.uiHint,
    expectedLength: 0,
    contextBucket: slot.contextBucket,
    plannerCategory: slot.category,
    memorySignature: toQuestionSignature(text),
    domainTags: [String(profileVector.domainCategory || '')].filter(Boolean),
    skillTags: (profileVector.skillHighlights || []).slice(0, 8).map((value) => String(value || '').toLowerCase()),
  };
};

const buildQuestionPlanWithPipeline = async ({
  profileVector,
  cvData,
  askedQuestions = [],
  targetCount = BASE_QUESTION_COUNT,
  baseIndex = 0,
}) => {
  const slots = buildIntentSlots({
    targetCount,
    baseIndex,
  });

  const references = buildReferenceEntries(askedQuestions);
  const generated = [];
  const generationStartedAt = Date.now();
  let aiGeneratedCount = 0;

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    let finalQuestion = null;

    const allowAiForSlot =
      Boolean(config.openaiApiKey) &&
      Date.now() - generationStartedAt < AI_GENERATION_BUDGET_MS &&
      aiGeneratedCount < MAX_AI_QUESTION_COUNT;

    for (let attempt = 0; attempt < MAX_AI_ATTEMPTS_PER_SLOT; attempt += 1) {
      const aiCandidate = allowAiForSlot
        ? await withTimeout(
            generateOneQuestionWithAi({
              slot,
              cvData,
              profileVector,
              usedIntentTags: [...generated.map((item) => item.intentTag), ...slots.slice(0, index).map((item) => item.intentTag)],
            }).catch(() => null),
            AI_REQUEST_TIMEOUT_MS
          )
        : null;

      const normalized = normalizeGeneratedQuestion({
        generatedText: aiCandidate || '',
        slot,
        profileVector,
        index: baseIndex + index,
      });

      const localReferences = [
        ...references,
        ...generated.map((item) => ({ signature: item.memorySignature, text: item.text })),
      ];

      const duplicate = await hasSemanticDuplicate({
        text: normalized.text,
        references: localReferences,
        threshold: 0.8,
      });

      if (!duplicate) {
        finalQuestion = normalized;
        if (allowAiForSlot && aiCandidate) {
          aiGeneratedCount += 1;
        }
        break;
      }
    }

    if (!finalQuestion) {
      finalQuestion = normalizeGeneratedQuestion({
        generatedText: '',
        slot,
        profileVector,
        index: baseIndex + index,
      });

      finalQuestion.text = enforceQuestionLength({
        text: `${finalQuestion.text.replace(/\?+$/, '')} for this specific moment`,
        intentTag: slot.intentTag,
      });
      finalQuestion.memorySignature = toQuestionSignature(finalQuestion.text);
      finalQuestion.options = normalizeMcqOptions({
        options: finalQuestion.options,
        questionText: finalQuestion.text,
        intentTag: slot.intentTag,
      });
    }

    generated.push(finalQuestion);
    references.push({
      signature: finalQuestion.memorySignature,
      text: finalQuestion.text,
    });
  }

  return generated.slice(0, targetCount).map((question, index) => ({
    ...question,
    order: baseIndex + index,
  }));
};

const summarizeForIntro = ({ profileVector, questionPlan }) => {
  const intentCounts = questionPlan.reduce((accumulator, item) => {
    const key = item.intentTag || item.intent || 'general';
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const categoryCounts = questionPlan.reduce((accumulator, item) => {
    const key = String(item.category || 'general');
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const contextBuckets = questionPlan.reduce((accumulator, item) => {
    const key = String(item.contextBucket || 'personality_general');
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return {
    greeting: `Your interview is tailored for ${profileVector.domainRole} context and ${profileVector.experience} experience level.`,
    focus: 'You will answer concise psychometric decision questions with unique intents and balanced category coverage.',
    distribution: {
      total: questionPlan.length,
      categories: categoryCounts,
      intents: intentCounts,
      contextBuckets,
      requiredCategoryDistribution: CATEGORY_DISTRIBUTION,
    },
  };
};

const generateQuestionPlan = async ({ cvData = {}, askedQuestions = [], targetCount } = {}) => {
  const profileVector = buildUserProfileVector(cvData);
  const resolvedTargetCount = clamp(
    Number(targetCount || determineInitialQuestionCount({ cvData, profileVector })),
    BASE_QUESTION_COUNT,
    BASE_QUESTION_COUNT
  );

  const mainOutput = buildPsychometricQuestionPlan({
    profileVector,
    cvData,
    askedQuestions,
    targetCount: resolvedTargetCount,
    baseIndex: 0,
  });
  const questionPlan = mainOutput.questionPlan;

  const prefetchedInputMemory = [
    ...(Array.isArray(askedQuestions) ? askedQuestions : []),
    ...questionPlan.map((question) => ({
      signature: question.memorySignature,
      text: question.text,
      intent: question.intentTag || question.intent,
      category: question.category,
      stage: question.stage,
      theme: question.theme,
    })),
  ];

  const supplementalOutput = buildPsychometricQuestionPlan({
    profileVector,
    cvData,
    askedQuestions: prefetchedInputMemory,
    targetCount: QUESTION_EXTENSION_STEP,
    baseIndex: BASE_QUESTION_COUNT,
  });
  const prefetchedSupplementalQuestionPlan = supplementalOutput.questionPlan;

  const questionPoolBackup = mainOutput.questionPoolBackup;

  return {
    profileVector,
    questionPlan,
    prefetchedSupplementalQuestionPlan,
    questionPoolBackup,
    usedIntents: questionPlan.map((question) => question.intentTag || question.intent),
    askedQuestionMemory: questionPlan.map((question) => ({
      signature: question.memorySignature,
      text: question.text,
      category: question.category,
      intent: question.intentTag || question.intent,
      stage: question.stage,
      theme: question.theme,
      createdAt: new Date().toISOString(),
    })),
    smartIntro: summarizeForIntro({ profileVector, questionPlan }),
    targetQuestionCount: resolvedTargetCount,
    cvComplexity: Number(computeCvComplexity(cvData).toFixed(4)),
    psychometricDiagnostics: mainOutput.diagnostics || {},
  };
};

const toScoreFromAnswerValue = (value, type = 'likert', scaleMin = 1, scaleMax = 10) => {
  if (type === 'scale') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0.5;
    }

    const min = clamp(Number(scaleMin || 1), 1, 10);
    const max = clamp(Number(scaleMax || 10), min + 1, 10);
    return clamp((numeric - min) / (max - min), 0, 1);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp((value - 1) / 4, 0, 1);
  }

  if (value && typeof value === 'object') {
    const candidate = Number(value.normalizedScore || value.score || value.weight || 3);
    return clamp((candidate - 1) / 4, 0, 1);
  }

  return 0.5;
};

const extractAnswerScore = ({ answer, question }) => {
  if (!answer) {
    return 0.5;
  }

  const type = String(question?.type || answer.type || 'likert').toLowerCase();

  if (answer.value && typeof answer.value === 'object' && Number.isFinite(Number(answer.value.normalizedScore))) {
    const normalizedScore = clamp(Number(answer.value.normalizedScore), 1, 5);
    return clamp((normalizedScore - 1) / 4, 0, 1);
  }

  return toScoreFromAnswerValue(
    answer.value,
    type,
    Number(question?.scaleMin || 1),
    Number(question?.scaleMax || 10)
  );
};

const computeAdaptiveConfidence = ({ answers = [], questionPlan = [] }) => {
  const normalizedAnswers = Array.isArray(answers) ? answers : [];
  const totalQuestions = Math.max(
    1,
    Array.isArray(questionPlan) && questionPlan.length ? questionPlan.length : BASE_QUESTION_COUNT
  );

  if (!normalizedAnswers.length) {
    return 0;
  }

  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const scores = normalizedAnswers.map((answer) => {
    const question = byQuestionId.get(answer.questionId);
    return extractAnswerScore({ answer, question });
  });

  const coverage = clamp(normalizedAnswers.length / totalQuestions, 0, 1);
  const avg = scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1);
  const variance = scores.reduce((sum, score) => sum + (score - avg) ** 2, 0) / Math.max(scores.length, 1);
  const consistency = clamp(1 - variance / 0.25, 0, 1);
  const decisiveness =
    (scores.reduce((sum, score) => sum + Math.abs(score - 0.5), 0) / Math.max(scores.length, 1)) * 2;

  const confidence = clamp(coverage * 0.4 + consistency * 0.35 + decisiveness * 0.25, 0, 1);
  return Number(confidence.toFixed(4));
};

const computeFatigueMetrics = ({ answerTelemetry = [], totalQuestions = BASE_QUESTION_COUNT }) => {
  const telemetry = Array.isArray(answerTelemetry) ? answerTelemetry : [];

  if (!telemetry.length) {
    return {
      averageAnswerTimeMs: 0,
      neutralRate: 0,
      skipRate: 0,
      shortResponseRate: 0,
      isFatigued: false,
      fatigueMode: null,
    };
  }

  const timeValues = telemetry
    .map((item) => Number(item?.responseTimeMs || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  const averageAnswerTimeMs = timeValues.length
    ? Math.round(timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length)
    : 0;

  const neutralCount = telemetry.filter((item) => Boolean(item?.isNeutral)).length;
  const skippedCount = telemetry.filter((item) => Boolean(item?.isSkipped)).length;
  const shortResponseCount = timeValues.filter((value) => value > 0 && value < 2500).length;

  const neutralRate = clamp(neutralCount / telemetry.length, 0, 1);
  const skipRate = clamp(skippedCount / Math.max(totalQuestions, 1), 0, 1);
  const shortResponseRate = clamp(shortResponseCount / Math.max(timeValues.length, 1), 0, 1);

  const isFatigued = telemetry.length >= 5 && (shortResponseRate >= 0.72 || averageAnswerTimeMs < 2400);

  return {
    averageAnswerTimeMs,
    neutralRate: Number(neutralRate.toFixed(4)),
    skipRate: Number(skipRate.toFixed(4)),
    shortResponseRate: Number(shortResponseRate.toFixed(4)),
    isFatigued,
    fatigueMode: isFatigued ? 'quick_choice' : null,
  };
};

const adaptUpcomingQuestions = ({ session }) => {
  const plan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];
  return plan;
};

const detectAnswerInconsistency = ({ answers = [], questionPlan = [] }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const scoreByIntentKey = (matcher) => {
    const matched = (Array.isArray(answers) ? answers : []).filter((answer) => {
      const question = byQuestionId.get(answer.questionId);
      const intent = String(question?.intentTag || question?.intent || answer?.metadata?.intent || '').toLowerCase();
      return matcher(intent);
    });

    if (!matched.length) {
      return 0.5;
    }

    const avg =
      matched.reduce((sum, answer) => {
        const question = byQuestionId.get(answer.questionId);
        return sum + extractAnswerScore({ answer, question });
      }, 0) / matched.length;

    return clamp(avg, 0, 1);
  };

  const team = scoreByIntentKey((intent) => intent.includes('team_style'));
  const confidence = scoreByIntentKey((intent) => intent.includes('confidence'));
  const risk = scoreByIntentKey((intent) => intent.includes('risk'));
  const adaptability = scoreByIntentKey((intent) => intent.includes('adaptability'));

  const contradictions = [];

  if (team >= 0.75 && confidence <= 0.3) {
    contradictions.push('High team-direction signal with low confidence signal.');
  }

  if (risk >= 0.78 && adaptability <= 0.3) {
    contradictions.push('High risk appetite paired with low adaptability signal.');
  }

  const inconsistencyScore = clamp(contradictions.length * 0.4, 0, 1);

  return {
    isInconsistent: inconsistencyScore >= 0.7,
    inconsistencyScore: Number(inconsistencyScore.toFixed(4)),
    contradictions,
  };
};

const generateSupplementalQuestionPlan = async ({
  cvData = {},
  askedQuestions = [],
  existingQuestionPlan = [],
  additionalCount = QUESTION_EXTENSION_STEP,
}) => {
  const existing = Array.isArray(existingQuestionPlan) ? existingQuestionPlan : [];
  const profileVector = buildUserProfileVector(cvData);

  const safeAdditional = clamp(Number(additionalCount || 0), 0, MAX_QUESTION_COUNT - existing.length);

  if (!safeAdditional || existing.length >= MAX_QUESTION_COUNT) {
    return [];
  }

  const mergedAsked = [
    ...(Array.isArray(askedQuestions) ? askedQuestions : []),
    ...existing.map((question) => ({
      signature: question.memorySignature || toQuestionSignature(question.text || ''),
      text: question.text || '',
    })),
  ];

  const supplementalOutput = buildPsychometricQuestionPlan({
    profileVector,
    cvData,
    askedQuestions: mergedAsked,
    targetCount: safeAdditional,
    baseIndex: existing.length,
  });

  return supplementalOutput.questionPlan || [];
};

const evaluateAdaptiveExtensionNeed = ({ session, confidenceThreshold = LOW_CONFIDENCE_EXTENSION_THRESHOLD }) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const questionPlan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];
  const currentCount = questionPlan.length;
  const extensionAlreadyApplied = Boolean(session?.adaptiveMetrics?.confidenceExtensionApplied);

  const confidence = computeAdaptiveConfidence({
    answers: answers.slice(0, BASE_QUESTION_COUNT),
    questionPlan: questionPlan.slice(0, BASE_QUESTION_COUNT),
  });

  const inconsistency = detectAnswerInconsistency({
    answers: answers.slice(0, BASE_QUESTION_COUNT),
    questionPlan: questionPlan.slice(0, BASE_QUESTION_COUNT),
  });

  if (
    extensionAlreadyApplied ||
    currentCount < BASE_QUESTION_COUNT ||
    answers.length < BASE_QUESTION_COUNT ||
    currentCount >= MAX_QUESTION_COUNT
  ) {
    return {
      extraQuestions: 0,
      reasons: [],
      confidence,
      inconsistency,
      refiningMessage: '',
    };
  }

  if (confidence < confidenceThreshold) {
    return {
      extraQuestions: clamp(QUESTION_EXTENSION_STEP, 0, MAX_QUESTION_COUNT - currentCount),
      reasons: ['low_confidence'],
      confidence,
      inconsistency,
      refiningMessage: 'Refining your profile for better accuracy…',
    };
  }

  return {
    extraQuestions: 0,
    reasons: [],
    confidence,
    inconsistency,
    refiningMessage: '',
  };
};

const shouldStopAssessmentEarly = ({ session }) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const questionPlan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];

  const confidence = computeAdaptiveConfidence({ answers, questionPlan });
  const answeredCount = answers.length;
  const shouldStop = answeredCount >= questionPlan.length && confidence >= 0.99;

  return {
    shouldStop,
    confidence,
  };
};

module.exports = {
  buildUserProfileVector,
  generateQuestionPlan,
  generateSupplementalQuestionPlan,
  evaluateAdaptiveExtensionNeed,
  detectAnswerInconsistency,
  adaptUpcomingQuestions,
  computeFatigueMetrics,
  computeAdaptiveConfidence,
  shouldStopAssessmentEarly,
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  INTENT_POOL,
  LIKERT_LABELS,
};
