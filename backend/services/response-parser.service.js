const { config } = require('../config/env');
const { extractOutputText, parseJsonFromText } = require('./assessment/aiJson');
const { getOpenAiClient } = require('./assessment/openaiClient');

const TRAITS = ['O', 'C', 'E', 'A', 'N'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const emptyTraitSignals = () => ({ O: 0, C: 0, E: 0, A: 0, N: 0 });

const resolveTrait = (question = {}, fallback = 'O') => {
  const explicit = String(question?.traitFocus || question?.trait || fallback)
    .toUpperCase()
    .charAt(0);

  if (TRAITS.includes(explicit)) {
    return explicit;
  }

  const token = String(question?.traitTarget || '').toLowerCase();
  if (/stress|risk|uncertain/.test(token)) return 'N';
  if (/team|empathy|cooper/.test(token)) return 'A';
  if (/leader|assert|social|influence/.test(token)) return 'E';
  if (/discipline|plan|system|organ/.test(token)) return 'C';
  return 'O';
};

const toCentered = (score) => clamp((Number(score || 0.5) - 0.5) * 2, -1, 1);

const toNormalizedFivePoint = ({ value, min = 1, max = 5 }) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 3;
  }

  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 1;
  const safeMax = Number.isFinite(Number(max)) ? Number(max) : 5;

  if (safeMax <= safeMin) {
    return clamp(numeric, 1, 5);
  }

  const normalized = ((numeric - safeMin) / (safeMax - safeMin)) * 4 + 1;
  return clamp(normalized, 1, 5);
};

const buildTraitSignal = ({ trait = 'O', centered = 0, weight = 0.7 }) => {
  const signals = emptyTraitSignals();
  signals[trait] = clamp(centered * clamp(weight, 0.1, 1), -1, 1);
  return signals;
};

const findOptionIndex = ({ answer = {}, question = {} }) => {
  const options = Array.isArray(question?.options) ? question.options : [];
  if (!options.length) {
    return 1;
  }

  const optionId = String(answer?.value?.optionId || answer?.value?.option_id || '').trim();
  const optionLabel = String(answer?.value?.optionLabel || answer?.value?.option_label || '').trim().toLowerCase();

  const byId = options.findIndex((item) => String(item?.id || '').trim() === optionId);
  if (byId >= 0) {
    return byId;
  }

  const byLabel = options.findIndex(
    (item) => String(item?.label || '').trim().toLowerCase() === optionLabel
  );
  if (byLabel >= 0) {
    return byLabel;
  }

  return 1;
};

const parseMcqResponse = ({ answer = {}, question = {} }) => {
  const trait = resolveTrait(question);
  const index = findOptionIndex({ answer, question });
  const optionWeights = Array.isArray(question?.aiMeta?.option_weights)
    ? question.aiMeta.option_weights
    : [1, 0.65, 0.35, 0.1];

  const normalized = clamp(Number(optionWeights[index] ?? optionWeights[1] ?? 0.5), 0, 1);
  const centered = toCentered(normalized);
  const reasoningWeight = clamp(Number(question?.reasoningWeight ?? question?.aiMeta?.reasoning_weight ?? 0.7), 0.1, 1);

  return {
    trait_signals: buildTraitSignal({
      trait,
      centered,
      weight: reasoningWeight,
    }),
    confidence: 0.74,
    behavior_indicators: [
      String(answer?.value?.optionLabel || answer?.value?.option_label || '').trim(),
    ].filter(Boolean),
    normalized_score: Number((normalized * 4 + 1).toFixed(2)),
    reasoning_weight: reasoningWeight,
  };
};

const parseLikertResponse = ({ answer = {}, question = {} }) => {
  const trait = resolveTrait(question);
  const value = Number(
    answer?.value?.normalizedScore ?? answer?.metadata?.normalizedScore ?? answer?.value ?? 3
  );

  const fivePoint = clamp(value, 1, 5);
  const centered = clamp((fivePoint - 3) / 2, -1, 1);
  const reasoningWeight = clamp(Number(question?.reasoningWeight ?? question?.aiMeta?.reasoning_weight ?? 0.65), 0.1, 1);

  return {
    trait_signals: buildTraitSignal({
      trait,
      centered,
      weight: reasoningWeight,
    }),
    confidence: 0.78,
    behavior_indicators: [],
    normalized_score: fivePoint,
    reasoning_weight: reasoningWeight,
  };
};

const parseSliderResponse = ({ answer = {}, question = {} }) => {
  const trait = resolveTrait(question);
  const min = Number(question?.scaleMin ?? answer?.metadata?.scaleMin ?? 1);
  const max = Number(question?.scaleMax ?? answer?.metadata?.scaleMax ?? 10);
  const raw = Number(answer?.value ?? answer?.value?.value ?? 0);

  const normalizedFivePoint = toNormalizedFivePoint({ value: raw, min, max });
  const centered = clamp((normalizedFivePoint - 3) / 2, -1, 1);
  const reasoningWeight = clamp(Number(question?.reasoningWeight ?? question?.aiMeta?.reasoning_weight ?? 0.7), 0.1, 1);

  return {
    trait_signals: buildTraitSignal({
      trait,
      centered,
      weight: reasoningWeight,
    }),
    confidence: 0.76,
    behavior_indicators: [],
    normalized_score: Number(normalizedFivePoint.toFixed(2)),
    reasoning_weight: reasoningWeight,
  };
};

const normalizeTextInterpretation = (payload = {}) => {
  const sourceSignals = payload.trait_signals || payload.traitSignals || {};
  const traitSignals = TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = clamp(Number(sourceSignals?.[trait] || 0), -1, 1);
    return accumulator;
  }, {});

  const confidence = clamp(Number(payload.confidence || 0.55), 0, 1);
  const behaviorIndicators = Array.isArray(payload.behavior_indicators || payload.behaviorIndicators)
    ? payload.behavior_indicators || payload.behaviorIndicators
    : [];

  const normalizedScore = clamp(Number(payload.normalized_score || payload.normalizedScore || 3), 1, 5);

  return {
    trait_signals: traitSignals,
    confidence,
    behavior_indicators: behaviorIndicators
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8),
    normalized_score: Number(normalizedScore.toFixed(2)),
  };
};

const heuristicTextInterpretation = ({ answerText = '', trait = 'O' }) => {
  const text = String(answerText || '').toLowerCase();
  const signals = emptyTraitSignals();

  const evidenceHits = ['because', 'data', 'evidence', 'analyze', 'measure'].filter((token) =>
    text.includes(token)
  ).length;
  const teamHits = ['team', 'collaborate', 'stakeholder', 'listen'].filter((token) =>
    text.includes(token)
  ).length;
  const leadershipHits = ['lead', 'ownership', 'drive', 'decide'].filter((token) =>
    text.includes(token)
  ).length;
  const stressHits = ['stress', 'panic', 'uncertain', 'pressure', 'risk'].filter((token) =>
    text.includes(token)
  ).length;

  signals[trait] = clamp(0.35 + text.length / 800, -1, 1);
  signals.C += clamp(evidenceHits * 0.15, 0, 0.6);
  signals.A += clamp(teamHits * 0.12, 0, 0.6);
  signals.E += clamp(leadershipHits * 0.12, 0, 0.6);
  signals.N += clamp(stressHits * 0.1 - 0.2, -0.6, 0.6);

  const centered = Object.values(signals).reduce((sum, value) => sum + Number(value || 0), 0) / TRAITS.length;
  const normalizedScore = clamp(3 + centered * 1.25, 1, 5);

  return {
    trait_signals: signals,
    confidence: clamp(0.45 + text.length / 1400, 0.35, 0.78),
    behavior_indicators: [
      evidenceHits ? 'evidence_oriented_reasoning' : '',
      teamHits ? 'collaboration_reference' : '',
      leadershipHits ? 'ownership_reference' : '',
      stressHits ? 'stress_awareness' : '',
    ].filter(Boolean),
    normalized_score: Number(normalizedScore.toFixed(2)),
  };
};

const interpretTextAnswer = async ({ answerText = '', question = {}, aiProfile = {} } = {}) => {
  const trait = resolveTrait(question);
  const fallback = heuristicTextInterpretation({ answerText, trait });

  if (!config.openaiApiKey) {
    return fallback;
  }

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.2,
      max_output_tokens: 700,
      input: [
        {
          role: 'system',
          content:
            'Analyze short psychometric answers and return strict JSON only with trait signals and confidence.',
        },
        {
          role: 'user',
          content: `Analyze this answer.\n\nReturn:\n\ntrait signals\nconfidence\nbehavior indicators\n\nReturn JSON only:\n{\n  "trait_signals": {"O": -1..1, "C": -1..1, "E": -1..1, "A": -1..1, "N": -1..1},\n  "confidence": 0..1,\n  "behavior_indicators": [""],\n  "normalized_score": 1..5\n}\n\nQuestion context:\n${JSON.stringify(
            {
              question: question?.text || '',
              trait: question?.trait || question?.traitFocus || '',
              facet: question?.facet || question?.traitTarget || '',
              domain: aiProfile?.domain || '',
              skills: (aiProfile?.skills || []).slice(0, 8),
            },
            null,
            2
          )}\n\nAnswer:\n${String(answerText || '').slice(0, 3000)}`,
        },
      ],
    });

    const parsed = parseJsonFromText(extractOutputText(response), 'Text response interpretation invalid');
    return normalizeTextInterpretation(parsed);
  } catch (error) {
    return fallback;
  }
};

const parseAnswerToSignal = async ({ answer = {}, question = {}, aiProfile = {} } = {}) => {
  const type = String(question?.type || answer?.type || '').toLowerCase();

  if (type === 'mcq' || type === 'scenario') {
    return parseMcqResponse({ answer, question });
  }

  if (type === 'scale' || type === 'slider') {
    return parseSliderResponse({ answer, question });
  }

  if (type === 'likert') {
    return parseLikertResponse({ answer, question });
  }

  if (type === 'text') {
    const answerText = String(answer?.value?.text || answer?.value?.example || answer?.value || '').trim();
    return interpretTextAnswer({
      answerText,
      question,
      aiProfile,
    });
  }

  return parseLikertResponse({ answer, question });
};

module.exports = {
  parseAnswerToSignal,
  interpretTextAnswer,
};
