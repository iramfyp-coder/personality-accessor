const { TRAITS } = require('./scoringEngine');

const TRAIT_LABELS = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
};

const clampScore = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const normalizeTraits = (traits = {}) => ({
  O: clampScore(traits.O),
  C: clampScore(traits.C),
  E: clampScore(traits.E),
  A: clampScore(traits.A),
  N: clampScore(traits.N),
});

const scoreBand = (score) => {
  if (score >= 70) {
    return 'high';
  }

  if (score <= 35) {
    return 'low';
  }

  return 'moderate';
};

const getDominantTrait = (traits) =>
  TRAITS.reduce((bestTrait, currentTrait) =>
    traits[currentTrait] > traits[bestTrait] ? currentTrait : bestTrait
  , TRAITS[0]);

const buildDominantTraitExplanation = (traits, dominantTrait) => {
  const score = traits[dominantTrait];
  const band = scoreBand(score);

  const byTrait = {
    O: {
      high: 'You gravitate toward experimentation, abstract thinking, and novel approaches. New problems energize you, especially when there is room to explore different models.',
      moderate: 'You balance imagination with practicality. You can explore new options while still valuing proven structures when stakes are high.',
      low: 'You prefer proven methods and familiar workflows. Reliability tends to matter more to you than experimentation.',
    },
    C: {
      high: 'You are naturally execution-driven: planning, prioritization, and consistency are core strengths. You likely create order quickly when work is ambiguous.',
      moderate: 'You show flexible discipline. You can organize work when needed while still adapting to changing priorities.',
      low: 'You may resist rigid structure and can struggle with consistency under pressure. External accountability systems can sharply improve performance.',
    },
    E: {
      high: 'You gain momentum from interaction, visibility, and rapid communication loops. Collaborative settings likely amplify your performance.',
      moderate: 'You can perform well in both independent and collaborative contexts. You adapt communication intensity based on the environment.',
      low: 'You tend to process deeply before speaking and may prefer asynchronous or small-group communication over high-volume social settings.',
    },
    A: {
      high: 'You are trust-building and cooperative, often prioritizing group cohesion and fairness. People likely experience you as supportive and constructive.',
      moderate: 'You can collaborate while maintaining boundaries. You balance harmony with practical decision-making.',
      low: 'You are direct and skeptical, with a high bar for agreement. This can improve rigor, but may require intentional tone management in cross-functional settings.',
    },
    N: {
      high: 'You are highly sensitive to risk and pressure signals. This can improve foresight, but unmanaged stress may reduce consistency and confidence.',
      moderate: 'You generally stay composed while still noticing important risks. You recover reasonably well from uncertainty and setbacks.',
      low: 'You are emotionally steady under pressure and less reactive to volatility. This supports calm decision-making during disruption.',
    },
  };

  return byTrait[dominantTrait][band];
};

const buildRiskSignals = (traits) => {
  const riskSignals = [];

  if (traits.N >= 70) {
    riskSignals.push(
      'High stress sensitivity may lead to over-indexing on worst-case scenarios during ambiguous work.'
    );
  }

  if (traits.C <= 35) {
    riskSignals.push(
      'Low structure preference may create inconsistency in follow-through without explicit routines and deadlines.'
    );
  }

  if (traits.A <= 30) {
    riskSignals.push(
      'Low agreeableness can increase conflict friction in feedback-heavy or consensus-driven teams.'
    );
  }

  if (traits.E <= 30) {
    riskSignals.push(
      'Low visibility in group settings can hide your contributions, especially in fast verbal environments.'
    );
  }

  if (traits.O <= 35) {
    riskSignals.push(
      'Preference for familiar methods can slow adaptation when strategy requires experimentation.'
    );
  }

  if (traits.O >= 75 && traits.C <= 40) {
    riskSignals.push(
      'A strong idea-generation profile with lower execution structure can cause an ideation-to-delivery gap.'
    );
  }

  if (traits.E >= 75 && traits.A <= 40) {
    riskSignals.push(
      'High assertiveness combined with low cooperativeness can be perceived as combative in cross-team decisions.'
    );
  }

  if (traits.C >= 80 && traits.O <= 35) {
    riskSignals.push(
      'Very high order with low novelty preference may produce rigidity in rapidly changing environments.'
    );
  }

  if (riskSignals.length === 0) {
    riskSignals.push(
      'No severe personality risk signal detected. Main opportunity is maintaining balance as context and workload shift.'
    );
  }

  return riskSignals;
};

const buildBehavioralPatterns = (traits) => {
  const patterns = [];

  if (traits.C >= 70 && traits.N <= 40) {
    patterns.push(
      'Stable executor pattern: you tend to remain composed while maintaining strong delivery discipline.'
    );
  }

  if (traits.O >= 70 && traits.E >= 60) {
    patterns.push(
      'Innovation driver pattern: you likely introduce ideas quickly and socialize them with energy.'
    );
  }

  if (traits.A >= 65 && traits.C >= 65) {
    patterns.push(
      'Collaborative operator pattern: you pair reliability with relationship sensitivity, which supports trust-based execution.'
    );
  }

  if (traits.N >= 65 && traits.C <= 45) {
    patterns.push(
      'Worry-to-action gap pattern: stress signals may outpace execution rhythm unless work is chunked into small commitments.'
    );
  }

  if (traits.E <= 40 && traits.O >= 60) {
    patterns.push(
      'Reflective strategist pattern: you likely produce strong ideas in independent deep-focus settings.'
    );
  }

  if (patterns.length === 0) {
    patterns.push(
      'Balanced profile pattern: your traits are relatively even, suggesting adaptive behavior across varying team contexts.'
    );
  }

  return patterns;
};

const generateInsightSnapshot = (traits = {}) => {
  const normalizedTraits = normalizeTraits(traits);
  const dominantTrait = getDominantTrait(normalizedTraits);

  return {
    dominantTrait,
    dominantTraitLabel: TRAIT_LABELS[dominantTrait],
    dominantTraitExplanation: buildDominantTraitExplanation(
      normalizedTraits,
      dominantTrait
    ),
    riskSignals: buildRiskSignals(normalizedTraits),
    behavioralPatterns: buildBehavioralPatterns(normalizedTraits),
  };
};

module.exports = {
  TRAIT_LABELS,
  normalizeTraits,
  getDominantTrait,
  generateInsightSnapshot,
};
