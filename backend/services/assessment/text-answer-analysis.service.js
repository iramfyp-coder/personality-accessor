const { config } = require('../../config/env');
const { extractOutputText, parseJsonFromText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const TRAITS = ['O', 'C', 'E', 'A', 'N'];

const POSITIVE_TOKENS = [
  'learn',
  'improve',
  'collaborate',
  'plan',
  'ownership',
  'reflect',
  'calm',
  'aligned',
  'deliver',
  'impact',
  'prioritize',
];

const NEGATIVE_TOKENS = [
  'panic',
  'stuck',
  'avoid',
  'blame',
  'late',
  'angry',
  'confused',
  'overwhelmed',
  'ignore',
  'frustrated',
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeTraitSignals = (signals = {}) =>
  TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = clamp(safeNumber(signals[trait]), -1, 1);
    return accumulator;
  }, {});

const normalizePayload = (payload = {}) => {
  const confidence = clamp(safeNumber(payload.confidence, 0.5), 0, 1);
  const sentiment = clamp(safeNumber(payload.sentiment, 0), -1, 1);
  const traitSignals = normalizeTraitSignals(payload.trait_signals || payload.traitSignals || {});
  const creativity = clamp(safeNumber(payload.creativity, 55), 0, 100);
  const reasoning = clamp(safeNumber(payload.reasoning, 55), 0, 100);
  const leadership = clamp(safeNumber(payload.leadership, 50), 0, 100);
  const extractedTraits = (Array.isArray(payload.extracted_traits) ? payload.extracted_traits : [])
    .map((item) => String(item || '').toUpperCase().trim())
    .filter((item) => TRAITS.includes(item))
    .slice(0, 3);

  const summary = String(payload.summary || '').trim();
  const normalizedScore = clamp(3 + sentiment * 0.9 + (confidence - 0.5) * 1.4, 1, 5);

  return {
    trait_signals: traitSignals,
    confidence,
    sentiment,
    creativity,
    reasoning,
    leadership,
    extracted_traits: extractedTraits,
    summary,
    normalized_score: Number(normalizedScore.toFixed(2)),
  };
};

const simpleHeuristic = ({ answerText = '', exampleText = '', question = {} }) => {
  const combined = `${String(answerText || '')} ${String(exampleText || '')}`.toLowerCase();

  const positiveHits = POSITIVE_TOKENS.reduce(
    (count, token) => count + (combined.includes(token) ? 1 : 0),
    0
  );

  const negativeHits = NEGATIVE_TOKENS.reduce(
    (count, token) => count + (combined.includes(token) ? 1 : 0),
    0
  );

  const lengthScore = clamp(combined.trim().length / 500, 0, 1);
  const sentiment = clamp((positiveHits - negativeHits) / 6, -1, 1);
  const confidence = clamp(0.35 + lengthScore * 0.35 + Math.max(0, sentiment) * 0.3, 0, 1);

  const traitSignals = {
    O: combined.includes('experiment') || combined.includes('idea') ? 0.45 : 0.1,
    C: combined.includes('plan') || combined.includes('timeline') ? 0.5 : 0.12,
    E: combined.includes('team') || combined.includes('communicat') ? 0.4 : 0.08,
    A: combined.includes('support') || combined.includes('collaborat') ? 0.46 : 0.1,
    N: combined.includes('stress') || combined.includes('panic') ? 0.52 : -0.15,
  };

  const forcedTrait = String(question.traitTarget || question.traitFocus || '').toUpperCase().charAt(0);
  if (TRAITS.includes(forcedTrait)) {
    traitSignals[forcedTrait] = clamp(traitSignals[forcedTrait] + 0.18, -1, 1);
  }

  return normalizePayload({
    trait_signals: traitSignals,
    confidence,
    sentiment,
    creativity: clamp(42 + positiveHits * 7 + lengthScore * 22, 0, 100),
    reasoning: clamp(38 + lengthScore * 32 + positiveHits * 4 - negativeHits * 3, 0, 100),
    leadership: clamp(34 + (combined.includes('lead') || combined.includes('ownership') ? 24 : 9), 0, 100),
    extracted_traits: TRAITS.filter((trait) => traitSignals[trait] >= 0.35).slice(0, 3),
    summary: 'Heuristic analysis generated due to unavailable AI analysis.',
  });
};

const analyzeWithAi = async ({ answerText = '', exampleText = '', question = {}, profileVector = {} }) => {
  if (!config.openaiApiKey) {
    return null;
  }

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    temperature: 0.15,
    max_output_tokens: 900,
    input: [
      {
        role: 'system',
        content:
          'You analyze interview responses. Extract trait signals and communication confidence. Return JSON only.',
      },
      {
        role: 'user',
        content: `Analyze this interview answer.\n\nContext:\n- Domain: ${profileVector.domainCategory || 'unknown'}\n- Experience: ${profileVector.experience || 'mid'}\n- Question type: ${question.type || 'text'}\n- Question category: ${question.category || 'career'}\n- Trait target: ${question.traitTarget || question.traitFocus || 'unspecified'}\n\nQuestion:\n${question.text || ''}\n\nMain answer:\n${answerText}\n\nExample (if provided):\n${exampleText || 'n/a'}\n\nReturn schema:\n{\n  \"trait_signals\": {\"O\": -1..1, \"C\": -1..1, \"E\": -1..1, \"A\": -1..1, \"N\": -1..1},\n  \"confidence\": 0..1,\n  \"sentiment\": -1..1,\n  \"creativity\": 0..100,\n  \"reasoning\": 0..100,\n  \"leadership\": 0..100,\n  \"extracted_traits\": [\"O|C|E|A|N\"],\n  \"summary\": \"short explanation\"\n}`,
      },
    ],
  });

  const parsed = parseJsonFromText(
    extractOutputText(response),
    'Text answer analysis response is invalid'
  );

  return normalizePayload(parsed);
};

const analyzeTextAnswer = async ({
  answerText = '',
  exampleText = '',
  question = {},
  profileVector = {},
}) => {
  const fallback = simpleHeuristic({
    answerText,
    exampleText,
    question,
  });

  try {
    const ai = await analyzeWithAi({
      answerText,
      exampleText,
      question,
      profileVector,
    });

    if (!ai) {
      return fallback;
    }

    return ai;
  } catch (error) {
    return fallback;
  }
};

module.exports = {
  analyzeTextAnswer,
};
