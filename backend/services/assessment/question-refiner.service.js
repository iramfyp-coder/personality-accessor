const { config } = require('../../config/env');
const { extractOutputText, parseJsonFromText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const refinerCache = new Map();

const GENERIC_STARTERS = [
  /^do you like\s+/i,
  /^i prefer\s+/i,
  /^are you (comfortable|good|able)\s+/i,
  /^how much do you\s+/i,
  /^would you\s+/i,
];

const GENERIC_PHRASE_REPLACEMENTS = [
  { pattern: /\bdo you like\b/gi, replacement: 'in a real project situation, how do you handle' },
  { pattern: /\bi prefer\b/gi, replacement: 'in your recent work, you typically choose to' },
];

const GENERIC_VERBS = [
  { pattern: /\bwork in teams?\b/gi, replacement: 'align with cross-functional teammates' },
  { pattern: /\bhandle stress\b/gi, replacement: 'maintain decision quality under pressure' },
  { pattern: /\bsolve problems\b/gi, replacement: 'diagnose and solve ambiguous problems' },
];

const toCleanText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const startsGeneric = (text) => GENERIC_STARTERS.some((pattern) => pattern.test(text));

const applyVerbRefinement = (text) =>
  GENERIC_VERBS.reduce((accumulator, rule) => accumulator.replace(rule.pattern, rule.replacement), text);

const removeGenericPhrases = (text) =>
  GENERIC_PHRASE_REPLACEMENTS.reduce(
    (accumulator, rule) => accumulator.replace(rule.pattern, rule.replacement),
    text
  );

const normalizeDifficulty = (value, fallback = 'intermediate') => {
  const normalized = String(value || '').toLowerCase();
  return ['beginner', 'intermediate', 'advanced'].includes(normalized) ? normalized : fallback;
};

const ensureDecisionPoint = (text) => {
  const normalized = toCleanText(text);
  if (/\b(you usually|you first|what would you do|which action|how do you decide)\b/i.test(normalized)) {
    return normalized.endsWith('?') ? normalized : `${normalized}?`;
  }

  return `${normalized.replace(/\?*$/, '')}. What is your first decision and why?`;
};

const buildScenarioPrefix = ({ context, category }) => {
  const domain = String(context.domainCategory || 'professional').replace(/_/g, ' ');
  const skill = Array.isArray(context.skillHighlights)
    ? context.skillHighlights.find(Boolean)
    : '';
  const categoryLabel = String(category || 'career').replace(/_/g, ' ');

  const skillClause = skill ? ` using ${skill}` : '';
  return `In a realistic ${domain} ${categoryLabel} situation${skillClause},`;
};

const refineQuestionWithRules = ({ question, context }) => {
  const raw = toCleanText(question.baseText || question.text || '');
  if (!raw) {
    return '';
  }

  const noGenericPhrases = removeGenericPhrases(raw);
  const refinedVerbText = applyVerbRefinement(noGenericPhrases);
  const hasScenarioCue = /\b(when|during|while|assigned|deadline|stakeholder|project|team|situation)\b/i.test(
    refinedVerbText
  );
  const isGeneric = startsGeneric(refinedVerbText) || !hasScenarioCue;
  const prefix = buildScenarioPrefix({
    context,
    category: question.plannerCategory || question.category,
  });

  const scenarioReady = isGeneric ? `${prefix} ${refinedVerbText.replace(/\?*$/, '')}` : refinedVerbText;

  const decisionReady =
    question.type === 'scale'
      ? scenarioReady.endsWith('.') ? scenarioReady : `${scenarioReady}.`
      : ensureDecisionPoint(scenarioReady);

  const realismReady = /\b(career|role|project|stakeholder|deadline)\b/i.test(decisionReady)
    ? decisionReady
    : `${decisionReady.replace(/\?*$/, '')} in a realistic career situation?`;

  return toCleanText(realismReady);
};

const normalizeAiQuestions = (payload, fallbackQuestions = []) => {
  const list = Array.isArray(payload?.questions) ? payload.questions : [];
  const byId = new Map();

  list.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const questionId = String(item.questionId || item.id || '').trim();
    const refinedText = toCleanText(item.refinedText || item.text || '');

    if (!questionId || !refinedText) {
      return;
    }

    byId.set(questionId, {
      questionId,
      refinedText,
      difficulty: normalizeDifficulty(item.difficulty),
    });
  });

  return fallbackQuestions.map((question) => {
    const aiVersion = byId.get(question.questionId);
    if (!aiVersion) {
      return question;
    }

    return {
      ...question,
      text: aiVersion.refinedText,
      activeDifficulty: aiVersion.difficulty || question.activeDifficulty,
      aiRefined: true,
    };
  });
};

const refineQuestionsWithAi = async ({ questions, context }) => {
  if (!config.openaiApiKey || !Array.isArray(questions) || questions.length === 0) {
    return questions;
  }

  const promptPayload = questions.map((question) => ({
    questionId: question.questionId,
    rawText: question.baseText || question.text,
    category: question.plannerCategory || question.category,
    type: question.type,
    difficulty: question.activeDifficulty || question.difficulty || 'intermediate',
    traitFocus: question.traitFocus || question.traitTarget,
  }));

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    temperature: 0.2,
    max_output_tokens: 2200,
    input: [
      {
        role: 'system',
        content:
          'You refine assessment questions. Ensure each is scenario-based, measurable, realistic, concise, and non-generic. Return JSON only.',
      },
      {
        role: 'user',
        content: `Context:\n- Candidate domain: ${context.domainCategory}\n- Experience: ${context.experienceLevel}\n- Skills: ${(context.skillHighlights || []).join(', ') || 'n/a'}\n\nQuestions:\n${JSON.stringify(promptPayload, null, 2)}\n\nOutput schema:\n{\n  "questions": [\n    {\n      "questionId": "",\n      "refinedText": "",\n      "difficulty": "beginner|intermediate|advanced"\n    }\n  ]\n}`,
      },
    ],
  });

  const parsed = parseJsonFromText(extractOutputText(response), 'Question refiner response invalid');
  return normalizeAiQuestions(parsed, questions);
};

const buildRefinerCacheKey = ({ question, context }) =>
  `${question.questionId}:${question.activeDifficulty || question.difficulty}:${
    context.domainCategory
  }:${context.experienceLevel}`;

const refineQuestion = ({ question, context }) => {
  const key = buildRefinerCacheKey({ question, context });
  if (refinerCache.has(key)) {
    return refinerCache.get(key);
  }

  const refined = refineQuestionWithRules({ question, context });
  refinerCache.set(key, refined);
  return refined;
};

const refineQuestionSet = async ({ questions, context }) => {
  const prepared = questions.map((question) => ({
    ...question,
    text: refineQuestion({ question, context }),
    aiRefined: false,
  }));

  try {
    return await refineQuestionsWithAi({ questions: prepared, context });
  } catch (error) {
    return prepared;
  }
};

module.exports = {
  refineQuestion,
  refineQuestionSet,
  refineQuestionWithRules,
};
