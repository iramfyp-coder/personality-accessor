const { config } = require('../../config/env');
const { extractOutputText, parseJsonFromText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const POSITIVE_WORDS = [
  'learn',
  'improve',
  'adapt',
  'solution',
  'collaborate',
  'reflect',
  'calm',
  'resolve',
  'growth',
  'ownership',
  'responsibility',
];

const NEGATIVE_WORDS = [
  'panic',
  'blame',
  'quit',
  'stuck',
  'angry',
  'frustrated',
  'anxious',
  'avoid',
  'ignore',
  'uncertain',
];

const toStringList = (value, limit = 12) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, limit);

const normalizeBehaviorAnalysis = (payload = {}) => ({
  personality_signals: toStringList(payload.personality_signals, 12),
  emotional_stability: String(payload.emotional_stability || 'moderate').trim(),
  decision_style: String(payload.decision_style || 'balanced').trim(),
  confidence_level: String(payload.confidence_level || 'moderate').trim(),
  risk_tendency: String(payload.risk_tendency || 'balanced').trim(),
});

const simpleBehaviorHeuristic = (answers = []) => {
  const combined = (Array.isArray(answers) ? answers : [])
    .map((item) => String(item?.text || ''))
    .join(' ')
    .toLowerCase();

  const positiveHits = POSITIVE_WORDS.reduce(
    (count, token) => count + (combined.includes(token) ? 1 : 0),
    0
  );
  const negativeHits = NEGATIVE_WORDS.reduce(
    (count, token) => count + (combined.includes(token) ? 1 : 0),
    0
  );

  const emotionalStability =
    negativeHits >= positiveHits + 2
      ? 'reactive under pressure'
      : positiveHits >= negativeHits + 2
      ? 'stable and reflective'
      : 'moderately stable';

  const confidenceLevel =
    combined.includes('decide') || combined.includes('took ownership')
      ? 'high'
      : positiveHits >= negativeHits
      ? 'moderate to high'
      : 'moderate';

  const decisionStyle =
    combined.includes('data') || combined.includes('analysis')
      ? 'evidence-led'
      : combined.includes('team') || combined.includes('stakeholder')
      ? 'collaborative'
      : 'context-driven';

  const riskTendency =
    combined.includes('experiment') || combined.includes('prototype')
      ? 'calculated risk taker'
      : combined.includes('avoid')
      ? 'risk-averse'
      : 'balanced';

  const signals = [
    `Positive reflection signals: ${positiveHits}`,
    `Stress wording signals: ${negativeHits}`,
    `Narrative depth: ${Math.max(1, Math.round(combined.split(/\s+/).length / 45))}/5`,
  ];

  return normalizeBehaviorAnalysis({
    personality_signals: signals,
    emotional_stability: emotionalStability,
    decision_style: decisionStyle,
    confidence_level: confidenceLevel,
    risk_tendency: riskTendency,
  });
};

const analyzeBehaviorWithAi = async ({ answers, cvData, profileVector }) => {
  if (!config.openaiApiKey) {
    return null;
  }

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    temperature: 0.25,
    max_output_tokens: 1200,
    input: [
      {
        role: 'system',
        content:
          'You are a behavioral psychologist for career assessments. Analyze written responses for emotional patterns and decision signals. Return strict JSON.',
      },
      {
        role: 'user',
        content: `Candidate context:\n- Domain: ${profileVector?.domainCategory || 'unknown'}\n- Experience level: ${profileVector?.experienceLevel || 'unknown'}\n- Skills: ${(cvData?.skills || [])
          .slice(0, 6)
          .map((skill) => skill.name)
          .join(', ') || 'n/a'}\n\nBehavior answers:\n${JSON.stringify(
          answers,
          null,
          2
        )}\n\nReturn schema:\n{\n  "personality_signals": [""],\n  "emotional_stability": "",\n  "decision_style": "",\n  "confidence_level": "",\n  "risk_tendency": ""\n}`,
      },
    ],
  });

  const parsed = parseJsonFromText(
    extractOutputText(response),
    'Behavior analysis response invalid'
  );

  return normalizeBehaviorAnalysis(parsed);
};

const analyzeBehavior = async ({ answers, cvData, profileVector }) => {
  const fallback = simpleBehaviorHeuristic(answers);

  try {
    const ai = await analyzeBehaviorWithAi({ answers, cvData, profileVector });

    if (!ai) {
      return fallback;
    }

    return ai;
  } catch (error) {
    return fallback;
  }
};

module.exports = {
  analyzeBehavior,
};
