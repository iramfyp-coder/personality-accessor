const crypto = require('crypto');
const { config } = require('../../config/env');
const { extractOutputText, parseJsonFromText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const DIFFICULTY_LEVELS = ['easy', 'medium', 'advanced'];
const EXPERIENCE_LEVELS = ['junior', 'mid', 'senior'];
const MIN_QUESTION_COUNT = 20;
const BASE_QUESTION_COUNT = 20;
const COMPLEXITY_QUESTION_COUNT = 25;
const LOW_CONFIDENCE_QUESTION_COUNT = 30;
const MAX_QUESTION_COUNT = 35;
const QUESTION_EXTENSION_STEP = 5;
const LOW_CONFIDENCE_EXTENSION_THRESHOLD = 0.7;
const MAX_AI_QUESTION_COUNT = 8;
const MAX_AI_ATTEMPTS_PER_SLOT = 1;
const AI_GENERATION_BUDGET_MS = 24000;
const AI_REQUEST_TIMEOUT_MS = 6500;
const QUESTION_TYPES = ['likert', 'mcq', 'scale', 'text', 'scenario'];
const QUESTION_STAGES = ['personality', 'cognitive', 'behavior', 'career'];
const QUESTION_THEMES = [
  'academic',
  'workplace',
  'social',
  'leadership',
  'creative',
  'technical',
  'personal',
  'decision',
  'stress',
];
const ANSWER_FORMATS = ['rating', 'choice', 'slider', 'text_short', 'text_long', 'scenario_decision'];
const SCORING_TYPES = ['numeric', 'weighted', 'ai_analysis', 'behavior_signal', 'cognitive_signal'];

const QUESTION_FLOW_BLUEPRINTS = [
  {
    intent: 'Learning',
    stage: 'personality',
    category: 'preferences',
    trait: 'learning_orientation',
    answerFormat: 'rating',
    scoringType: 'numeric',
    theme: 'personal',
    uiHint: 'Reflect on your real behavior, not ideal behavior',
    expectedLength: 0,
    description: 'Measure learning orientation and growth discipline.',
  },
  {
    intent: 'Teamwork',
    stage: 'personality',
    category: 'social_traits',
    trait: 'team_preference',
    answerFormat: 'rating',
    scoringType: 'numeric',
    theme: 'social',
    uiHint: 'Think about your default team mode',
    expectedLength: 0,
    description: 'Measure collaboration preference and interpersonal rhythm.',
  },
  {
    intent: 'Independence',
    stage: 'personality',
    category: 'work_style',
    trait: 'independence',
    answerFormat: 'choice',
    scoringType: 'weighted',
    theme: 'workplace',
    uiHint: 'Pick the option closest to your first instinct',
    expectedLength: 0,
    description: 'Measure planning discipline and process consistency.',
  },
  {
    intent: 'Analytical',
    stage: 'cognitive',
    category: 'aptitude',
    trait: 'analytical_reasoning',
    answerFormat: 'choice',
    scoringType: 'cognitive_signal',
    theme: 'technical',
    uiHint: 'Choose the strongest reasoning path',
    expectedLength: 0,
    description: 'Measure reasoning depth and hypothesis quality.',
  },
  {
    intent: 'Planning',
    stage: 'cognitive',
    category: 'decision_making',
    trait: 'decision_quality',
    answerFormat: 'slider',
    scoringType: 'cognitive_signal',
    theme: 'decision',
    uiHint: 'Use the full scale to represent consistency',
    expectedLength: 0,
    description: 'Measure prioritization quality under multi-factor constraints.',
  },
  {
    intent: 'Creativity',
    stage: 'cognitive',
    category: 'creativity',
    trait: 'creativity',
    answerFormat: 'slider',
    scoringType: 'cognitive_signal',
    theme: 'creative',
    uiHint: 'Rate how often this behavior appears in real projects',
    expectedLength: 0,
    description: 'Measure creative synthesis and novelty generation.',
  },
  {
    intent: 'Conflict',
    stage: 'behavior',
    category: 'social_traits',
    trait: 'conflict_handling',
    answerFormat: 'text_short',
    scoringType: 'behavior_signal',
    theme: 'workplace',
    uiHint: 'Describe your action and decision in one concise response',
    expectedLength: 90,
    description: 'Measure behavior quality in tense interpersonal situations.',
  },
  {
    intent: 'Leadership',
    stage: 'behavior',
    category: 'leadership',
    trait: 'leadership',
    answerFormat: 'text_long',
    scoringType: 'ai_analysis',
    theme: 'leadership',
    uiHint: 'Include context, decision path, and measurable outcome',
    expectedLength: 180,
    description: 'Measure ownership, influence, and execution accountability.',
  },
  {
    intent: 'Risk',
    stage: 'career',
    category: 'career',
    trait: 'risk_tolerance',
    answerFormat: 'scenario_decision',
    scoringType: 'behavior_signal',
    theme: 'decision',
    uiHint: 'Select the action you would actually take first',
    expectedLength: 0,
    description: 'Measure risk appetite and mitigation quality for career decisions.',
  },
  {
    intent: 'Deadline',
    stage: 'career',
    category: 'career',
    trait: 'stress_tolerance',
    answerFormat: 'scenario_decision',
    scoringType: 'behavior_signal',
    theme: 'stress',
    uiHint: 'Balance outcomes, quality, and stakeholder impact',
    expectedLength: 0,
    description: 'Measure pressure response and quality preservation near deadlines.',
  },
  {
    intent: 'Values',
    stage: 'personality',
    category: 'values',
    trait: 'value_alignment',
    answerFormat: 'scenario_decision',
    scoringType: 'behavior_signal',
    theme: 'social',
    uiHint: 'Choose the option that reflects what you would really prioritize',
    expectedLength: 0,
    description: 'Measure values under real-world trade-offs.',
  },
  {
    intent: 'Adaptability',
    stage: 'personality',
    category: 'work_style',
    trait: 'adaptability',
    answerFormat: 'choice',
    scoringType: 'weighted',
    theme: 'workplace',
    uiHint: 'Choose your instinctive adaptation strategy',
    expectedLength: 0,
    description: 'Measure flexibility when priorities change suddenly.',
  },
  {
    intent: 'Collaboration',
    stage: 'behavior',
    category: 'teamwork',
    trait: 'team_preference',
    answerFormat: 'scenario_decision',
    scoringType: 'behavior_signal',
    theme: 'social',
    uiHint: 'Pick the first action you would take with the team',
    expectedLength: 0,
    description: 'Measure collaboration quality under pressure.',
  },
  {
    intent: 'Resilience',
    stage: 'behavior',
    category: 'stress',
    trait: 'stress_tolerance',
    answerFormat: 'scenario_decision',
    scoringType: 'behavior_signal',
    theme: 'stress',
    uiHint: 'Choose your first response when plans fail',
    expectedLength: 0,
    description: 'Measure recovery behavior after setbacks.',
  },
  {
    intent: 'Innovation',
    stage: 'cognitive',
    category: 'creativity',
    trait: 'creativity',
    answerFormat: 'scenario_decision',
    scoringType: 'cognitive_signal',
    theme: 'creative',
    uiHint: 'Choose the most practical innovation path',
    expectedLength: 0,
    description: 'Measure innovation decisions under constraints.',
  },
  {
    intent: 'Execution',
    stage: 'cognitive',
    category: 'decision_making',
    trait: 'systematic',
    answerFormat: 'scenario_decision',
    scoringType: 'cognitive_signal',
    theme: 'technical',
    uiHint: 'Prioritize an action that delivers outcome with limited resources',
    expectedLength: 0,
    description: 'Measure execution quality with dependencies and uncertainty.',
  },
  {
    intent: 'Ethics',
    stage: 'behavior',
    category: 'decision_making',
    trait: 'decision_quality',
    answerFormat: 'scenario_decision',
    scoringType: 'behavior_signal',
    theme: 'decision',
    uiHint: 'Select the option that balances ethics, speed, and impact',
    expectedLength: 0,
    description: 'Measure ethical decision behavior in ambiguous scenarios.',
  },
];

const INTENT_POOL = QUESTION_FLOW_BLUEPRINTS.map((item) => item.intent);

const QUESTION_CONTEXT_BUCKETS = ['cv_specific', 'personality_general', 'cognitive_scenario'];
const CONTEXT_MIX_WEIGHTS = {
  cv_specific: 0.3,
  personality_general: 0.4,
  cognitive_scenario: 0.3,
};
const CONTEXT_BUCKET_INTENTS = {
  cv_specific: ['Learning', 'Independence', 'Planning', 'Analytical', 'Leadership', 'Execution'],
  personality_general: ['Teamwork', 'Conflict', 'Values', 'Adaptability', 'Collaboration', 'Resilience'],
  cognitive_scenario: ['Creativity', 'Risk', 'Deadline', 'Innovation', 'Ethics'],
};

const LIKERT_LABELS = [
  'Strongly Disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly Agree',
];

const DEFAULT_MCQ_WEIGHTS = [5, 4, 3, 2];
const MCQ_OPTION_IDS = ['A', 'B', 'C', 'D'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const toSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTextForSimilarity = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toQuestionSignature = (value = '') =>
  crypto.createHash('sha1').update(normalizeTextForSimilarity(value)).digest('hex');

const withTimeout = async (promise, timeoutMs = 4000) => {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
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

const hasDuplicateSimilarity = ({ text, references = [], threshold = 0.82 }) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return true;
  }

  const signature = toQuestionSignature(normalized);

  return references.some((entry) => {
    if (!entry) {
      return false;
    }

    if (entry.signature && entry.signature === signature) {
      return true;
    }

    const score = cosineFromTokenVectors(normalized, entry.text || '');
    return score >= threshold;
  });
};

const OCEAN_BY_TRAIT = {
  analytical: 'C',
  analytical_reasoning: 'C',
  decision_quality: 'C',
  conflict_handling: 'A',
  leadership: 'E',
  stress_tolerance: 'N',
  creativity: 'O',
  risk_tolerance: 'O',
  learning_orientation: 'O',
  team_preference: 'A',
  independence: 'O',
  systematic: 'C',
  social_energy: 'E',
  planning: 'C',
};

const toOceanTrait = (trait = '') => OCEAN_BY_TRAIT[String(trait || '').toLowerCase()] || 'O';

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
    .slice(0, 10)
    .map((skill) => String(skill.name || '').trim())
    .filter(Boolean);

const inferDomainCategory = ({ cvData = {}, categoryTotals = {} }) => {
  if (cvData?.source_domain) {
    return String(cvData.source_domain);
  }

  const ranked = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategory = ranked[0]?.[0] || 'software';

  if (topCategory.includes('design')) {
    return 'design';
  }

  if (topCategory.includes('product')) {
    return 'product';
  }

  if (topCategory.includes('ai') || topCategory.includes('ml') || topCategory.includes('data')) {
    return 'data';
  }

  if (topCategory.includes('marketing')) {
    return 'marketing';
  }

  if (topCategory.includes('business')) {
    return 'business';
  }

  return 'software';
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

  return Math.min(lines.length, 8);
};

const calculateEducationStrength = (education = []) => {
  const lines = Array.isArray(education) ? education : [];

  if (!lines.length) {
    return 20;
  }

  const score = lines.reduce((value, line) => {
    const lower = String(line).toLowerCase();
    let delta = 8;

    if (lower.includes('phd') || lower.includes('doctorate')) {
      delta += 24;
    } else if (lower.includes('master')) {
      delta += 18;
    } else if (lower.includes('bachelor')) {
      delta += 12;
    } else if (lower.includes('bootcamp') || lower.includes('certification')) {
      delta += 6;
    }

    if (lower.includes('computer') || lower.includes('engineering') || lower.includes('science')) {
      delta += 6;
    }

    return value + delta;
  }, 0);

  return clamp(score, 15, 100);
};

const inferExperienceBand = ({ yearsOfExperience = 0, educationStrength = 0 }) => {
  if (yearsOfExperience >= 8 || educationStrength >= 78) {
    return 'senior';
  }

  if (yearsOfExperience >= 3 || educationStrength >= 46) {
    return 'mid';
  }

  return 'junior';
};

const inferAgeGroup = ({ yearsOfExperience = 0, education = [] }) => {
  const educationText = (Array.isArray(education) ? education : []).join(' ').toLowerCase();

  if (yearsOfExperience <= 2 && (educationText.includes('student') || educationText.includes('bachelor'))) {
    return '18-25';
  }

  if (yearsOfExperience >= 16) {
    return '40+';
  }

  return yearsOfExperience <= 6 ? '25-40' : '40+';
};

const domainRoleFromCategory = (domainCategory = 'software') => {
  const lower = String(domainCategory || '').toLowerCase();

  if (lower.includes('software')) {
    return 'developer';
  }

  if (lower.includes('design')) {
    return 'designer';
  }

  if (lower.includes('product')) {
    return 'manager';
  }

  if (lower.includes('data')) {
    return 'analyst';
  }

  if (lower.includes('marketing') || lower.includes('business')) {
    return 'business professional';
  }

  return 'professional';
};

const buildUserProfileVector = (cvData = {}) => {
  const skills = Array.isArray(cvData.skills) ? cvData.skills : [];
  const categoryTotals = toCategoryTotals(skills);
  const educationStrength = calculateEducationStrength(cvData.education || []);
  const yearsOfExperience = inferYearsOfExperience(cvData.experience || []);
  const domainCategory = inferDomainCategory({ cvData, categoryTotals });
  const experience = inferExperienceBand({ yearsOfExperience, educationStrength });

  return {
    domainCategory,
    domainRole: domainRoleFromCategory(domainCategory),
    skillDominance: categoryTotals,
    skillHighlights: toSkillHighlights(skills),
    educationStrength,
    yearsOfExperience,
    experience,
    experienceLevel: experience,
    age_group: inferAgeGroup({ yearsOfExperience, education: cvData.education || [] }),
    subjectVector: cvData.subjectVector || {},
    skillVector: cvData.skillVector || {},
    interestVector: cvData.interestVector || {},
  };
};

const computeCvComplexity = (cvData = {}) => {
  const skillsCount = Array.isArray(cvData.skills) ? cvData.skills.length : 0;
  const educationCount = Array.isArray(cvData.education) ? cvData.education.length : 0;
  const experienceCount = Array.isArray(cvData.experience) ? cvData.experience.length : 0;
  const projectsCount = Array.isArray(cvData.projects) ? cvData.projects.length : 0;
  const subjectsCount = Array.isArray(cvData.subjects) ? cvData.subjects.length : 0;
  const marksCount = Array.isArray(cvData.marks) ? cvData.marks.length : 0;
  const interestCount = Array.isArray(cvData.interests) ? cvData.interests.length : 0;

  const weightedScore =
    skillsCount * 2.8 +
    experienceCount * 2.3 +
    projectsCount * 1.8 +
    educationCount * 1.4 +
    subjectsCount * 1.1 +
    marksCount * 0.9 +
    interestCount * 0.8;

  return clamp(weightedScore / 40, 0, 1);
};

const determineInitialQuestionCount = ({ cvData = {}, profileVector = {} }) => {
  const cvComplexity = computeCvComplexity(cvData);
  const cvConfidence = clamp(Number(cvData?.confidenceScore || 0.62), 0, 1);
  const yearsOfExperience = Number(profileVector?.yearsOfExperience || 0);
  let target = BASE_QUESTION_COUNT;

  if (cvComplexity >= 0.62 || yearsOfExperience >= 5) {
    target = COMPLEXITY_QUESTION_COUNT;
  }

  if (cvConfidence < 0.55) {
    target = LOW_CONFIDENCE_QUESTION_COUNT;
  }

  return clamp(target, MIN_QUESTION_COUNT, LOW_CONFIDENCE_QUESTION_COUNT);
};

const buildDifficultyCurve = (totalCount = BASE_QUESTION_COUNT) => {
  const safeTotal = Math.max(1, Number(totalCount || BASE_QUESTION_COUNT));
  const easyCount = Math.max(3, Math.round(safeTotal * 0.25));
  const mediumCount = Math.max(6, Math.round(safeTotal * 0.4));
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

const answerFormatToType = (answerFormat = '') => {
  const normalized = String(answerFormat || '').toLowerCase();

  if (normalized === 'rating') {
    return 'likert';
  }

  if (normalized === 'choice') {
    return 'mcq';
  }

  if (normalized === 'slider') {
    return 'scale';
  }

  if (normalized === 'scenario_decision') {
    return 'scenario';
  }

  return 'text';
};

const normalizeTheme = (value, fallback = 'personal') => {
  const normalized = String(value || '').toLowerCase();
  return QUESTION_THEMES.includes(normalized) ? normalized : fallback;
};

const normalizeStage = (value, fallback = 'personality') => {
  const normalized = String(value || '').toLowerCase();
  return QUESTION_STAGES.includes(normalized) ? normalized : fallback;
};

const normalizeAnswerFormat = (value, fallback = 'choice') => {
  const normalized = String(value || '').toLowerCase();
  return ANSWER_FORMATS.includes(normalized) ? normalized : fallback;
};

const normalizeScoringType = (value, fallback = 'numeric') => {
  const normalized = String(value || '').toLowerCase();
  return SCORING_TYPES.includes(normalized) ? normalized : fallback;
};

const normalizeExpectedLength = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.round(numeric), 0, 600);
};

const toContextBucketCounts = (targetCount = BASE_QUESTION_COUNT) => {
  const safeTarget = Math.max(1, Number(targetCount || BASE_QUESTION_COUNT));
  const cvSpecific = Math.round(safeTarget * CONTEXT_MIX_WEIGHTS.cv_specific);
  const personalityGeneral = Math.round(safeTarget * CONTEXT_MIX_WEIGHTS.personality_general);
  const cognitiveScenario = Math.max(0, safeTarget - cvSpecific - personalityGeneral);

  return {
    cv_specific: cvSpecific,
    personality_general: personalityGeneral,
    cognitive_scenario: cognitiveScenario,
  };
};

const buildContextBucketQueue = (targetCount = BASE_QUESTION_COUNT) => {
  const counts = toContextBucketCounts(targetCount);
  const queue = [];

  while (queue.length < targetCount) {
    QUESTION_CONTEXT_BUCKETS.forEach((bucket) => {
      if (counts[bucket] > 0 && queue.length < targetCount) {
        queue.push(bucket);
        counts[bucket] -= 1;
      }
    });
  }

  return queue.slice(0, targetCount);
};

const toBlueprintLookup = QUESTION_FLOW_BLUEPRINTS.reduce((accumulator, blueprint) => {
  accumulator[String(blueprint.intent)] = blueprint;
  return accumulator;
}, {});

const enforceThemeAlternation = (slots = []) => {
  const planned = slots.slice();

  for (let index = 1; index < planned.length; index += 1) {
    if (planned[index - 1].theme !== planned[index].theme) {
      continue;
    }

    const swapIndex = planned.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidate.theme !== planned[index].theme &&
        candidate.theme !== planned[index - 1].theme
    );

    if (swapIndex > index) {
      const temp = planned[index];
      planned[index] = planned[swapIndex];
      planned[swapIndex] = temp;
    }
  }

  return planned;
};

const buildIntentSlots = ({ targetCount = BASE_QUESTION_COUNT, baseIndex = 0, totalCount = targetCount }) => {
  const safeTarget = Math.max(1, Number(targetCount || BASE_QUESTION_COUNT));
  const difficultyCurve = buildDifficultyCurve(Math.max(safeTarget, Number(totalCount || safeTarget)));
  const bucketQueue = buildContextBucketQueue(safeTarget);
  const bucketCursors = QUESTION_CONTEXT_BUCKETS.reduce((accumulator, bucket) => {
    accumulator[bucket] = 0;
    return accumulator;
  }, {});

  const slots = bucketQueue.map((bucket, slotIndex) => {
    const intents = CONTEXT_BUCKET_INTENTS[bucket] || INTENT_POOL;
    const cursor = bucketCursors[bucket] || 0;
    const intent = intents[cursor % intents.length] || INTENT_POOL[slotIndex % INTENT_POOL.length];
    const blueprint = toBlueprintLookup[intent] || QUESTION_FLOW_BLUEPRINTS[slotIndex % QUESTION_FLOW_BLUEPRINTS.length];
    const orderIndex = baseIndex + slotIndex;

    bucketCursors[bucket] = cursor + 1;

    return {
      slotIndex,
      orderIndex,
      contextBucket: bucket,
      intent: blueprint.intent,
      type: answerFormatToType(blueprint.answerFormat),
      category: blueprint.category,
      trait: blueprint.trait,
      difficulty: difficultyCurve[orderIndex] || 'advanced',
      description: blueprint.description,
      stage: blueprint.stage,
      theme: normalizeTheme(blueprint.theme, 'personal'),
      answerFormat: normalizeAnswerFormat(blueprint.answerFormat, 'choice'),
      scoringType: normalizeScoringType(blueprint.scoringType, 'numeric'),
      uiHint: normalizeText(blueprint.uiHint || ''),
      expectedLength: normalizeExpectedLength(blueprint.expectedLength || 0, 0),
    };
  });

  return enforceThemeAlternation(slots).slice(0, safeTarget);
};

const fallbackMcqOptionsByIntent = ({ intent, trait, difficulty, profileVector = {} }) => {
  const skill = profileVector.skillHighlights?.[0] || 'your strongest skill';

  const optionsByIntent = {
    Analytical: [
      `Break the problem into hypotheses, test them with available data, and decide quickly`,
      `Ask for more context, compare trade-offs, and choose a balanced path`,
      `Start execution immediately and adjust only when issues appear`,
      `Delay the decision until someone else sets clear direction`,
    ],
    Conflict: [
      `Facilitate both sides, define shared success criteria, and commit to one decision owner`,
      `Listen first, negotiate scope compromises, and proceed with documented trade-offs`,
      `Prioritize your own team's goals and let others adapt`,
      `Avoid confrontation and wait for escalation to resolve itself`,
    ],
    Leadership: [
      `Set priorities, assign owners, and align stakeholders on measurable outcomes`,
      `Run a quick alignment meeting and co-create a realistic execution plan`,
      `Let each team member decide independently without central coordination`,
      `Postpone the decision until leadership gives explicit instructions`,
    ],
    Risk: [
      `Pilot a controlled experiment with safeguards before wider rollout`,
      `Proceed with partial rollout while monitoring key risk indicators`,
      `Avoid the opportunity because uncertainty is uncomfortable`,
      `Take the highest-risk option immediately without mitigation`,
    ],
    Planning: [
      `Define milestones, dependencies, and fallback plans before execution`,
      `Outline the next two milestones and adjust as new data appears`,
      `Keep the plan informal and react to issues as they emerge`,
      `Skip planning and rely on last-minute effort near deadlines`,
    ],
    Independence: [
      `Own the task independently and provide proactive checkpoints to stakeholders`,
      `Clarify scope once, then execute with minimal supervision`,
      `Wait for detailed instructions before taking action`,
      `Escalate routine decisions instead of deciding yourself`,
    ],
  };

  const defaults = [
    `Lead the situation with clarity, measurable goals, and ownership around ${skill}`,
    `Collect context, align peers, and execute an incremental plan`,
    `Move forward with minimal structure and adjust only when necessary`,
    `Avoid ownership and wait for external direction before acting`,
  ];

  const base = optionsByIntent[intent] || optionsByIntent[trait] || defaults;

  if (difficulty === 'advanced') {
    return [
      `${base[0]} while balancing deadline pressure, team capacity, and quality risk`,
      `${base[1]} while documenting trade-offs across budget, timeline, and stakeholder trust`,
      `${base[2]} even when dependencies across teams are unclear`,
      `${base[3]} despite visible cross-team impact`,
    ];
  }

  return base;
};

const buildScenarioSeed = ({ slot, domain = 'professional' }) => {
  const intent = String(slot.intent || '').toLowerCase();

  if (intent.includes('lead')) {
    return `You are leading a struggling ${domain} team that is missing milestones and morale is dropping`;
  }

  if (intent.includes('conflict') || intent.includes('collaboration') || intent.includes('team')) {
    return `Two teams in your ${domain} project disagree on priorities, and delivery is now at risk`;
  }

  if (intent.includes('risk') || intent.includes('ethic') || intent.includes('decision')) {
    return `A high-impact decision must be made today with incomplete data and visible stakeholder pressure`;
  }

  if (intent.includes('creativity') || intent.includes('innovation')) {
    return `A core product approach failed, and you must propose a new direction under tight constraints`;
  }

  if (intent.includes('deadline') || intent.includes('resilience')) {
    return `A critical deadline moved earlier after a production issue and resources are limited`;
  }

  if (intent.includes('analytical') || intent.includes('planning') || intent.includes('execution')) {
    return `A complex ${domain} initiative has conflicting signals across timeline, quality, and budget`;
  }

  return `You are handling a realistic ${domain} scenario with conflicting goals and limited time`;
};

const fallbackQuestionForSlot = ({ slot, profileVector = {} }) => {
  const domain = String(profileVector.domainCategory || 'professional').replace(/_/g, ' ');
  const scenarioSeed = buildScenarioSeed({ slot, domain });

  if (slot.answerFormat === 'rating') {
    const statements = {
      learning_orientation: `In your recent ${domain} work, you actively seek feedback and apply it within the next project sprint.`,
      team_preference: `During cross-functional delivery, you align frequently with teammates before finalizing decisions.`,
    };

    return {
      text:
        statements[slot.trait] ||
        `In your ${domain} work, you consistently demonstrate ${slot.trait.replace(/_/g, ' ')} behavior.`,
      type: 'likert',
      category: slot.category,
      trait: slot.trait,
      options: [],
      scaleMin: 1,
      scaleMax: 5,
      expectedAnswer: 4,
    };
  }

  if (slot.answerFormat === 'slider') {
    const prompts = {
      decision_quality: `In a live ${domain} delivery cycle with competing priorities, rate how consistently you make high-quality decisions.`,
      creativity: `In realistic ${domain} projects, rate how often you generate workable alternatives under constraints.`,
    };

    return {
      text:
        prompts[slot.trait] ||
        `In a realistic ${domain} situation, rate your ${slot.trait.replace(/_/g, ' ')} consistency.`,
      type: 'scale',
      category: slot.category,
      trait: slot.trait,
      options: [],
      scaleMin: 1,
      scaleMax: 10,
      expectedAnswer: 7,
    };
  }

  if (slot.answerFormat === 'text_short' || slot.answerFormat === 'text_long') {
    const expectedLength = slot.answerFormat === 'text_long' ? 180 : 90;
    const advancedTail = slot.answerFormat === 'text_long'
      ? 'Include context, your decision, and the measurable outcome.'
      : 'Describe context and your first decision in 2-4 concise sentences.';

    return {
      text: `${scenarioSeed}. What decision do you make first, and why? ${advancedTail}`,
      type: 'text',
      category: slot.category,
      trait: slot.trait,
      options: [],
      scaleMin: null,
      scaleMax: null,
      expectedAnswer: '',
      expectedLength,
    };
  }

  const options = fallbackMcqOptionsByIntent({
    intent: slot.intent,
    trait: slot.trait,
    difficulty: slot.difficulty,
    profileVector,
  });

  const decisionTail =
    slot.answerFormat === 'scenario_decision'
      ? 'Choose your first action in this career-critical scenario while balancing quality, risk, and timeline.'
      : 'Choose the action you would take first.';

  return {
    text: `${scenarioSeed}. What would you do first? ${decisionTail}`,
    type: slot.answerFormat === 'scenario_decision' ? 'scenario' : 'mcq',
    category: slot.category,
    trait: slot.trait,
    options,
    scaleMin: null,
    scaleMax: null,
    expectedAnswer: 'A',
  };
};

const toStringList = (value = [], limit = 16) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, limit);

const generateOneQuestionWithAi = async ({ slot, cvData = {}, profileVector = {}, previousThemes = [] }) => {
  if (!config.openaiApiKey) {
    return null;
  }

  const education = toStringList(cvData.education, 4).join('; ') || 'n/a';
  const subjects = toStringList(cvData.subjects, 6).join('; ') || 'n/a';
  const skills = toStringList((cvData.skills || []).map((skill) => skill?.name), 8).join('; ') || 'n/a';
  const interests = toStringList(cvData.interests, 8).join('; ') || 'n/a';
  const careerHints = toStringList(cvData.careerSignals, 8).join('; ') || 'n/a';
  const experience = toStringList(cvData.experience, 8).join('; ') || 'n/a';
  const roleHint = normalizeText(cvData.userRole || profileVector.experienceLevel || profileVector.domainRole || 'professional');
  const contextMix =
    slot.contextBucket === 'cv_specific'
      ? '30% CV specific context'
      : slot.contextBucket === 'personality_general'
      ? '40% personality-general context'
      : '30% cognitive scenario context';

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    temperature: 0.25,
    max_output_tokens: 420,
    input: [
      {
        role: 'system',
        content:
          'You generate psychometrically useful adaptive career-assessment questions. Questions must be simple but deep, scenario-based, and career-neutral. Return strict JSON only.',
      },
      {
        role: 'user',
        content: `Generate one adaptive assessment question.\n\nReturn JSON:\n{\n  "text": "",\n  "type": "likert|mcq|scale|text|scenario",\n  "trait": "",\n  "category": "",\n  "stage": "personality|cognitive|behavior|career",\n  "theme": "academic|workplace|social|leadership|creative|technical|personal|decision|stress",\n  "answerFormat": "rating|choice|slider|text_short|text_long|scenario_decision",\n  "scoringType": "numeric|weighted|ai_analysis|behavior_signal|cognitive_signal",\n  "uiHint": "",\n  "expectedLength": 0,\n  "options": [],\n  "scaleMin": 1,\n  "scaleMax": 10,\n  "expectedAnswer": ""\n}\n\nCandidate profile:\n- Role: ${roleHint}\n- Domain: ${profileVector.domainCategory || 'unknown'}\n- Education: ${education}\n- Experience: ${experience}\n- Subjects: ${subjects}\n- Skills: ${skills}\n- Interests: ${interests}\n- Career hints: ${careerHints}\n\nQuestion design constraints:\n- Intent: ${slot.intent}\n- Stage target: ${slot.stage}\n- Theme target: ${slot.theme}\n- Category target: ${slot.category}\n- Trait target: ${slot.trait}\n- Answer format target: ${slot.answerFormat}\n- Scoring type target: ${slot.scoringType}\n- Difficulty: ${slot.difficulty}\n- Context bucket target: ${contextMix}\n- Avoid repeated themes: ${(previousThemes || []).join(', ') || 'none'}\n- Do NOT optimize for one specific career path\n- Keep balance across personality, leadership, decision-making, creativity, risk, teamwork, and values\n- Must be realistic, contextual, and decision-focused\n- Use scenario-based depth (e.g., failing project, limited resources, stakeholder conflict)\n- Remove generic phrasing and avoid yes/no templates\n- Advanced questions must include multi-factor trade-offs\n- rating => likert, no options\n- choice => mcq, exactly 4 options\n- slider => scale with min and max\n- text_* => text, no options\n- scenario_decision => scenario with exactly 4 options`,
      },
    ],
  });

  const parsed = parseJsonFromText(
    extractOutputText(response),
    'Question generation output is invalid'
  );

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return parsed;
};

const normalizeQuestionType = (value, fallback = 'mcq') => {
  const normalized = String(value || '').toLowerCase();
  return QUESTION_TYPES.includes(normalized) ? normalized : fallback;
};

const normalizeQuestionText = ({ text = '', type = 'mcq', difficulty = 'medium' }) => {
  const cleaned = normalizeText(text);

  if (!cleaned) {
    return '';
  }

  if (type === 'likert') {
    return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
  }

  let normalized = cleaned.endsWith('?') ? cleaned : `${cleaned}?`;
  const hasScenarioCue = /\b(you are|your team|project|deadline|stakeholder|scenario|situation|decision)\b/i.test(
    normalized
  );

  if (!hasScenarioCue) {
    normalized = `You are in a real project scenario. ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
  }

  if (difficulty === 'advanced') {
    const hasMultifactorCue = /\b(trade[- ]?off|constraint|deadline|stakeholder|budget|quality|risk|dependency)\b/i.test(normalized);
    if (!hasMultifactorCue) {
      normalized = `${normalized.replace(/\?$/, '')} while balancing time, quality, and stakeholder impact?`;
    }
  }

  return normalized;
};

const normalizeMcqOptions = ({ options = [], fallbackOptions = [] }) => {
  const normalized = (Array.isArray(options) ? options : [])
    .map((option, index) => {
      if (typeof option === 'string') {
        return {
          id: MCQ_OPTION_IDS[index] || `OPT_${index + 1}`,
          label: normalizeText(option),
          weight: DEFAULT_MCQ_WEIGHTS[index] || 2,
        };
      }

      if (!option || typeof option !== 'object') {
        return null;
      }

      const label = normalizeText(option.label || option.text || option.option || '');
      if (!label) {
        return null;
      }

      const idCandidate = normalizeText(option.id || option.key || MCQ_OPTION_IDS[index] || `OPT_${index + 1}`);
      const id = idCandidate || MCQ_OPTION_IDS[index] || `OPT_${index + 1}`;

      const rawWeight = Number(option.weight ?? option.score ?? DEFAULT_MCQ_WEIGHTS[index] ?? 2);

      return {
        id,
        label,
        weight: clamp(Math.round(rawWeight), 1, 5),
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (normalized.length === 4) {
    return normalized.map((option, index) => ({
      ...option,
      id: MCQ_OPTION_IDS[index],
      weight: clamp(Number(option.weight || DEFAULT_MCQ_WEIGHTS[index] || 2), 1, 5),
    }));
  }

  const fallback = (Array.isArray(fallbackOptions) ? fallbackOptions : []).slice(0, 4);

  while (fallback.length < 4) {
    fallback.push(`Option ${fallback.length + 1}`);
  }

  return fallback.map((label, index) => ({
    id: MCQ_OPTION_IDS[index],
    label: normalizeText(label),
    weight: DEFAULT_MCQ_WEIGHTS[index] || 2,
  }));
};

const normalizeGeneratedQuestion = ({ generated = {}, slot, profileVector, index }) => {
  const fallback = fallbackQuestionForSlot({ slot, profileVector });

  const answerFormat = normalizeAnswerFormat(
    generated.answerFormat || generated.answer_format || slot.answerFormat,
    slot.answerFormat
  );
  const stage = normalizeStage(generated.stage || slot.stage, slot.stage);
  const theme = normalizeTheme(generated.theme || slot.theme, slot.theme);
  const scoringType = normalizeScoringType(
    generated.scoringType || generated.scoring_type || slot.scoringType,
    slot.scoringType
  );
  const uiHint = normalizeText(generated.uiHint || generated.ui_hint || slot.uiHint || '');
  const expectedLength = normalizeExpectedLength(
    generated.expectedLength ?? generated.expected_length ?? slot.expectedLength,
    slot.expectedLength
  );

  const type = normalizeQuestionType(
    generated.type || fallback.type || answerFormatToType(answerFormat),
    answerFormatToType(answerFormat)
  );

  const text = normalizeQuestionText({
    text: generated.text || generated.question || generated.prompt || fallback.text,
    type,
    difficulty: slot.difficulty,
  });

  const fallbackOptions = fallbackMcqOptionsByIntent({
    intent: slot.intent,
    trait: slot.trait,
    difficulty: slot.difficulty,
    profileVector,
  });

  const options =
    type === 'mcq' || type === 'scenario'
      ? normalizeMcqOptions({
          options: generated.options || fallback.options || [],
          fallbackOptions,
        })
      : [];

  const scaleMin =
    type === 'scale' ? clamp(round(generated.scaleMin || generated.min || fallback.scaleMin || 1), 1, 10) : null;

  const scaleMax =
    type === 'scale'
      ? clamp(
          round(generated.scaleMax || generated.max || fallback.scaleMax || 10),
          Math.max(scaleMin || 1, 2),
          10
        )
      : null;

  const trait = normalizeText(generated.trait || fallback.trait || slot.trait) || slot.trait;
  const category = normalizeText(generated.category || fallback.category || slot.category) || slot.category;

  const expectedAnswer =
    type === 'mcq'
      ? String(generated.expectedAnswer || generated.expected_option || 'A').trim() || 'A'
      : type === 'scale'
      ? clamp(Number(generated.expectedAnswer || fallback.expectedAnswer || 7), scaleMin || 1, scaleMax || 10)
      : type === 'likert'
      ? clamp(Number(generated.expectedAnswer || fallback.expectedAnswer || 4), 1, 5)
      : normalizeText(generated.expectedAnswer || '');

  const idSeed = `${text}-${slot.intent}-${slot.difficulty}-${index + 1}`;
  const id = `${toSlug(slot.intent)}-${slot.difficulty}-${crypto
    .createHash('md5')
    .update(idSeed)
    .digest('hex')
    .slice(0, 8)}`;

  return {
    id,
    questionId: id,
    text,
    type,
    category,
    trait,
    traitFocus: toOceanTrait(trait),
    traitTarget: trait,
    difficulty: slot.difficulty,
    activeDifficulty: slot.difficulty,
    options,
    scaleMin,
    scaleMax,
    expectedAnswer,
    intent: slot.intent,
    source: generated && Object.keys(generated).length ? 'planner_ai' : 'planner_fallback',
    answerFormat,
    scoringType,
    theme,
    stage,
    uiHint,
    expectedLength,
    contextBucket: slot.contextBucket || 'personality_general',
    plannerCategory: slot.category,
    memorySignature: toQuestionSignature(text),
    domainTags: [String(profileVector.domainCategory || '')].filter(Boolean),
    skillTags: (profileVector.skillHighlights || []).slice(0, 8).map((value) => String(value || '').toLowerCase()),
  };
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

const forceNonDuplicateText = ({ question, slot, index, profileVector }) => {
  const domain = String(profileVector.domainCategory || 'professional').replace(/_/g, ' ');
  const suffix = `${slot.intent} focus ${index + 1}`;

  if (question.type === 'likert') {
    question.text = `${question.text.replace(/\.*$/, '')} (${suffix}, ${domain}).`;
  } else {
    question.text = `${question.text.replace(/\?*$/, '')} (${suffix}, ${domain})?`;
  }

  question.memorySignature = toQuestionSignature(question.text);
  return question;
};

const enforceSlotCoherence = ({ question, slot, profileVector }) => {
  const answerFormat = normalizeAnswerFormat(slot.answerFormat, 'choice');
  const type = answerFormatToType(answerFormat);
  const stage = normalizeStage(slot.stage, 'personality');
  const scoringType = normalizeScoringType(slot.scoringType, 'numeric');
  const theme = normalizeTheme(question.theme, slot.theme);
  const uiHint = normalizeText(question.uiHint || slot.uiHint || '');
  const expectedLength = normalizeExpectedLength(
    question.expectedLength || slot.expectedLength || (answerFormat === 'text_long' ? 180 : answerFormat === 'text_short' ? 90 : 0),
    0
  );

  const fallbackOptions = fallbackMcqOptionsByIntent({
    intent: slot.intent,
    trait: slot.trait,
    difficulty: slot.difficulty,
    profileVector,
  });

  const normalizedOptions =
    type === 'mcq' || type === 'scenario'
      ? normalizeMcqOptions({
          options: question.options || [],
          fallbackOptions,
        })
      : [];

  return {
    ...question,
    type,
    answerFormat,
    stage,
    scoringType,
    theme,
    uiHint,
    expectedLength,
    options: normalizedOptions,
    scaleMin: type === 'scale' ? clamp(round(question.scaleMin || 1), 1, 10) : null,
    scaleMax:
      type === 'scale'
        ? clamp(round(question.scaleMax || 10), Math.max(clamp(round(question.scaleMin || 1), 1, 10), 2), 10)
        : null,
    plannerCategory: slot.category,
    difficulty: slot.difficulty,
    activeDifficulty: slot.difficulty,
    stageLabel: `${stage.toUpperCase()} ANALYSIS`,
  };
};

const buildQuestionPlanWithPipeline = async ({
  profileVector,
  cvData,
  askedQuestions = [],
  targetCount = BASE_QUESTION_COUNT,
  baseIndex = 0,
  totalCount = targetCount,
}) => {
  const slots = buildIntentSlots({
    targetCount,
    baseIndex,
    totalCount,
  });
  const references = buildReferenceEntries(askedQuestions);
  const generated = [];
  const generationStartedAt = Date.now();
  let aiGeneratedCount = 0;

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const previousThemes = generated.slice(-6).map((item) => item.intent || item.theme || item.category);
    let finalQuestion = null;
    const withinBudget = Date.now() - generationStartedAt < AI_GENERATION_BUDGET_MS;
    const allowAiForSlot = Boolean(config.openaiApiKey) && withinBudget && aiGeneratedCount < MAX_AI_QUESTION_COUNT;

    for (let attempt = 0; attempt < MAX_AI_ATTEMPTS_PER_SLOT; attempt += 1) {
      const aiCandidate = allowAiForSlot
        ? await withTimeout(
            generateOneQuestionWithAi({
              slot,
              cvData,
              profileVector,
              previousThemes,
            }).catch(() => null),
            AI_REQUEST_TIMEOUT_MS
          )
        : null;

      const normalized = normalizeGeneratedQuestion({
        generated: aiCandidate || {},
        slot,
        profileVector,
        index: baseIndex + index,
      });

      const localReferences = [
        ...references,
        ...generated.map((item) => ({ signature: item.memorySignature, text: item.text })),
      ];

      const duplicate = hasDuplicateSimilarity({
        text: normalized.text,
        references: localReferences,
        threshold: 0.82,
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
        generated: {},
        slot,
        profileVector,
        index: baseIndex + index,
      });

      forceNonDuplicateText({
        question: finalQuestion,
        slot,
        index,
        profileVector,
      });
    }

    generated.push(finalQuestion);
    references.push({
      signature: finalQuestion.memorySignature,
      text: finalQuestion.text,
    });
  }

  return generated.slice(0, targetCount).map((question, index) => {
    const slot = slots[index] || slots[slots.length - 1];
    const coherent = enforceSlotCoherence({
      question,
      slot,
      profileVector,
    });

    return {
      ...coherent,
      order: baseIndex + index,
    };
  });
};

const summarizeForIntro = ({ profileVector, questionPlan }) => {
  const intentCounts = questionPlan.reduce((accumulator, item) => {
    const key = item.intent || 'General';
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const stageCounts = questionPlan.reduce((accumulator, item) => {
    const key = normalizeStage(item.stage, 'personality');
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const formatCounts = questionPlan.reduce((accumulator, item) => {
    const key = normalizeAnswerFormat(item.answerFormat, 'choice');
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const contextBuckets = questionPlan.reduce((accumulator, item) => {
    const key = String(item.contextBucket || 'personality_general');
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const difficultyCurve = questionPlan.reduce(
    (accumulator, item) => {
      const level = String(item.difficulty || 'medium');
      accumulator[level] = Number(accumulator[level] || 0) + 1;
      return accumulator;
    },
    { easy: 0, medium: 0, advanced: 0 }
  );

  return {
    greeting: `Your interview is tailored for ${profileVector.domainRole} context and ${profileVector.experience} experience level.`,
    focus:
      'You will get staged adaptive questions (Personality -> Cognitive -> Behavior -> Career) with coherent UI formats and increasing difficulty.',
    distribution: {
      total: questionPlan.length,
      intents: intentCounts,
      stages: stageCounts,
      answerFormats: formatCounts,
      contextBuckets,
      difficultyCurve,
    },
  };
};

const generateQuestionPlan = async ({ cvData = {}, askedQuestions = [], targetCount } = {}) => {
  const profileVector = buildUserProfileVector(cvData);
  const resolvedTargetCount = clamp(
    Number(targetCount || determineInitialQuestionCount({ cvData, profileVector })),
    MIN_QUESTION_COUNT,
    LOW_CONFIDENCE_QUESTION_COUNT
  );

  const questionPlan = await buildQuestionPlanWithPipeline({
    profileVector,
    cvData,
    askedQuestions,
    targetCount: resolvedTargetCount,
    baseIndex: 0,
    totalCount: resolvedTargetCount,
  });

  const questionPoolBackup = questionPlan.slice(0, 120).map((question) => ({
    id: question.id,
    questionId: question.questionId,
    text: question.text,
    type: question.type,
    category: question.category,
    trait: question.trait,
    difficulty: question.difficulty,
    answerFormat: question.answerFormat,
    scoringType: question.scoringType,
    stage: question.stage,
    theme: question.theme,
    contextBucket: question.contextBucket,
    uiHint: question.uiHint,
    expectedLength: question.expectedLength,
    options: question.options,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
    expectedAnswer: question.expectedAnswer,
    intent: question.intent,
    signature: question.memorySignature,
  }));

  return {
    profileVector,
    questionPlan,
    questionPoolBackup,
    usedIntents: questionPlan.map((question) => question.intent),
    askedQuestionMemory: questionPlan.map((question) => ({
      signature: question.memorySignature,
      text: question.text,
      category: question.category,
      intent: question.intent,
      stage: question.stage,
      theme: question.theme,
      createdAt: new Date().toISOString(),
    })),
    smartIntro: summarizeForIntro({ profileVector, questionPlan }),
    targetQuestionCount: resolvedTargetCount,
    cvComplexity: Number(computeCvComplexity(cvData).toFixed(4)),
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

const computeCreativitySignal = ({ answers = [], questionPlan = [] }) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    return 0.5;
  }

  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));
  const creativityAnswers = answers.filter((answer) => {
    const question = byQuestionId.get(answer.questionId);
    if (!question) {
      return false;
    }

    return (
      String(question.intent || '').toLowerCase() === 'creativity' ||
      String(question.trait || '').toLowerCase().includes('creativity') ||
      String(question.category || '').toLowerCase().includes('creativity')
    );
  });

  if (!creativityAnswers.length) {
    return 0.5;
  }

  const avg =
    creativityAnswers.reduce((sum, answer) => {
      const question = byQuestionId.get(answer.questionId);
      return sum + extractAnswerScore({ answer, question });
    }, 0) / creativityAnswers.length;

  return clamp(Number(avg.toFixed(4)), 0, 1);
};

const computeAdaptiveConfidence = ({ answers = [], questionPlan = [] }) => {
  const normalizedAnswers = Array.isArray(answers) ? answers : [];
  const totalQuestions = Math.max(
    1,
    Array.isArray(questionPlan) && questionPlan.length ? questionPlan.length : BASE_QUESTION_COUNT
  );
  const answeredCount = normalizedAnswers.length;

  if (!answeredCount) {
    return 0;
  }

  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const scores = normalizedAnswers.map((answer) => {
    const question = byQuestionId.get(answer.questionId);
    return extractAnswerScore({ answer, question });
  });

  const coverage = clamp(answeredCount / totalQuestions, 0, 1);
  const avg = scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1);

  const variance =
    scores.reduce((sum, score) => sum + (score - avg) ** 2, 0) / Math.max(scores.length, 1);

  const consistency = clamp(1 - variance / 0.25, 0, 1);
  const decisiveness =
    scores.reduce((sum, score) => sum + Math.abs(score - 0.5), 0) / Math.max(scores.length, 1) * 2;
  const signalStrength = clamp(Math.abs(avg - 0.5) * 2, 0, 1);
  const confidence = clamp(
    coverage * 0.3 + consistency * 0.25 + decisiveness * 0.25 + signalStrength * 0.2,
    0,
    1
  );

  return Number(confidence.toFixed(4));
};

const reapplyDifficultyCurve = (plan = []) =>
  plan.map((question, index, list) => {
    const curve = buildDifficultyCurve(Math.max(list.length, BASE_QUESTION_COUNT));
    const difficulty = curve[index] || 'advanced';
    return {
      ...question,
      difficulty,
      activeDifficulty: difficulty,
      order: index,
    };
  });

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
  const shortResponseCount = timeValues.filter((value) => value > 0 && value < 3200).length;

  const neutralRate = clamp(neutralCount / telemetry.length, 0, 1);
  const skipRate = clamp(skippedCount / Math.max(totalQuestions, 1), 0, 1);
  const shortResponseRate = clamp(shortResponseCount / Math.max(timeValues.length, 1), 0, 1);

  const isFatigued =
    telemetry.length >= 3 &&
    ((averageAnswerTimeMs > 0 && averageAnswerTimeMs < 3200) || neutralRate >= 0.45 || skipRate >= 0.2);

  return {
    averageAnswerTimeMs,
    neutralRate: Number(neutralRate.toFixed(4)),
    skipRate: Number(skipRate.toFixed(4)),
    shortResponseRate: Number(shortResponseRate.toFixed(4)),
    isFatigued,
    fatigueMode: isFatigued ? 'short_form' : null,
  };
};

const toFatigueFriendlyQuestion = ({ question, index }) => {
  const originalType = String(question.type || '').toLowerCase();

  if (['likert', 'mcq', 'scale'].includes(originalType)) {
    return {
      ...question,
      uiHint: 'Quick mode: select your most natural response.',
    };
  }

  const preferSlider = index % 2 === 0;

  if (preferSlider) {
    return {
      ...question,
      type: 'scale',
      answerFormat: 'slider',
      scoringType: 'numeric',
      options: [],
      scaleMin: 1,
      scaleMax: 10,
      expectedLength: 0,
      text: `${question.text.replace(/\?*$/, '')}? (Quick mode)`,
      uiHint: 'Quick mode: respond using the slider.',
    };
  }

  const options = normalizeMcqOptions({
    options: question.options || [],
    fallbackOptions: [
      'Act immediately with a structured low-risk plan',
      'Gather context and align stakeholders before committing',
      'Take a minimal step and monitor results closely',
      'Delay and wait for direction from others',
    ],
  });

  return {
    ...question,
    type: 'mcq',
    answerFormat: 'choice',
    scoringType: 'weighted',
    options,
    scaleMin: null,
    scaleMax: null,
    expectedLength: 0,
    text: `${question.text.replace(/\?*$/, '')}? (Quick mode)`,
    uiHint: 'Quick mode: choose the closest option.',
  };
};

const toQuestionIdentity = (question = {}) =>
  String(question?.questionId || question?.id || '').trim();

const adaptUpcomingQuestions = ({ session, answeredQuestionId = '', fatigueState = {} }) => {
  const plan = Array.isArray(session.questionPlan) ? session.questionPlan : [];

  if (!plan.length) {
    return plan;
  }

  const submittedIdentity = String(answeredQuestionId || '').trim();
  const answeredIndex = plan.findIndex((question) => toQuestionIdentity(question) === submittedIdentity);
  const safeAnsweredIndex = answeredIndex >= 0 ? answeredIndex : Number(session.currentQuestionIndex || 0);
  const nextIndex = clamp(safeAnsweredIndex + 1, 0, plan.length);

  if (nextIndex >= plan.length) {
    return plan;
  }

  if (!fatigueState?.isFatigued) {
    return plan;
  }

  const prefix = plan.slice(0, nextIndex);
  const remaining = plan.slice(nextIndex).map((question, index) =>
    toFatigueFriendlyQuestion({ question, index })
  );

  const adapted = reapplyDifficultyCurve([...prefix, ...remaining]).map((question, index) => ({
    ...question,
    order: index,
  }));

  return adapted;
};

const toAverageIntentScore = ({ answers = [], questionPlan = [], intents = [] }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));
  const targetIntents = new Set((Array.isArray(intents) ? intents : []).map((item) => String(item || '').toLowerCase()));

  const matched = (Array.isArray(answers) ? answers : []).filter((answer) => {
    const question = byQuestionId.get(answer.questionId);
    const intent = String(question?.intent || answer?.metadata?.intent || '').toLowerCase();
    return targetIntents.has(intent);
  });

  if (!matched.length) {
    return 0.5;
  }

  const avg = matched.reduce((sum, answer) => {
    const question = byQuestionId.get(answer.questionId);
    return sum + extractAnswerScore({ answer, question });
  }, 0) / matched.length;

  return clamp(avg, 0, 1);
};

const detectAnswerInconsistency = ({ answers = [], questionPlan = [] }) => {
  const teamwork = toAverageIntentScore({
    answers,
    questionPlan,
    intents: ['teamwork', 'collaboration', 'conflict'],
  });
  const independence = toAverageIntentScore({
    answers,
    questionPlan,
    intents: ['independence', 'adaptability', 'planning'],
  });
  const risk = toAverageIntentScore({
    answers,
    questionPlan,
    intents: ['risk', 'innovation'],
  });
  const deadline = toAverageIntentScore({
    answers,
    questionPlan,
    intents: ['deadline', 'resilience'],
  });

  const contradictions = [];
  if (teamwork >= 0.75 && independence >= 0.75) {
    contradictions.push('Strong teamwork and strong solo-preference signals are both high.');
  }
  if (risk >= 0.72 && deadline <= 0.36) {
    contradictions.push('High risk appetite appears with low deadline pressure tolerance.');
  }

  const inconsistencyScore = clamp(
    contradictions.length * 0.4 + (Math.abs(teamwork - independence) < 0.05 ? 0.25 : 0),
    0,
    1
  );

  return {
    isInconsistent: contradictions.length > 0 || inconsistencyScore >= 0.65,
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
  const profileVector = buildUserProfileVector(cvData);
  const existing = Array.isArray(existingQuestionPlan) ? existingQuestionPlan : [];
  const safeAdditional = clamp(Number(additionalCount || 0), 0, MAX_QUESTION_COUNT - existing.length);

  if (!safeAdditional) {
    return [];
  }

  const mergedAsked = [
    ...(Array.isArray(askedQuestions) ? askedQuestions : []),
    ...existing.map((question) => ({
      signature: question.memorySignature || toQuestionSignature(question.text || ''),
      text: question.text || '',
    })),
  ];

  const additions = await buildQuestionPlanWithPipeline({
    profileVector,
    cvData,
    askedQuestions: mergedAsked,
    targetCount: safeAdditional,
    baseIndex: existing.length,
    totalCount: existing.length + safeAdditional,
  });

  return additions;
};

const evaluateAdaptiveExtensionNeed = ({ session, confidenceThreshold = LOW_CONFIDENCE_EXTENSION_THRESHOLD }) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const questionPlan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];
  const currentCount = questionPlan.length;

  if (!currentCount || answers.length < currentCount || currentCount >= MAX_QUESTION_COUNT) {
    return {
      extraQuestions: 0,
      reasons: [],
      confidence: computeAdaptiveConfidence({ answers, questionPlan }),
      inconsistency: { isInconsistent: false, inconsistencyScore: 0, contradictions: [] },
    };
  }

  const confidence = computeAdaptiveConfidence({ answers, questionPlan });
  const inconsistency = detectAnswerInconsistency({ answers, questionPlan });
  let extraQuestions = 0;
  const reasons = [];

  if (confidence < confidenceThreshold) {
    extraQuestions += QUESTION_EXTENSION_STEP;
    reasons.push('low_confidence');
  }

  if (inconsistency.isInconsistent) {
    extraQuestions += QUESTION_EXTENSION_STEP;
    reasons.push('inconsistent_answers');
  }

  extraQuestions = clamp(extraQuestions, 0, MAX_QUESTION_COUNT - currentCount);

  return {
    extraQuestions,
    reasons,
    confidence,
    inconsistency,
  };
};

const shouldStopAssessmentEarly = ({ session }) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const questionPlan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];

  const confidence = computeAdaptiveConfidence({
    answers,
    questionPlan,
  });

  const answeredCount = answers.length;
  const minimumAnswersBeforeStop = Math.max(MIN_QUESTION_COUNT, questionPlan.length || 0);
  const shouldStop = answeredCount >= minimumAnswersBeforeStop && confidence > 0.88;

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
