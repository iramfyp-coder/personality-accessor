const { parseAnswerToSignal } = require('./response-parser.service');
const { TRAITS } = require('./question-coverage.service');

const COGNITIVE_KEYS = ['analytical', 'creative', 'strategic', 'systematic', 'practical', 'abstract'];
const BEHAVIOR_KEYS = ['leadership', 'analysis', 'creativity', 'risk', 'collaboration', 'execution'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const mean = (values = []) => {
  const source = Array.isArray(values) ? values : [];
  if (!source.length) {
    return 0;
  }
  return source.reduce((sum, value) => sum + Number(value || 0), 0) / source.length;
};

const normalizeScoreFromSignal = (value = 0, baseline = 50, scale = 28) =>
  clamp(Math.round(Number(baseline || 50) + Number(value || 0) * Number(scale || 28)), 0, 100);

const resolveTrait = (question = {}, fallback = 'O') => {
  const token = String(question?.traitFocus || question?.trait || fallback)
    .toUpperCase()
    .charAt(0);
  if (TRAITS.includes(token)) {
    return token;
  }
  return fallback;
};

const toFacetKey = (question = {}) =>
  String(question?.facet || question?.traitTarget || '')
    .trim()
    .toLowerCase();

const buildTraitVector = async ({ answers = [], questionPlan = [], aiProfile = {} } = {}) => {
  const byQuestionId = new Map(
    (Array.isArray(questionPlan) ? questionPlan : []).map((question) => [
      String(question?.questionId || question?.id || ''),
      question,
    ])
  );

  const oceanSignals = TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = [];
    return accumulator;
  }, {});

  const facetSignals = {};
  const responseSignals = [];
  const responseConfidence = [];

  const normalizedAnswers = Array.isArray(answers) ? answers : [];

  for (const answer of normalizedAnswers) {
    if (!answer || String(answer.type || '').toLowerCase() === 'behavior') {
      continue;
    }

    const question = byQuestionId.get(String(answer.questionId || '')) || {};

    const parsed = await parseAnswerToSignal({
      answer,
      question,
      aiProfile,
    });

    const traitSignals = parsed?.trait_signals && typeof parsed.trait_signals === 'object'
      ? parsed.trait_signals
      : {};

    TRAITS.forEach((trait) => {
      const signal = clamp(Number(traitSignals?.[trait] || 0), -1, 1);
      oceanSignals[trait].push(signal);
    });

    const facet = toFacetKey(question);
    if (facet) {
      const targetTrait = resolveTrait(question);
      const facetSignal = clamp(Number(traitSignals?.[targetTrait] || 0), -1, 1);
      facetSignals[facet] = [...(facetSignals[facet] || []), facetSignal];
    }

    responseConfidence.push(clamp(Number(parsed?.confidence || 0.55), 0, 1));

    responseSignals.push({
      questionId: String(answer.questionId || ''),
      type: String(question.type || answer.type || '').toLowerCase(),
      trait_signals: traitSignals,
      confidence: clamp(Number(parsed?.confidence || 0.55), 0, 1),
      normalized_score: clamp(Number(parsed?.normalized_score || 3), 1, 5),
      behavior_indicators: Array.isArray(parsed?.behavior_indicators) ? parsed.behavior_indicators : [],
      reasoning_weight: clamp(Number(parsed?.reasoning_weight || question?.reasoningWeight || 0.65), 0.1, 1),
    });
  }

  const oceanVector = TRAITS.reduce((accumulator, trait) => {
    const baseline = 50;
    const signalMean = mean(oceanSignals[trait]);
    accumulator[trait] = normalizeScoreFromSignal(signalMean, baseline, 34);
    return accumulator;
  }, {});

  const facetVector = Object.entries(facetSignals).reduce((accumulator, [facet, values]) => {
    const traitHint = facet.charAt(0).toUpperCase();
    const baseline = TRAITS.includes(traitHint) ? Number(oceanVector[traitHint] || 50) : 50;
    accumulator[facet] = normalizeScoreFromSignal(mean(values), baseline, 20);
    return accumulator;
  }, {});

  const profileBehaviorBaseline = aiProfile?.behavior_signals && typeof aiProfile.behavior_signals === 'object'
    ? aiProfile.behavior_signals
    : {};

  const behaviorVector = {
    leadership: normalizeScoreFromSignal((Number(oceanVector.E || 50) - 50) / 50, Number(profileBehaviorBaseline.leadership || 50), 24),
    analysis: normalizeScoreFromSignal((Number(oceanVector.C || 50) - 50) / 50, Number(profileBehaviorBaseline.analysis || 50), 22),
    creativity: normalizeScoreFromSignal((Number(oceanVector.O || 50) - 50) / 50, Number(profileBehaviorBaseline.creativity || 50), 24),
    risk: normalizeScoreFromSignal((Number(oceanVector.N || 50) - 50) / 50, Number(profileBehaviorBaseline.risk || 50), 20),
    collaboration: normalizeScoreFromSignal((Number(oceanVector.A || 50) - 50) / 50, Number(profileBehaviorBaseline.collaboration || 50), 24),
    execution: normalizeScoreFromSignal((Number(oceanVector.C || 50) - 50) / 50, Number(profileBehaviorBaseline.execution || 50), 26),
  };

  const cognitiveVector = {
    analytical: normalizeScoreFromSignal(((Number(oceanVector.C || 50) - 50) + (Number(oceanVector.O || 50) - 50) * 0.5) / 50, 50, 20),
    creative: normalizeScoreFromSignal((Number(oceanVector.O || 50) - 50) / 50, 50, 24),
    strategic: normalizeScoreFromSignal(((Number(oceanVector.C || 50) - 50) + (Number(oceanVector.E || 50) - 50) * 0.4) / 50, 50, 20),
    systematic: normalizeScoreFromSignal((Number(oceanVector.C || 50) - 50) / 50, 50, 22),
    practical: normalizeScoreFromSignal(((Number(oceanVector.C || 50) - 50) + (Number(oceanVector.A || 50) - 50) * 0.35) / 50, 50, 18),
    abstract: normalizeScoreFromSignal((Number(oceanVector.O || 50) - 50) / 50, 50, 22),
  };

  const coverage = clamp(
    (responseSignals.length || 0) /
      Math.max((Array.isArray(questionPlan) ? questionPlan.length : responseSignals.length) || 1, 1),
    0,
    1
  );

  return {
    oceanVector,
    facetVector,
    behaviorVector,
    cognitiveVector,
    responseSignals,
    responseConfidence: Number(mean(responseConfidence).toFixed(4)),
    coverage: Number(coverage.toFixed(4)),
    dimensions: {
      traits: TRAITS,
      behavior: BEHAVIOR_KEYS,
      cognitive: COGNITIVE_KEYS,
    },
  };
};

module.exports = {
  buildTraitVector,
  COGNITIVE_KEYS,
  BEHAVIOR_KEYS,
};
