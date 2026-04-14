const crypto = require('crypto');
const { config } = require('../config/env');
const { extractOutputText, parseJsonFromText } = require('./assessment/aiJson');
const { getOpenAiClient } = require('./assessment/openaiClient');
const { FACET_LIBRARY, TRAITS, difficultyForIndex } = require('./question-coverage.service');

const QUESTION_LENGTH_MIN = 13;
const QUESTION_LENGTH_MAX = 22;
const ANSWER_TYPES = ['mcq', 'likert', 'slider', 'text'];
const DIFFICULTY_LEVELS = ['easy', 'medium', 'advanced'];
const OPTION_IDS = ['A', 'B', 'C', 'D'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const toWords = (value = '') =>
  toText(value)
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

const withQuestionMark = (value = '') => {
  const normalized = toText(value).replace(/[.?!]+$/g, '');
  return normalized ? `${normalized}?` : '';
};

const enforceLength = ({ text = '', fallback }) => {
  let question = withQuestionMark(text || fallback);

  if (!question) {
    return withQuestionMark(fallback);
  }

  let words = toWords(question);

  if (words.length < QUESTION_LENGTH_MIN) {
    const filler = ['in', 'a', 'real', 'work', 'situation', 'under', 'pressure'];
    const needed = QUESTION_LENGTH_MIN - words.length;
    question = withQuestionMark(`${question.replace(/[?]+$/, '')} ${filler.slice(0, needed).join(' ')}`);
    words = toWords(question);
  }

  if (words.length > QUESTION_LENGTH_MAX) {
    question = withQuestionMark(words.slice(0, QUESTION_LENGTH_MAX).join(' '));
  }

  return question;
};

const normalizeAnswerType = (value = '', fallback = 'likert') => {
  const normalized = toText(value).toLowerCase();
  if (ANSWER_TYPES.includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeDifficulty = (value = '', fallback = 'medium') => {
  const normalized = toText(value).toLowerCase();
  if (DIFFICULTY_LEVELS.includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeTrait = (value = '', fallback = 'O') => {
  const token = toText(value).toUpperCase().charAt(0);
  if (TRAITS.includes(token)) {
    return token;
  }
  return fallback;
};

const normalizeOptions = (options = [], fallback = []) => {
  const source = Array.isArray(options) ? options : [];
  const normalized = source
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, 4);

  if (normalized.length === 4) {
    return normalized;
  }

  return fallback.slice(0, 4);
};

const normalizeScale = (scale = {}) => {
  const min = Number(scale?.min);
  const max = Number(scale?.max);

  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    return {
      min: clamp(Math.round(min), 0, 100),
      max: clamp(Math.round(max), 1, 100),
    };
  }

  return {
    min: 1,
    max: 10,
  };
};

const deterministicMcqOptions = ({ domain = 'work', skill = 'core skill' }) => [
  `Decide quickly in the ${domain} context using ${skill} judgment and accept immediate ownership.`,
  `Run a brief check with key teammates, then decide and communicate responsibilities clearly.`,
  `Pilot a small experiment first, then decide based on observed evidence from the outcome.`,
  `Delay the decision until more certainty appears, even if short-term progress slows.`
].map((option) => option.replace(/\s+/g, ' ').trim());

const fallbackQuestion = ({
  aiProfile = {},
  traitCoverage = {},
  questionIndex = 0,
  targetCount = 22,
  forceAnswerType,
}) => {
  const trait = normalizeTrait((traitCoverage?.missingTraits || [])[0], 'O');
  const domain = toText(aiProfile.domain || 'professional').toLowerCase() || 'professional';
  const skill = toText((aiProfile.skills || [])[0] || (aiProfile.tools || [])[0] || 'core expertise');
  const interest = toText((aiProfile.interests || [])[0] || 'impactful work');
  const facet =
    toText((traitCoverage?.missingFacets || [])[0]) ||
    FACET_LIBRARY[trait]?.[0] ||
    'adaptability';

  const typeCycle = ['mcq', 'likert', 'slider', 'text'];
  const forcedType = normalizeAnswerType(forceAnswerType, '');
  const answer_type =
    forcedType && ANSWER_TYPES.includes(forcedType)
      ? forcedType
      : typeCycle[questionIndex % typeCycle.length];
  const difficulty = difficultyForIndex({ questionIndex, targetCount });
  const variation = [
    'under tight delivery pressure',
    'after stakeholder feedback changes direction',
    'when late data introduces uncertainty',
    'while cross-team dependencies create delays',
    'when quality and speed conflict sharply',
    'as priorities shift unexpectedly',
  ][questionIndex % 6];

  const scenarios = {
    mcq: `In a ${domain} sprint using ${skill} ${variation}, how do you choose your next move`,
    likert: `When complex ${domain} work shifts ${variation}, I stay composed and organize execution around ${interest}`,
    slider: `How strongly do you intensify experimentation when ${domain} constraints block ${skill} goals ${variation}`,
    text: `Describe one ${domain} decision where ${skill} balanced risk and collaboration ${variation}`,
  };

  return {
    question: enforceLength({
      text: scenarios[answer_type],
      fallback: `In a ${domain} scenario, how do you respond when uncertainty affects key outcomes`,
    }),
    answer_type,
    options:
      answer_type === 'mcq'
        ? deterministicMcqOptions({ domain, skill })
        : [],
    scale: answer_type === 'slider' ? { min: 1, max: 10 } : { min: 0, max: 0 },
    trait,
    facet,
    intent: `${domain}_${trait.toLowerCase()}_${facet}`,
    difficulty,
    cv_relevance: 0.82,
    reasoning_weight: difficulty === 'advanced' ? 0.82 : difficulty === 'medium' ? 0.72 : 0.62,
  };
};

const normalizeGeneratedQuestion = ({
  payload = {},
  fallback,
  aiProfile,
  questionIndex = 0,
  targetCount = 22,
  forceAnswerType,
}) => {
  const safeFallback = fallbackQuestion({
    aiProfile,
    traitCoverage: fallback,
    questionIndex,
    targetCount,
    forceAnswerType,
  });

  const answer_type = forceAnswerType
    ? normalizeAnswerType(forceAnswerType, safeFallback.answer_type)
    : normalizeAnswerType(payload.answer_type, safeFallback.answer_type);
  const trait = normalizeTrait(payload.trait, safeFallback.trait);

  const base = {
    question: enforceLength({
      text: payload.question,
      fallback: safeFallback.question,
    }),
    answer_type,
    options:
      answer_type === 'mcq'
        ? normalizeOptions(payload.options, safeFallback.options)
        : [],
    scale: answer_type === 'slider' ? normalizeScale(payload.scale) : { min: 0, max: 0 },
    trait,
    facet: toText(payload.facet || safeFallback.facet).toLowerCase() || safeFallback.facet,
    intent: toText(payload.intent || safeFallback.intent),
    difficulty: normalizeDifficulty(payload.difficulty, safeFallback.difficulty),
    cv_relevance: clamp(Number(payload.cv_relevance ?? safeFallback.cv_relevance), 0, 1),
    reasoning_weight: clamp(Number(payload.reasoning_weight ?? safeFallback.reasoning_weight), 0.1, 1),
  };

  if (base.answer_type === 'mcq' && base.options.length !== 4) {
    base.options = safeFallback.options;
  }

  if (base.answer_type !== 'slider') {
    base.scale = { min: 0, max: 0 };
  }

  return base;
};

const buildPrompt = ({
  aiProfile = {},
  askedQuestions = [],
  coverage = {},
  questionIndex = 0,
  forceAnswerType,
}) => {
  const asked = (Array.isArray(askedQuestions) ? askedQuestions : [])
    .slice(-14)
    .map((item) => (typeof item === 'string' ? item : item?.text || item?.question || ''))
    .map((item) => toText(item))
    .filter(Boolean)
    .join('\n- ');

  return `You are generating psychometric assessment questions.\n\nUse:\n\nUser CV intelligence\nskills\nsubjects\ninterests\nbehavior signals\nmissing trait coverage\nprevious questions\n\nRules:\n\nQuestion length:\n13–22 words\n\nScenario based\n\nYou must decide answer type:\n\nMCQ → decision scenario\nLikert → agreement scenario\nSlider → intensity scenario\nText → reasoning scenario\n\nIf MCQ:\nGenerate 4 context-aware options.\n\nOptions must:\n\nmatch scenario\nbe behaviorally distinct\navoid synonyms\navoid generic language\n\nReturn JSON only using schema:\n{\n  "question": "",\n  "answer_type": "mcq|likert|slider|text",\n  "options": [""],\n  "scale": {"min":1,"max":10},\n  "trait": "O|C|E|A|N",\n  "facet": "",\n  "intent": "",\n  "difficulty": "easy|medium|advanced",\n  "cv_relevance": 0,\n  "reasoning_weight": 0\n}\n\nQuestion index: ${Number(questionIndex || 0)}\nMissing traits: ${JSON.stringify(coverage?.missingTraits || [])}\nMissing facets: ${JSON.stringify(coverage?.missingFacets || [])}\nCV focus needed: ${Boolean(coverage?.cvFocusNeeded)}\nExpected difficulty: ${coverage?.nextDifficulty || 'medium'}\n${forceAnswerType ? `Force answer type for coverage balance: ${forceAnswerType}` : ''}\nTrait coverage: ${JSON.stringify(coverage?.traitCoverage || {})}\n\nAI Profile:\n${JSON.stringify(aiProfile, null, 2)}\n\nPrevious questions:\n- ${asked || 'none'}`;
};

const generateAdaptiveQuestion = async ({
  aiProfile = {},
  askedQuestions = [],
  traitCoverage = {},
  difficultyProgression = {},
  questionIndex = 0,
  targetCount = 22,
  forceAnswerType,
} = {}) => {
  const fallbackCoverage = {
    ...traitCoverage,
    nextDifficulty: difficultyProgression?.expectedDifficulty || traitCoverage?.nextDifficulty,
  };

  if (!config.openaiApiKey) {
    return fallbackQuestion({
      aiProfile,
      traitCoverage: fallbackCoverage,
      questionIndex,
      targetCount,
      forceAnswerType,
    });
  }

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.28,
      max_output_tokens: 700,
      input: [
        {
          role: 'system',
          content:
            'Generate one adaptive psychometric question. Return strict JSON only. Do not include markdown.',
        },
        {
          role: 'user',
          content: buildPrompt({
            aiProfile,
            askedQuestions,
            coverage: fallbackCoverage,
            questionIndex,
            forceAnswerType,
          }),
        },
      ],
    });

    const parsed = parseJsonFromText(extractOutputText(response), 'Adaptive question output invalid');
    return normalizeGeneratedQuestion({
      payload: parsed,
      fallback: fallbackCoverage,
      aiProfile,
      questionIndex,
      targetCount,
      forceAnswerType,
    });
  } catch (error) {
    return fallbackQuestion({
      aiProfile,
      traitCoverage: fallbackCoverage,
      questionIndex,
      targetCount,
      forceAnswerType,
    });
  }
};

const toQuestionId = ({ question = '', trait = 'O', index = 0 }) => {
  const hash = crypto
    .createHash('sha1')
    .update(`${question}|${trait}|${index + 1}`)
    .digest('hex')
    .slice(0, 10);

  return `aq-${String(trait).toLowerCase()}-${index + 1}-${hash}`;
};

const toQuestionPlanItem = ({ generated = {}, aiProfile = {}, index = 0 }) => {
  const id = toQuestionId({ question: generated.question, trait: generated.trait, index });

  const options = (generated.options || []).map((label, optionIndex) => {
    const decay = 1 - optionIndex * 0.22;
    const weight = clamp(
      Math.round(clamp(Number(generated.reasoning_weight || 0.6), 0.1, 1) * decay * 5),
      1,
      5
    );

    return {
      id: OPTION_IDS[optionIndex] || `OPT_${optionIndex + 1}`,
      label,
      weight,
    };
  });

  const isSlider = generated.answer_type === 'slider';

  return {
    id,
    questionId: id,
    source: 'ai_adaptive',
    type: isSlider ? 'scale' : generated.answer_type,
    rawAnswerType: generated.answer_type,
    category: 'personality',
    plannerCategory: 'personality',
    intent: generated.intent,
    intentTag: generated.intent,
    trait: generated.trait,
    traitFocus: generated.trait,
    traitTarget: generated.facet,
    facet: generated.facet,
    options: generated.answer_type === 'mcq' ? options : [],
    scaleMin: isSlider ? Number(generated.scale?.min || 1) : null,
    scaleMax: isSlider ? Number(generated.scale?.max || 10) : null,
    expectedAnswer: null,
    difficulty: generated.difficulty,
    activeDifficulty: generated.difficulty,
    stage: 'personality',
    theme: 'decision',
    answerFormat:
      generated.answer_type === 'mcq'
        ? 'choice'
        : generated.answer_type === 'text'
        ? 'text_long'
        : generated.answer_type === 'slider'
        ? 'slider'
        : 'rating',
    scoringType: generated.answer_type === 'text' ? 'ai_analysis' : 'weighted',
    uiHint:
      generated.answer_type === 'text'
        ? 'Write a concrete real example from your own experience.'
        : 'Answer based on your real behavior, not ideal behavior.',
    expectedLength: generated.answer_type === 'text' ? 280 : 0,
    memorySignature: crypto
      .createHash('sha1')
      .update(String(generated.question || '').toLowerCase())
      .digest('hex'),
    text: generated.question,
    domainTags: [String(aiProfile.domain || 'general')],
    skillTags: (Array.isArray(aiProfile.skills) ? aiProfile.skills : []).slice(0, 8),
    cvRelevance: Number(generated.cv_relevance || 0),
    reasoningWeight: Number(generated.reasoning_weight || 0),
    aiMeta: {
      cv_relevance: Number(generated.cv_relevance || 0),
      reasoning_weight: Number(generated.reasoning_weight || 0),
      trait: generated.trait,
      facet: generated.facet,
      answer_type: generated.answer_type,
      options: generated.options || [],
    },
  };
};

module.exports = {
  ANSWER_TYPES,
  DIFFICULTY_LEVELS,
  generateAdaptiveQuestion,
  toQuestionPlanItem,
};
