const crypto = require('crypto');
const { generateMcqOptions } = require('./mcq-option-engine.service');
const { QUESTION_INTENT_LIBRARY, OCEAN_TRAIT_FACETS } = require('./questionIntentLibrary');

const QUESTION_LENGTH_MIN = 13;
const QUESTION_LENGTH_MAX = 22;
const QUESTION_LENGTH_TARGET_MAX = 19;
const CANDIDATE_POOL_SIZE = 50;
const SIMILARITY_THRESHOLD = 0.78;

const CONTEXT_WEIGHTS = {
  personality_general: 0.7,
  cognitive_scenario: 0.2,
  cv_specific: 0.1,
};

const QUESTION_TYPE_WEIGHTS = {
  decision: 0.64,
  tradeoff: 0.18,
  reaction: 0.09,
  preference: 0.09,
};

const QUESTION_RESPONSE_TYPE_WEIGHTS = {
  likert: 0.4,
  mcq: 0.25,
  scale: 0.2,
  text: 0.15,
};

const DIFFICULTY_WEIGHTS = {
  easy: 0.26,
  medium: 0.32,
  advanced: 0.42,
};

const TRAIT_WEIGHTS = {
  O: 0.2,
  C: 0.24,
  E: 0.18,
  A: 0.18,
  N: 0.2,
};

const BANNED_WEAK_PATTERNS = [
  /how do you feel about/i,
  /^do you like\b/i,
  /^would you prefer\b/i,
  /\bdo you like\b/i,
];

const SIMPLE_LANGUAGE_REPLACEMENTS = [
  {
    pattern: /strategic stakeholder negotiation/gi,
    replacement: 'team disagreement',
  },
  {
    pattern: /long-term architecture tradeoff/gi,
    replacement: 'future vs quick solution',
  },
  {
    pattern: /multi(?:ple)? (?:complex )?considerations/gi,
    replacement: 'several factors',
  },
  {
    pattern: /cross-functional alignment/gi,
    replacement: 'team agreement',
  },
];

const FILLER_WORDS = new Set([
  'really',
  'very',
  'carefully',
  'currently',
  'typically',
  'basically',
  'significantly',
  'immediately',
  'essentially',
]);

const LENGTH_BOOSTERS = [
  'in this moment',
  'under current pressure',
  'for this decision',
];

const INTENT_LANGUAGE = {
  decision_style: {
    scenarios: [
      'Two urgent tasks collide near deadline',
      'Priorities shift during a busy sprint',
      'Requirements conflict right before delivery',
      'A late change disrupts your plan',
    ],
    choices: {
      decision: [
        ['decide priorities now', 'analyze options first'],
        ['commit one path now', 'collect input first'],
        ['pick the fastest route now', 'review tradeoffs first'],
      ],
      tradeoff: [
        ['protect speed', 'protect quality'],
        ['optimize fast delivery', 'optimize long-term reliability'],
      ],
      reaction: [
        ['respond with a clear decision', 'pause and map options first'],
        ['set direction quickly', 'ask for quick input first'],
      ],
      preference: [
        ['start by deciding quickly', 'start by structuring options'],
        ['work from a strict plan first', 'work from flexible priorities first'],
      ],
    },
  },
  risk_preference: {
    scenarios: [
      'An uncertain opportunity appears with possible upside',
      'A bold option could help but may fail',
      'Results are unclear and stakes are visible',
      'A new path promises gain with limited certainty',
    ],
    choices: {
      decision: [
        ['take a controlled risk now', 'wait for stronger certainty'],
        ['run a small pilot now', 'avoid risk and hold position'],
      ],
      tradeoff: [
        ['pursue upside', 'protect stability'],
        ['accept measured risk', 'minimize downside'],
      ],
      reaction: [
        ['test quickly with safeguards', 'pause until risk drops'],
        ['move with a small experiment', 'delay until outcomes are clearer'],
      ],
      preference: [
        ['choose uncertain opportunities', 'choose predictable outcomes'],
        ['favor bold moves', 'favor safe consistency'],
      ],
    },
  },
  team_preference: {
    scenarios: [
      'Team opinions split during planning',
      'Group discussion stalls before action',
      'People disagree on the next step',
      'Shared ownership becomes unclear today',
    ],
    choices: {
      decision: [
        ['discuss with the team first', 'work alone first then update'],
        ['seek group input now', 'decide independently now'],
      ],
      tradeoff: [
        ['protect team alignment', 'protect execution speed'],
        ['maximize collaboration', 'maximize autonomy'],
      ],
      reaction: [
        ['facilitate group discussion now', 'step back and act solo first'],
        ['bring everyone together quickly', 'move independently then inform'],
      ],
      preference: [
        ['start tasks with group planning', 'start tasks with solo planning'],
        ['work in frequent team syncs', 'work with minimal check-ins'],
      ],
    },
  },
  leadership_behavior: {
    scenarios: [
      'Meeting goes quiet when a decision is needed',
      'Project stalls because nobody takes lead',
      'Team loses direction under pressure',
      'Deadline nears and leadership is unclear',
    ],
    choices: {
      decision: [
        ['lead the discussion now', 'wait for direction first'],
        ['set clear roles immediately', 'observe first before stepping in'],
      ],
      tradeoff: [
        ['set firm direction', 'build full consensus'],
        ['prioritize decisive leadership', 'prioritize shared agreement'],
      ],
      reaction: [
        ['step forward and coordinate now', 'pause and let others initiate'],
        ['take ownership immediately', 'wait for formal assignment'],
      ],
      preference: [
        ['naturally lead first', 'support from the background first'],
        ['guide team decisions directly', 'influence indirectly through suggestions'],
      ],
    },
  },
  creativity_behavior: {
    scenarios: [
      'Current process works but progress slows',
      'Routine approach keeps repeating weak results',
      'A fresh idea appears during routine work',
      'Known method solves less each week',
    ],
    choices: {
      decision: [
        ['test a new idea now', 'keep the familiar approach'],
        ['experiment with a small prototype', 'follow the proven routine'],
      ],
      tradeoff: [
        ['prioritize novelty', 'prioritize consistency'],
        ['choose experimentation', 'choose stable execution'],
      ],
      reaction: [
        ['try a quick experiment first', 'stick to current method first'],
        ['prototype a fresh option now', 'optimize current process now'],
      ],
      preference: [
        ['start with creative exploration', 'start with known methods'],
        ['prefer unusual solutions', 'prefer familiar solutions'],
      ],
    },
  },
  stress_response: {
    scenarios: [
      'Critical issue appears close to deadline',
      'Pressure rises after a visible mistake',
      'Unexpected setback blocks planned work',
      'Multiple problems appear at once',
    ],
    choices: {
      decision: [
        ['pause and prioritize calmly', 'react fast without full structure'],
        ['stabilize first with clear steps', 'push ahead quickly despite stress'],
      ],
      tradeoff: [
        ['protect calm control', 'protect immediate pace'],
        ['prioritize emotional control', 'prioritize rapid response'],
      ],
      reaction: [
        ['slow down and reset priorities', 'speed up and improvise'],
        ['take a breath then act', 'act instantly then adjust later'],
      ],
      preference: [
        ['manage stress through structure', 'manage stress through fast action'],
        ['stay calm before acting', 'act first then calm down'],
      ],
    },
  },
  adaptability: {
    scenarios: [
      'New information breaks your original plan',
      'Client request changes midway through execution',
      'Priorities shift after work has started',
      'Constraints change after you commit',
    ],
    choices: {
      decision: [
        ['adapt the plan quickly', 'protect the original plan'],
        ['pivot now to new facts', 'wait and hold current direction'],
      ],
      tradeoff: [
        ['prioritize flexibility', 'prioritize consistency'],
        ['choose quick pivot', 'choose plan stability'],
      ],
      reaction: [
        ['replan immediately with the team', 'continue until change is confirmed'],
        ['adjust scope right away', 'hold scope until later review'],
      ],
      preference: [
        ['work with flexible plans', 'work with fixed plans'],
        ['embrace shifting priorities', 'prefer stable priorities'],
      ],
    },
  },
  analysis_style: {
    scenarios: [
      'Data points conflict before a choice',
      'Evidence is incomplete near decision time',
      'Signals disagree across sources',
      'Numbers look mixed before action',
    ],
    choices: {
      decision: [
        ['analyze patterns deeper', 'decide with current signals'],
        ['validate assumptions first', 'act on best estimate now'],
      ],
      tradeoff: [
        ['choose deeper analysis', 'choose faster action'],
        ['prioritize evidence depth', 'prioritize decision speed'],
      ],
      reaction: [
        ['map causes before acting', 'act first and inspect later'],
        ['check one more data source', 'move with present evidence'],
      ],
      preference: [
        ['start with structured analysis', 'start with practical action'],
        ['prefer evidence-heavy decisions', 'prefer quick judgment decisions'],
      ],
    },
  },
  confidence_behavior: {
    scenarios: [
      'Decision is required with limited certainty',
      'You must choose before full clarity',
      'Outcome matters and certainty is low',
      'Ambiguity remains after quick discussion',
    ],
    choices: {
      decision: [
        ['commit and own the choice', 'wait for reassurance first'],
        ['decide with confidence now', 'delay until confidence improves'],
      ],
      tradeoff: [
        ['favor confident action', 'favor extra reassurance'],
        ['choose assertive commitment', 'choose careful confirmation'],
      ],
      reaction: [
        ['state your decision clearly', 'ask others for confirmation first'],
        ['take ownership immediately', 'seek certainty before ownership'],
      ],
      preference: [
        ['prefer acting with uncertainty', 'prefer acting with full certainty'],
        ['trust your judgment quickly', 'verify your judgment repeatedly'],
      ],
    },
  },
  communication_style: {
    scenarios: [
      'Feedback turns negative during a meeting',
      'Your idea receives strong pushback',
      'Misunderstanding appears in team chat',
      'A teammate questions your plan publicly',
    ],
    choices: {
      decision: [
        ['ask clarifying questions first', 'defend your view first'],
        ['listen and summarize first', 'argue your position first'],
      ],
      tradeoff: [
        ['prioritize clear listening', 'prioritize direct persuasion'],
        ['choose empathy first', 'choose assertiveness first'],
      ],
      reaction: [
        ['clarify calmly before replying', 'reply quickly to correct others'],
        ['invite discussion immediately', 'close discussion and move on'],
      ],
      preference: [
        ['communicate through dialogue', 'communicate through direct directives'],
        ['prefer collaborative phrasing', 'prefer blunt concise phrasing'],
      ],
    },
  },
};

const FACET_SCENARIO_CUES = {
  creativity: 'with creative choices',
  curiosity: 'with open questions',
  novelty_tolerance: 'with new methods',
  abstract_thinking: 'with big-picture uncertainty',
  planning: 'with planning pressure',
  discipline: 'with discipline pressure',
  organization: 'with task order pressure',
  goal_focus: 'with goal conflict',
  social_energy: 'with low group energy',
  leadership: 'with missing leadership',
  assertiveness: 'with unclear authority',
  communication: 'with unclear communication',
  cooperation: 'with shared effort needs',
  empathy: 'with visible emotions',
  trust: 'with low trust',
  team_behavior: 'with slow coordination',
  stress_response: 'with high pressure',
  uncertainty_tolerance: 'with uncertain outcomes',
  emotional_control: 'with emotional tension',
  risk_perception: 'with visible risk',
};

const FACET_CHOICE_OVERRIDES = {
  empathy: {
    decision: ['acknowledge emotions first', 'focus only on task facts'],
    tradeoff: ['prioritize empathy', 'prioritize strict objectivity'],
    reaction: ['check how others feel first', 'push forward without emotional check-in'],
    preference: ['lead with empathy in conflict', 'lead with strict logic in conflict'],
  },
  assertiveness: {
    decision: ['state your position firmly', 'stay cautious and indirect'],
    tradeoff: ['prioritize directness', 'prioritize restraint'],
    reaction: ['speak up immediately', 'hold back and wait'],
    preference: ['communicate with firm clarity', 'communicate with softer caution'],
  },
  trust: {
    decision: ['share your reasoning openly', 'keep reasoning private for now'],
    tradeoff: ['build trust through openness', 'protect control through limited sharing'],
    reaction: ['explain decisions transparently', 'announce decisions without detail'],
    preference: ['default to transparent updates', 'default to minimal updates'],
  },
  cooperation: {
    decision: ['align tasks together first', 'assign tasks without group discussion'],
    tradeoff: ['prioritize cooperation', 'prioritize solo efficiency'],
    reaction: ['coordinate roles immediately', 'work independently and sync later'],
    preference: ['prefer shared ownership models', 'prefer independent ownership models'],
  },
  creativity: {
    decision: ['prototype an original option', 'reuse the standard option'],
    tradeoff: ['prioritize originality', 'prioritize reliability'],
    reaction: ['explore an unusual route', 'repeat a known route'],
    preference: ['prefer novel approaches first', 'prefer familiar approaches first'],
  },
};

const toCleanText = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeForSimilarity = (value = '') =>
  toCleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toWords = (value = '') =>
  toCleanText(value)
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

const wordCount = (value = '') => toWords(value).length;

const toSlug = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const hashToIndex = (seed = '', size = 1) => {
  if (!size) {
    return 0;
  }

  const digest = crypto.createHash('sha1').update(String(seed || '')).digest('hex').slice(0, 8);
  const value = Number.parseInt(digest, 16);
  return Number.isFinite(value) ? value % size : 0;
};

const toQuestionSignature = (text = '') =>
  crypto.createHash('sha1').update(normalizeForSimilarity(text)).digest('hex');

const countBy = (list = [], keyFn = (item) => item) =>
  (Array.isArray(list) ? list : []).reduce((accumulator, item) => {
    const key = keyFn(item);
    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

const cosineFromTokenVectors = (leftText = '', rightText = '') => {
  const toVector = (text = '') =>
    normalizeForSimilarity(text)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
      .reduce((accumulator, token) => {
        accumulator[token] = Number(accumulator[token] || 0) + 1;
        return accumulator;
      }, {});

  const left = toVector(leftText);
  const right = toVector(rightText);
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (!leftKeys.length || !rightKeys.length) {
    return 0;
  }

  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  leftKeys.forEach((key) => {
    const value = Number(left[key] || 0);
    leftMag += value * value;
    if (right[key]) {
      dot += value * Number(right[key]);
    }
  });

  rightKeys.forEach((key) => {
    const value = Number(right[key] || 0);
    rightMag += value * value;
  });

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const hasSemanticDuplicate = ({ text = '', references = [], threshold = SIMILARITY_THRESHOLD }) => {
  const normalized = normalizeForSimilarity(text);
  if (!normalized) {
    return true;
  }

  return (Array.isArray(references) ? references : []).some((entry) => {
    const sourceText = typeof entry === 'string' ? entry : entry?.text || '';
    const sourceNormalized = normalizeForSimilarity(sourceText);
    if (!sourceNormalized) {
      return false;
    }

    if (normalized === sourceNormalized) {
      return true;
    }

    const score = cosineFromTokenVectors(normalized, sourceNormalized);
    return score > threshold;
  });
};

const simplifyLanguage = (text = '') => {
  let next = toCleanText(text);

  SIMPLE_LANGUAGE_REPLACEMENTS.forEach((rule) => {
    next = next.replace(rule.pattern, rule.replacement);
  });

  return next;
};

const enforceWordRange = (text = '') => {
  let next = toCleanText(text).replace(/\?+$/, '');
  const structuredMatch = next.match(/^(.+?)\.\s*Do you (.+?) or (.+)$/i);
  const cleanScenarioTail = (value = '') => {
    const dangling = new Set(['with', 'and', 'while', 'under', 'before', 'after', 'for', 'to']);
    const words = toWords(value);
    while (words.length > 3 && dangling.has(String(words[words.length - 1] || '').toLowerCase())) {
      words.pop();
    }
    return words.join(' ');
  };

  if (structuredMatch) {
    let scenario = cleanScenarioTail(toCleanText(structuredMatch[1]));
    const leftChoice = toCleanText(structuredMatch[2]);
    const rightChoice = toCleanText(structuredMatch[3]);

    const toStructured = () => `${scenario}. Do you ${leftChoice} or ${rightChoice}`;
    let words = toWords(toStructured());

    if (words.length > QUESTION_LENGTH_TARGET_MAX) {
      let scenarioWords = toWords(scenario).filter((word) => !FILLER_WORDS.has(word.toLowerCase()));
      while (
        scenarioWords.length > 4 &&
        toWords(`${scenarioWords.join(' ')}. Do you ${leftChoice} or ${rightChoice}`).length > QUESTION_LENGTH_TARGET_MAX
      ) {
        scenarioWords.pop();
      }
      scenario = cleanScenarioTail(scenarioWords.join(' '));
      words = toWords(toStructured());
    }

    if (words.length > QUESTION_LENGTH_MAX) {
      let scenarioWords = toWords(scenario);
      while (
        scenarioWords.length > 2 &&
        toWords(`${scenarioWords.join(' ')}. Do you ${leftChoice} or ${rightChoice}`).length > QUESTION_LENGTH_MAX
      ) {
        scenarioWords.pop();
      }
      scenario = cleanScenarioTail(scenarioWords.join(' '));
      words = toWords(toStructured());
    }

    while (words.length < QUESTION_LENGTH_MIN) {
      const booster = LENGTH_BOOSTERS[words.length % LENGTH_BOOSTERS.length];
      scenario = cleanScenarioTail(`${scenario} ${booster}`);
      words = toWords(toStructured());
    }

    let structured = `${scenario}. Do you ${leftChoice} or ${rightChoice}`.replace(/\s+/g, ' ').trim();
    if (!structured.endsWith('?')) {
      structured = `${structured}?`;
    }

    return structured;
  }

  let words = toWords(next).filter((word) => !FILLER_WORDS.has(word.toLowerCase()));

  while (words.length < QUESTION_LENGTH_MIN) {
    const booster = LENGTH_BOOSTERS[words.length % LENGTH_BOOSTERS.length];
    words = words.concat(booster.split(' '));
  }

  if (words.length > QUESTION_LENGTH_TARGET_MAX) {
    words = words.slice(0, QUESTION_LENGTH_TARGET_MAX);
  }

  if (words.length > QUESTION_LENGTH_MAX) {
    words = words.slice(0, QUESTION_LENGTH_MAX);
  }

  next = words.join(' ').replace(/\s+/g, ' ').trim();
  return next.endsWith('?') ? next : `${next}?`;
};

const ensureScenarioDecision = (scenario = '', leftChoice = '', rightChoice = '') => {
  const normalizedScenario = toCleanText(scenario).replace(/[.?!]+$/g, '');
  const left = toCleanText(leftChoice).replace(/[.?!]+$/g, '');
  const right = toCleanText(rightChoice).replace(/[.?!]+$/g, '');

  let text = `${normalizedScenario}. Do you ${left} or ${right}?`;
  text = simplifyLanguage(text);
  text = text.replace(/\s+/g, ' ').trim();
  return enforceWordRange(text);
};

const validateQuestion = (text = '') => {
  const normalized = toCleanText(text);
  const words = wordCount(normalized);
  const hasStructure = /.+\.\s*Do you .+\bor\b.+\?/i.test(normalized);
  const bannedWeakPattern = BANNED_WEAK_PATTERNS.some((pattern) => pattern.test(normalized));
  const complexWords = toWords(normalized).filter((word) => word.length >= 13).length;
  const decisionCount = (normalized.match(/\bor\b/gi) || []).length;

  const penalties = [
    !hasStructure ? 0.5 : 0,
    bannedWeakPattern ? 0.4 : 0,
    words < QUESTION_LENGTH_MIN || words > QUESTION_LENGTH_MAX ? 0.35 : 0,
    complexWords > 0 ? complexWords * 0.06 : 0,
    decisionCount !== 1 ? 0.2 : 0,
  ];

  const score = Math.max(0, 1 - penalties.reduce((sum, value) => sum + value, 0));

  return {
    pass:
      score >= 0.62 &&
      hasStructure &&
      !bannedWeakPattern &&
      words >= QUESTION_LENGTH_MIN &&
      words <= QUESTION_LENGTH_MAX &&
      decisionCount === 1,
    score,
    words,
    hasStructure,
  };
};

const buildWeightedCounts = (total = 1, weights = {}) => {
  const entries = Object.entries(weights);
  const safeTotal = Math.max(1, Number(total || 1));
  const raw = entries.map(([key, value]) => [key, Number(value || 0)]);
  const sum = raw.reduce((accumulator, [, value]) => accumulator + value, 0) || 1;

  const base = raw.map(([key, value]) => {
    const exact = (value / sum) * safeTotal;
    return {
      key,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let assigned = base.reduce((accumulator, item) => accumulator + item.count, 0);
  let remaining = safeTotal - assigned;

  const byRemainder = [...base].sort((a, b) => b.remainder - a.remainder);
  let pointer = 0;

  while (remaining > 0 && byRemainder.length) {
    byRemainder[pointer % byRemainder.length].count += 1;
    pointer += 1;
    remaining -= 1;
  }

  return base.reduce((accumulator, item) => {
    accumulator[item.key] = item.count;
    return accumulator;
  }, {});
};

const buildWeightedQueue = (total = 1, weights = {}) => {
  const counts = buildWeightedCounts(total, weights);
  const queue = Object.entries(counts).flatMap(([key, count]) =>
    Array.from({ length: Number(count || 0) }).map(() => key)
  );

  const grouped = {};
  queue.forEach((item) => {
    grouped[item] = grouped[item] || [];
    grouped[item].push(item);
  });

  const keys = Object.keys(grouped);
  const reordered = [];

  while (reordered.length < queue.length) {
    keys.forEach((key) => {
      if (grouped[key]?.length) {
        reordered.push(grouped[key].shift());
      }
    });
  }

  return reordered;
};

const questionTypePlanner = (total = 22) => {
  const safeTotal = Math.max(1, Number(total || 22));
  const queue = buildWeightedQueue(safeTotal, QUESTION_RESPONSE_TYPE_WEIGHTS);

  if (queue.length >= safeTotal) {
    return queue.slice(0, safeTotal);
  }

  const fallback = ['likert', 'mcq', 'scale', 'text'];
  while (queue.length < safeTotal) {
    queue.push(fallback[queue.length % fallback.length]);
  }

  return queue;
};

const flattenFacetCatalog = () =>
  Object.entries(OCEAN_TRAIT_FACETS).flatMap(([trait, facets]) =>
    facets.map((facet) => ({
      trait,
      facet,
      facetKey: `${trait}:${facet}`,
    }))
  );

const inferDomainToken = ({ profileVector = {}, cvData = {} }) => {
  const profileDomain = String(profileVector?.domainCategory || '').toLowerCase();
  const cvDomain = String(cvData?.source_domain || '').toLowerCase();
  const combined = `${profileDomain} ${cvDomain}`.trim();

  if (/market|business|sales|brand/.test(combined)) return 'campaign';
  if (/engineer|software|backend|frontend|devops|cloud|data/.test(combined)) return 'system';
  if (/design|creative|ux|ui/.test(combined)) return 'prototype';
  if (/education|teaching|research/.test(combined)) return 'study plan';
  if (/health|medical|clinical/.test(combined)) return 'case';
  return 'project';
};

const extractCvHints = ({ cvData = {}, profileVector = {} }) => {
  const skills = (Array.isArray(cvData.skills) ? cvData.skills : [])
    .map((entry) => String(entry?.name || '').trim())
    .filter(Boolean)
    .slice(0, 8);
  const interests = (Array.isArray(cvData.interests) ? cvData.interests : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const tools = (Array.isArray(cvData.tools) ? cvData.tools : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const projects = (Array.isArray(cvData.projects) ? cvData.projects : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const education = (Array.isArray(cvData.education) ? cvData.education : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    domain: String(profileVector?.domainCategory || cvData?.source_domain || 'general'),
    skills,
    interests,
    tools,
    projects,
    education,
    domainToken: inferDomainToken({ profileVector, cvData }),
  };
};

const buildCvSpecificScenario = ({ domainToken = 'project', seed = 0 }) => {
  const templates = [
    `${domainToken} outcome drops unexpectedly midweek`,
    `${domainToken} issue appears right before delivery`,
    `${domainToken} plan struggles after a sudden change`,
    `${domainToken} progress slows under visible pressure`,
  ];

  return templates[seed % templates.length];
};

const pickFromList = (items = [], seed = '') => {
  if (!items.length) {
    return '';
  }

  return items[hashToIndex(seed, items.length)];
};

const toDifficultyCurveTargets = (total = 22) => {
  const safeTotal = Math.max(1, Number(total || 22));
  if (safeTotal === 22) {
    return {
      easy: 5,
      medium: 7,
      advanced: 10,
    };
  }

  return buildWeightedCounts(safeTotal, DIFFICULTY_WEIGHTS);
};

const toContextTargets = (total = 22) => {
  const safeTotal = Math.max(1, Number(total || 22));
  if (safeTotal === 22) {
    return {
      personality_general: 15,
      cognitive_scenario: 4,
      cv_specific: 3,
    };
  }

  return buildWeightedCounts(safeTotal, CONTEXT_WEIGHTS);
};

const resolveStageFromContext = ({ intent = {}, contextBucket = 'personality_general' }) => {
  if (contextBucket === 'cognitive_scenario') {
    return 'cognitive';
  }

  if (contextBucket === 'cv_specific') {
    return 'career';
  }

  return intent.stage || 'personality';
};

const buildQuestionCandidate = ({
  intent,
  facet,
  contextBucket,
  questionType,
  responseType = 'mcq',
  difficulty,
  cvHints,
  indexSeed,
  profileVector,
}) => {
  const language = INTENT_LANGUAGE[intent.key] || INTENT_LANGUAGE.decision_style;
  const scenarioSeed = `${intent.key}:${contextBucket}:${indexSeed}`;
  const choiceSeed = `${intent.key}:${questionType}:${indexSeed}`;

  let scenario = pickFromList(language.scenarios, scenarioSeed) || 'A work situation changes unexpectedly';
  if (contextBucket === 'cognitive_scenario') {
    const cognitiveSuffixes = [
      'with partial data available',
      'while evidence remains incomplete',
      'while facts are still uncertain',
    ];
    scenario = `${scenario} ${pickFromList(cognitiveSuffixes, `${scenarioSeed}:cognitive`)}`;
  } else if (contextBucket === 'cv_specific') {
    scenario = buildCvSpecificScenario({
      domainToken: cvHints.domainToken,
      seed: hashToIndex(`${scenarioSeed}:cv`, 1000),
    });
  }

  const facetCue = FACET_SCENARIO_CUES[facet.facet];
  if (facetCue && !scenario.toLowerCase().includes(String(facetCue).toLowerCase())) {
    scenario = `${scenario} ${facetCue}`;
  }

  if (difficulty === 'medium') {
    scenario = `${scenario} under time pressure`;
  }

  if (difficulty === 'advanced') {
    const advancedSuffixes = [
      'while team opinions remain split',
      'while outcomes affect important goals',
      'while pressure keeps rising',
    ];
    scenario = `${scenario} ${pickFromList(advancedSuffixes, `${scenarioSeed}:advanced`)}`;
  }

  const options = language.choices[questionType] || language.choices.decision;
  const override = FACET_CHOICE_OVERRIDES[facet.facet]?.[questionType];
  const selectedChoice = override || pickFromList(options, choiceSeed) || ['act now', 'wait for clarity'];
  const [leftChoice, rightChoice] = selectedChoice;

  const text = ensureScenarioDecision(scenario, leftChoice, rightChoice);
  const validation = validateQuestion(text);
  const signature = toQuestionSignature(text);

  const intentTag = [
    intent.key,
    toSlug(facet.facet || intent.primaryTrait || 'general'),
    questionType,
    toSlug(contextBucket),
    String(indexSeed + 1),
  ].join('__');

  const baseQuality = Number(
    (
      validation.score * 0.58 +
      (questionType === 'tradeoff' ? 0.16 : questionType === 'decision' ? 0.12 : 0.1) +
      (contextBucket === 'personality_general' ? 0.06 : 0.04) +
      (difficulty === 'advanced' ? 0.05 : difficulty === 'medium' ? 0.04 : 0.03)
    ).toFixed(4)
  );

  return {
    text,
    signature,
    pass: validation.pass,
    validation,
    baseQuality,
    baseIntent: intent.key,
    intentTag,
    category: intent.category || 'personality',
    traitFocus: intent.primaryTrait || facet.trait || 'O',
    traitTarget: facet.facet || intent.primaryTrait || 'behavior',
    traitFacetKey: facet.facetKey,
    theme: intent.theme || 'personal',
    stage: resolveStageFromContext({ intent, contextBucket }),
    contextBucket,
    questionType,
    responseType,
    difficulty,
    plannerCategory: intent.category || 'personality',
    domainTags: [String(profileVector?.domainCategory || '').toLowerCase()].filter(Boolean),
    skillTags: (profileVector?.skillHighlights || [])
      .slice(0, 8)
      .map((entry) => String(entry || '').toLowerCase()),
    cvHints,
  };
};

const buildCandidatePool = ({
  profileVector = {},
  cvData = {},
  targetCount = 22,
  baseIndex = 0,
  askedQuestions = [],
}) => {
  const desiredPoolSize = Math.max(CANDIDATE_POOL_SIZE, Number(targetCount || 22) * 2 + 6);
  const intents = QUESTION_INTENT_LIBRARY;
  const facets = flattenFacetCatalog();
  const cvHints = extractCvHints({ cvData, profileVector });

  const contextQueue = buildWeightedQueue(desiredPoolSize, CONTEXT_WEIGHTS);
  const typeQueue = buildWeightedQueue(desiredPoolSize, QUESTION_TYPE_WEIGHTS);
  const difficultyQueue = buildWeightedQueue(desiredPoolSize, DIFFICULTY_WEIGHTS);
  const references = (Array.isArray(askedQuestions) ? askedQuestions : [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return { text: entry };
      return { text: String(entry.text || entry.question || '') };
    })
    .filter(Boolean);

  const candidates = [];
  let attempts = 0;
  const maxAttempts = desiredPoolSize * 12;

  const ensureFacetCoverageInPool = () => {
    const requiredFacets = flattenFacetCatalog();

    requiredFacets.forEach((facet) => {
      if (candidates.length >= desiredPoolSize) {
        return;
      }

      const matchingIntent =
        intents.find((intent) => (intent.facets || []).includes(facet.facet)) ||
        intents.find((intent) => intent.primaryTrait === facet.trait) ||
        intents[0];

      const candidate = buildQuestionCandidate({
        intent: matchingIntent,
        facet,
        contextBucket: contextQueue[candidates.length % contextQueue.length] || 'personality_general',
        questionType: typeQueue[candidates.length % typeQueue.length] || 'decision',
        difficulty: difficultyQueue[candidates.length % difficultyQueue.length] || 'medium',
        cvHints,
        indexSeed: baseIndex + attempts,
        profileVector,
      });

      attempts += 1;

      if (!candidate.pass) {
        return;
      }

      if (
        hasSemanticDuplicate({
          text: candidate.text,
          references: [...references, ...candidates],
          threshold: SIMILARITY_THRESHOLD,
        })
      ) {
        return;
      }

      candidates.push(candidate);
    });
  };

  ensureFacetCoverageInPool();

  while (candidates.length < desiredPoolSize && attempts < maxAttempts) {
    const intent = intents[attempts % intents.length];
    const facetPool = (intent.facets || []).length
      ? (intent.facets || [])
          .map((facetName) => {
            const found = facets.find((item) => item.facet === facetName);
            if (found) {
              return found;
            }

            return {
              trait: intent.primaryTrait || 'O',
              facet: facetName,
              facetKey: `${intent.primaryTrait || 'O'}:${facetName}`,
            };
          })
      : facets.filter((item) => item.trait === intent.primaryTrait);

    const facet = facetPool[hashToIndex(`${intent.key}:${attempts}`, facetPool.length)] || {
      trait: intent.primaryTrait || 'O',
      facet: intent.primaryTrait || 'behavior',
      facetKey: `${intent.primaryTrait || 'O'}:${intent.primaryTrait || 'behavior'}`,
    };

    const candidate = buildQuestionCandidate({
      intent,
      facet,
      contextBucket: contextQueue[candidates.length % contextQueue.length] || 'personality_general',
      questionType: typeQueue[candidates.length % typeQueue.length] || 'decision',
      difficulty: difficultyQueue[candidates.length % difficultyQueue.length] || 'medium',
      cvHints,
      indexSeed: baseIndex + attempts,
      profileVector,
    });

    attempts += 1;

    if (!candidate.pass) {
      continue;
    }

    if (BANNED_WEAK_PATTERNS.some((pattern) => pattern.test(candidate.text))) {
      continue;
    }

    if (
      hasSemanticDuplicate({
        text: candidate.text,
        references: [...references, ...candidates],
        threshold: SIMILARITY_THRESHOLD,
      })
    ) {
      continue;
    }

    candidates.push(candidate);
  }

  return candidates.slice(0, desiredPoolSize);
};

const calculateDynamicSelectionScore = ({
  candidate,
  selected = [],
  targets,
  counts,
  coveredFacets,
  usedBaseIntents,
  traitTargets,
}) => {
  const type = candidate.questionType;
  const context = candidate.contextBucket;
  const difficulty = candidate.difficulty;
  const trait = candidate.traitFocus;

  let score = Number(candidate.baseQuality || 0);

  const typeDeficit = Number(targets.type[type] || 0) - Number(counts.type[type] || 0);
  const contextDeficit = Number(targets.context[context] || 0) - Number(counts.context[context] || 0);
  const difficultyDeficit =
    Number(targets.difficulty[difficulty] || 0) - Number(counts.difficulty[difficulty] || 0);
  const traitDeficit = Number(traitTargets[trait] || 0) - Number(counts.trait[trait] || 0);

  score += typeDeficit > 0 ? 0.35 : -0.16;
  score += contextDeficit > 0 ? 0.28 : -0.12;
  score += difficultyDeficit > 0 ? 0.22 : -0.1;
  score += traitDeficit > 0 ? 0.2 : -0.08;
  score += coveredFacets.has(candidate.traitFacetKey) ? -0.08 : 0.24;
  score += usedBaseIntents.has(candidate.baseIntent) ? -0.05 : 0.12;
  score += type === 'tradeoff' ? 0.08 : 0;
  score += selected.length >= 12 && difficulty === 'advanced' ? 0.08 : 0;

  return Number(score.toFixed(6));
};

const reorderByDifficultyCurve = ({ selected = [], targetCount = 22 }) => {
  const desiredCounts = toDifficultyCurveTargets(targetCount);
  const easy = selected.filter((item) => item.difficulty === 'easy');
  const medium = selected.filter((item) => item.difficulty === 'medium');
  const advanced = selected.filter((item) => item.difficulty === 'advanced');
  const overflow = selected.filter(
    (item) => item.difficulty !== 'easy' && item.difficulty !== 'medium' && item.difficulty !== 'advanced'
  );

  const pull = (bucket, fallbackBuckets = []) => {
    if (bucket.length) {
      return bucket.shift();
    }

    for (const next of fallbackBuckets) {
      if (next.length) {
        return next.shift();
      }
    }

    return overflow.shift() || null;
  };

  const ordered = [];
  for (let index = 0; index < desiredCounts.easy; index += 1) {
    const item = pull(easy, [medium, advanced]);
    if (item) {
      item.difficulty = 'easy';
      item.activeDifficulty = 'easy';
      ordered.push(item);
    }
  }

  for (let index = 0; index < desiredCounts.medium; index += 1) {
    const item = pull(medium, [advanced, easy]);
    if (item) {
      item.difficulty = 'medium';
      item.activeDifficulty = 'medium';
      ordered.push(item);
    }
  }

  for (let index = 0; index < desiredCounts.advanced; index += 1) {
    const item = pull(advanced, [medium, easy]);
    if (item) {
      item.difficulty = 'advanced';
      item.activeDifficulty = 'advanced';
      ordered.push(item);
    }
  }

  while (ordered.length < targetCount) {
    const item = pull(advanced, [medium, easy]);
    if (!item) {
      break;
    }

    ordered.push(item);
  }

  return ordered.slice(0, targetCount);
};

const applyPlannedResponseTypes = ({ selected = [], targetCount = 22 }) => {
  const plannedTypes = questionTypePlanner(targetCount);

  return (Array.isArray(selected) ? selected : []).map((item, index) => ({
    ...item,
    responseType: plannedTypes[index] || 'mcq',
  }));
};

const selectTopQuestions = ({
  candidates = [],
  askedQuestions = [],
  targetCount = 22,
}) => {
  const target = Math.max(1, Number(targetCount || 22));
  const targets = {
    type: buildWeightedCounts(target, QUESTION_TYPE_WEIGHTS),
    context: toContextTargets(target),
    difficulty: toDifficultyCurveTargets(target),
  };
  const traitTargets = buildWeightedCounts(target, TRAIT_WEIGHTS);

  const references = (Array.isArray(askedQuestions) ? askedQuestions : [])
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') return { text: entry };
      return { text: String(entry.text || entry.question || '') };
    })
    .filter(Boolean);

  const selected = [];
  const coveredFacets = new Set();
  const usedBaseIntents = new Set();
  const counts = {
    type: {},
    context: {},
    difficulty: {},
    trait: {},
  };
  const usedIntentTags = new Set();

  const pool = [...candidates].sort((a, b) => b.baseQuality - a.baseQuality);
  const requiredFacetKeys = flattenFacetCatalog().map((item) => item.facetKey);
  const deficitTotal = (targetMap = {}, currentMap = {}) =>
    Object.entries(targetMap).reduce((sum, [key, targetValue]) => {
      return sum + Math.max(Number(targetValue || 0) - Number(currentMap[key] || 0), 0);
    }, 0);

  const canPickCandidate = (
    candidate,
    remainingSlots,
    contextDeficit,
    typeDeficit,
    { respectContextQuota = true, respectTypeQuota = true } = {}
  ) => {
    if (!candidate || usedIntentTags.has(candidate.intentTag)) {
      return false;
    }

    if (
      hasSemanticDuplicate({
        text: candidate.text,
        references: [...references, ...selected],
        threshold: SIMILARITY_THRESHOLD,
      })
    ) {
      return false;
    }

    const contextKey = candidate.contextBucket;
    const typeKey = candidate.questionType;
    const wouldContextOverflow =
      Number(counts.context[contextKey] || 0) >= Number(targets.context[contextKey] || 0);
    const wouldTypeOverflow = Number(counts.type[typeKey] || 0) >= Number(targets.type[typeKey] || 0);

    if (respectContextQuota && wouldContextOverflow && remainingSlots <= contextDeficit) {
      return false;
    }

    if (respectTypeQuota && wouldTypeOverflow && remainingSlots <= typeDeficit) {
      return false;
    }

    return true;
  };

  const applySelection = (picked) => {
    selected.push(picked);
    coveredFacets.add(picked.traitFacetKey);
    usedBaseIntents.add(picked.baseIntent);
    usedIntentTags.add(picked.intentTag);

    counts.type[picked.questionType] = Number(counts.type[picked.questionType] || 0) + 1;
    counts.context[picked.contextBucket] = Number(counts.context[picked.contextBucket] || 0) + 1;
    counts.difficulty[picked.difficulty] = Number(counts.difficulty[picked.difficulty] || 0) + 1;
    counts.trait[picked.traitFocus] = Number(counts.trait[picked.traitFocus] || 0) + 1;
  };

  if (target >= requiredFacetKeys.length) {
    for (const facetKey of requiredFacetKeys) {
      if (selected.length >= target) {
        break;
      }

      const remainingSlots = target - selected.length;
      const contextDeficit = deficitTotal(targets.context, counts.context);
      const typeDeficit = deficitTotal(targets.type, counts.type);

      let bestIndex = -1;
      let bestScore = -Infinity;

      for (let index = 0; index < pool.length; index += 1) {
        const candidate = pool[index];
        if (!candidate || candidate.traitFacetKey !== facetKey) {
          continue;
        }

        if (
          !canPickCandidate(candidate, remainingSlots, contextDeficit, typeDeficit, {
            respectContextQuota: false,
            respectTypeQuota: true,
          })
        ) {
          continue;
        }

        const score =
          calculateDynamicSelectionScore({
            candidate,
            selected,
            targets,
            counts,
            coveredFacets,
            usedBaseIntents,
            traitTargets,
          }) + 0.6;

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }

      if (bestIndex >= 0) {
        const picked = pool.splice(bestIndex, 1)[0];
        applySelection(picked);
      }
    }
  }

  while (selected.length < target) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    const remainingSlots = target - selected.length;
    const contextDeficit = deficitTotal(targets.context, counts.context);
    const typeDeficit = deficitTotal(targets.type, counts.type);

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      if (
        !canPickCandidate(candidate, remainingSlots, contextDeficit, typeDeficit, {
          respectContextQuota: true,
          respectTypeQuota: true,
        })
      ) {
        continue;
      }

      const score = calculateDynamicSelectionScore({
        candidate,
        selected,
        targets,
        counts,
        coveredFacets,
        usedBaseIntents,
        traitTargets,
      });

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) {
      break;
    }

    const picked = pool.splice(bestIndex, 1)[0];
    applySelection(picked);
  }

  if (target >= requiredFacetKeys.length) {
    const selectedFacetCounts = selected.reduce((accumulator, item) => {
      accumulator[item.traitFacetKey] = Number(accumulator[item.traitFacetKey] || 0) + 1;
      return accumulator;
    }, {});
    const selectedContextCounts = selected.reduce((accumulator, item) => {
      accumulator[item.contextBucket] = Number(accumulator[item.contextBucket] || 0) + 1;
      return accumulator;
    }, {});

    const missingFacets = requiredFacetKeys.filter((facetKey) => !selectedFacetCounts[facetKey]);

    missingFacets.forEach((missingFacet) => {
      let replacementIndex = -1;
      let victimIndex = -1;

      for (let poolIndex = 0; poolIndex < pool.length; poolIndex += 1) {
        const candidate = pool[poolIndex];
        if (!candidate || candidate.traitFacetKey !== missingFacet) {
          continue;
        }

        if (
          hasSemanticDuplicate({
            text: candidate.text,
            references: [...references, ...selected],
            threshold: SIMILARITY_THRESHOLD,
          })
        ) {
          continue;
        }

        const localVictimIndex = selected.findIndex((selectedItem) => {
          const duplicateFacetCount = Number(selectedFacetCounts[selectedItem.traitFacetKey] || 0);
          if (duplicateFacetCount <= 1) {
            return false;
          }

          const sameType = selectedItem.questionType === candidate.questionType;
          const sameContext = selectedItem.contextBucket === candidate.contextBucket;

          return sameType && sameContext;
        });

        if (localVictimIndex >= 0) {
          replacementIndex = poolIndex;
          victimIndex = localVictimIndex;
          break;
        }
      }

      if (replacementIndex < 0 || victimIndex < 0) {
        return;
      }

      const replacement = pool[replacementIndex];
      const victim = selected[victimIndex];
      selectedFacetCounts[victim.traitFacetKey] = Math.max(
        Number(selectedFacetCounts[victim.traitFacetKey] || 1) - 1,
        0
      );
      selectedFacetCounts[replacement.traitFacetKey] =
        Number(selectedFacetCounts[replacement.traitFacetKey] || 0) + 1;
      selectedContextCounts[victim.contextBucket] = Math.max(
        Number(selectedContextCounts[victim.contextBucket] || 1) - 1,
        0
      );
      selectedContextCounts[replacement.contextBucket] =
        Number(selectedContextCounts[replacement.contextBucket] || 0) + 1;

      selected[victimIndex] = replacement;
      pool.splice(replacementIndex, 1, victim);
    });
  }

  const finalFacetCounts = selected.reduce((accumulator, item) => {
    accumulator[item.traitFacetKey] = Number(accumulator[item.traitFacetKey] || 0) + 1;
    return accumulator;
  }, {});
  const finalContextCounts = selected.reduce((accumulator, item) => {
    accumulator[item.contextBucket] = Number(accumulator[item.contextBucket] || 0) + 1;
    return accumulator;
  }, {});

  const contextKeys = Object.keys(targets.context);
  contextKeys.forEach((deficitContext) => {
    while (Number(finalContextCounts[deficitContext] || 0) < Number(targets.context[deficitContext] || 0)) {
      const replacementIndex = pool.findIndex((candidate) => {
        if (!candidate || candidate.contextBucket !== deficitContext) {
          return false;
        }

        if (
          hasSemanticDuplicate({
            text: candidate.text,
            references: [...references, ...selected],
            threshold: SIMILARITY_THRESHOLD,
          })
        ) {
          return false;
        }

        return true;
      });

      if (replacementIndex < 0) {
        break;
      }

      const replacement = pool[replacementIndex];
      const victimIndex = selected.findIndex((candidate) => {
        const contextOverflow =
          Number(finalContextCounts[candidate.contextBucket] || 0) >
          Number(targets.context[candidate.contextBucket] || 0);
        if (!contextOverflow) {
          return false;
        }

        if (candidate.questionType !== replacement.questionType) {
          return false;
        }

        return Number(finalFacetCounts[candidate.traitFacetKey] || 0) > 1;
      });

      if (victimIndex < 0) {
        break;
      }

      const victim = selected[victimIndex];
      finalFacetCounts[victim.traitFacetKey] = Math.max(
        Number(finalFacetCounts[victim.traitFacetKey] || 1) - 1,
        0
      );
      finalFacetCounts[replacement.traitFacetKey] =
        Number(finalFacetCounts[replacement.traitFacetKey] || 0) + 1;

      finalContextCounts[victim.contextBucket] = Math.max(
        Number(finalContextCounts[victim.contextBucket] || 1) - 1,
        0
      );
      finalContextCounts[replacement.contextBucket] =
        Number(finalContextCounts[replacement.contextBucket] || 0) + 1;

      selected[victimIndex] = replacement;
      pool.splice(replacementIndex, 1, victim);
    }
  });

  const reordered = reorderByDifficultyCurve({
    selected,
    targetCount: target,
  });
  const typed = applyPlannedResponseTypes({
    selected: reordered,
    targetCount: target,
  });

  return {
    selected: typed,
    diagnostics: {
      counts,
      traitTargets,
      typeTargets: targets.type,
      contextTargets: targets.context,
      difficultyTargets: targets.difficulty,
      responseTypeTargets: buildWeightedCounts(target, QUESTION_RESPONSE_TYPE_WEIGHTS),
      selectedCount: typed.length,
      candidateCount: candidates.length,
    },
  };
};

const normalizeToQuestionPlanItem = ({
  item,
  order = 0,
  baseIndex = 0,
}) => {
  const idSeed = `${item.intentTag}|${item.text}|${order}|${baseIndex}`;
  const id = `${toSlug(item.intentTag).slice(0, 62)}-${crypto
    .createHash('md5')
    .update(idSeed)
    .digest('hex')
    .slice(0, 8)}`;

  const responseType = ['likert', 'mcq', 'scale', 'text'].includes(String(item.responseType || '').toLowerCase())
    ? String(item.responseType).toLowerCase()
    : 'mcq';

  const options =
    responseType === 'mcq'
      ? generateMcqOptions({
          questionText: item.text,
          intentTag: item.intentTag,
          questionType: item.questionType,
          traitFocus: item.traitFocus,
        })
      : [];

  const scoringType =
    item.contextBucket === 'cognitive_scenario' || item.questionType === 'tradeoff'
      ? 'cognitive_signal'
      : 'behavior_signal';

  return {
    id,
    questionId: id,
    text: toCleanText(item.text),
    type: responseType,
    category: item.category || 'personality',
    plannerCategory: item.plannerCategory || item.category || 'personality',
    trait: item.traitTarget,
    traitFocus: item.traitFocus || 'O',
    traitTarget: item.traitTarget || item.traitFocus || 'behavior',
    difficulty: item.difficulty || 'medium',
    activeDifficulty: item.difficulty || 'medium',
    options,
    scaleMin: responseType === 'scale' ? 1 : responseType === 'likert' ? 1 : null,
    scaleMax: responseType === 'scale' ? 10 : responseType === 'likert' ? 5 : null,
    expectedAnswer: responseType === 'mcq' ? 'A' : responseType === 'text' ? '' : 3,
    intent: item.baseIntent,
    intentTag: item.intentTag,
    source: 'psychometric_phase7',
    answerFormat:
      responseType === 'likert'
        ? 'rating'
        : responseType === 'scale'
        ? 'slider'
        : responseType === 'text'
        ? 'text_long'
        : 'choice',
    scoringType: responseType === 'text' ? 'ai_analysis' : scoringType,
    theme: item.theme || 'personal',
    stage: item.stage || 'personality',
    uiHint:
      responseType === 'text'
        ? 'Describe your real decision process clearly and specifically.'
        : responseType === 'likert'
        ? 'Select how strongly this matches your real behavior.'
        : responseType === 'scale'
        ? 'Use the slider to reflect your real tendency in this scenario.'
        : 'Situation first. Choose the action you would actually take.',
    expectedLength: responseType === 'text' ? 70 : 0,
    expectsExample: false,
    contextBucket: item.contextBucket || 'personality_general',
    memorySignature: toQuestionSignature(item.text),
    domainTags: Array.isArray(item.domainTags) ? item.domainTags : [],
    skillTags: Array.isArray(item.skillTags) ? item.skillTags : [],
    order: baseIndex + order,
    questionType: item.questionType || 'decision',
  };
};

const buildPsychometricQuestionPlan = ({
  profileVector = {},
  cvData = {},
  askedQuestions = [],
  targetCount = 22,
  baseIndex = 0,
}) => {
  const candidatePool = buildCandidatePool({
    profileVector,
    cvData,
    askedQuestions,
    targetCount,
    baseIndex,
  });

  const selection = selectTopQuestions({
    candidates: candidatePool,
    askedQuestions,
    targetCount,
  });

  const questionPlan = selection.selected.map((item, index) =>
    normalizeToQuestionPlanItem({
      item,
      order: index,
      baseIndex,
    })
  );

  const backupTypePlan = questionTypePlanner(candidatePool.length);

  const questionPoolBackup = candidatePool.map((candidate, index) => ({
    questionId: `candidate_${baseIndex}_${index + 1}`,
    text: candidate.text,
    type: backupTypePlan[index] || 'mcq',
    category: candidate.category,
    trait: candidate.traitTarget,
    traitFocus: candidate.traitFocus,
    traitTarget: candidate.traitTarget,
    difficulty: candidate.difficulty,
    activeDifficulty: candidate.difficulty,
    answerFormat:
      (backupTypePlan[index] || 'mcq') === 'likert'
        ? 'rating'
        : (backupTypePlan[index] || 'mcq') === 'scale'
        ? 'slider'
        : (backupTypePlan[index] || 'mcq') === 'text'
        ? 'text_long'
        : 'choice',
    scoringType:
      (backupTypePlan[index] || 'mcq') === 'text'
        ? 'ai_analysis'
        : candidate.contextBucket === 'cognitive_scenario' || candidate.questionType === 'tradeoff'
        ? 'cognitive_signal'
        : 'behavior_signal',
    stage: candidate.stage,
    theme: candidate.theme,
    contextBucket: candidate.contextBucket,
    uiHint: 'Situation first. Choose the action you would actually take.',
    expectedLength: (backupTypePlan[index] || 'mcq') === 'text' ? 70 : 0,
    options:
      (backupTypePlan[index] || 'mcq') === 'mcq'
        ? generateMcqOptions({
            questionText: candidate.text,
            intentTag: candidate.intentTag,
            questionType: candidate.questionType,
            traitFocus: candidate.traitFocus,
          })
        : [],
    scaleMin: (backupTypePlan[index] || 'mcq') === 'scale' ? 1 : (backupTypePlan[index] || 'mcq') === 'likert' ? 1 : null,
    scaleMax: (backupTypePlan[index] || 'mcq') === 'scale' ? 10 : (backupTypePlan[index] || 'mcq') === 'likert' ? 5 : null,
    expectedAnswer: (backupTypePlan[index] || 'mcq') === 'mcq' ? 'A' : 3,
    intent: candidate.baseIntent,
    intentTag: candidate.intentTag,
    signature: candidate.signature,
    questionType: candidate.questionType,
    qualityScore: candidate.baseQuality,
    validationScore: candidate.validation?.score || 0,
  }));

  return {
    questionPlan,
    questionPoolBackup,
    diagnostics: {
      ...selection.diagnostics,
      selectedIntentCount: new Set(questionPlan.map((item) => item.intentTag)).size,
      questionTypes: countBy(questionPlan, (item) => item.type || 'mcq'),
      decisionStyles: countBy(questionPlan, (item) => item.questionType || 'decision'),
      contextBuckets: countBy(questionPlan, (item) => item.contextBucket || 'personality_general'),
      traitCoverage: countBy(questionPlan, (item) => item.traitFocus || 'O'),
    },
  };
};

module.exports = {
  buildPsychometricQuestionPlan,
  questionTypePlanner,
  SIMILARITY_THRESHOLD,
  QUESTION_LENGTH_MIN,
  QUESTION_LENGTH_MAX,
  CANDIDATE_POOL_SIZE,
};
