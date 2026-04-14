const TRAITS = ['O', 'C', 'E', 'A', 'N'];
const COGNITIVE_KEYS = ['analytical', 'creative', 'strategic', 'systematic', 'practical', 'abstract'];
const BEHAVIOR_KEYS = ['leadership', 'risk', 'analysis', 'execution', 'collaboration', 'creativity'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const traitLabels = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
};

const normalizeTraitScores = (scores = {}) =>
  TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = clamp(round(scores[trait] || 50), 0, 100);
    return accumulator;
  }, {});

const normalizeVector = (source = {}, keys = []) =>
  (Array.isArray(keys) ? keys : []).reduce((accumulator, key) => {
    accumulator[key] = clamp(round(source[key] || 50), 0, 100);
    return accumulator;
  }, {});

const getDominantTrait = (traits = {}) =>
  TRAITS.reduce((best, trait) =>
    Number(traits[trait] || 0) > Number(traits[best] || 0) ? trait : best,
  'O');

const toZScores = (traits = {}) => {
  const values = TRAITS.map((trait) => Number(traits[trait] || 50));
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
  const stdDev = Math.sqrt(variance) || 1;

  const zScores = {};
  const zNormalized = {};

  TRAITS.forEach((trait) => {
    const value = Number(traits[trait] || 50);
    const z = (value - mean) / stdDev;
    zScores[trait] = Number(z.toFixed(4));
    zNormalized[trait] = clamp(round(50 + z * 12), 0, 100);
  });

  return {
    zScores,
    zNormalized,
  };
};

const buildStrengthsAndWeaknesses = ({ traits = {}, cognitive = {}, behavior = {}, cvData = {} }) => {
  const traitEntries = Object.entries(traits).sort((a, b) => b[1] - a[1]);
  const strongestTraits = traitEntries.slice(0, 2);
  const weakestTraits = traitEntries.slice(-2);

  const topCognitive = Object.entries(cognitive)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 2)
    .map(([key, value]) => `${key.replace(/_/g, ' ')} (${round(value)}%)`);

  const topBehavior = Object.entries(behavior)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 2)
    .map(([key, value]) => `${key.replace(/_/g, ' ')} (${round(value)}%)`);

  const topSkills = (Array.isArray(cvData.skills) ? cvData.skills : [])
    .map((skill) => String(skill?.name || skill || '').trim())
    .filter(Boolean)
    .slice(0, 3);

  const strengths = [
    ...strongestTraits.map(
      ([trait, score]) => `${traitLabels[trait]} (${round(score)}): consistently expressed across your responses.`
    ),
  ];

  if (topCognitive.length) {
    strengths.push(`Cognitive leverage: ${topCognitive.join(', ')}.`);
  }

  if (topBehavior.length) {
    strengths.push(`Behavior leverage: ${topBehavior.join(', ')}.`);
  }

  if (topSkills.length) {
    strengths.push(`CV-aligned strengths: ${topSkills.join(', ')}.`);
  }

  const weaknesses = weakestTraits.map(
    ([trait, score]) =>
      `${traitLabels[trait]} (${round(score)}): this lower zone may limit consistency in high-pressure scenarios.`
  );

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
  };
};

const buildInterpretation = ({ traits = {}, cognitive = {}, behavior = {}, aiProfile = {} }) => {
  const dominantTrait = getDominantTrait(traits);
  const topCognitive = Object.entries(cognitive).sort((a, b) => b[1] - a[1])[0];
  const topBehavior = Object.entries(behavior).sort((a, b) => b[1] - a[1])[0];

  return {
    label: `${traitLabels[dominantTrait]}-Led Profile`,
    score: Number(traits[dominantTrait] || 50),
    summary: `Dominant ${traitLabels[dominantTrait].toLowerCase()} signal with strongest cognitive edge in ${String(
      topCognitive?.[0] || 'analytical'
    ).replace(/_/g, ' ')} and behavioral emphasis on ${String(topBehavior?.[0] || 'execution').replace(/_/g, ' ')}.`,
    best_fit_paths: (Array.isArray(aiProfile?.career_signals) ? aiProfile.career_signals : []).slice(0, 3),
    method: 'ai_trait_vector_aggregation',
  };
};

const evaluatePersonalityProfile = ({
  cvData = {},
  profileVector = {},
  traitVectorOutput = {},
  cognitiveScores = {},
  behaviorVector = {},
} = {}) => {
  const traits = normalizeTraitScores(
    traitVectorOutput?.oceanVector && typeof traitVectorOutput.oceanVector === 'object'
      ? traitVectorOutput.oceanVector
      : {}
  );

  const normalizedTraits = Object.keys(traits).length ? traits : normalizeTraitScores({});

  const cognitive = normalizeVector(
    traitVectorOutput?.cognitiveVector && typeof traitVectorOutput.cognitiveVector === 'object'
      ? traitVectorOutput.cognitiveVector
      : cognitiveScores,
    COGNITIVE_KEYS
  );

  const behavior = normalizeVector(
    traitVectorOutput?.behaviorVector && typeof traitVectorOutput.behaviorVector === 'object'
      ? traitVectorOutput.behaviorVector
      : behaviorVector,
    BEHAVIOR_KEYS
  );

  const z = toZScores(normalizedTraits);

  const { strengths, weaknesses } = buildStrengthsAndWeaknesses({
    traits: normalizedTraits,
    cognitive,
    behavior,
    cvData,
  });

  const interpretation = buildInterpretation({
    traits: normalizedTraits,
    cognitive,
    behavior,
    aiProfile: profileVector?.aiProfile || {},
  });

  const dominantTrait = getDominantTrait(normalizedTraits);

  return {
    personality_type: interpretation.label,
    trait_scores: normalizedTraits,
    trait_z_scores: z.zScores,
    trait_z_normalized: z.zNormalized,
    trait_pre_z_scores: normalizedTraits,
    ocean_normalized: normalizedTraits,
    ocean_counts: TRAITS.reduce((accumulator, trait) => {
      accumulator[trait] = 1;
      return accumulator;
    }, {}),
    ocean_raw: normalizedTraits,
    ocean_min: TRAITS.reduce((accumulator, trait) => {
      accumulator[trait] = 0;
      return accumulator;
    }, {}),
    ocean_max: TRAITS.reduce((accumulator, trait) => {
      accumulator[trait] = 100;
      return accumulator;
    }, {}),
    hybrid_trait_scores: {
      [`${interpretation.label}_fit`]: Number(normalizedTraits[dominantTrait] || 50),
    },
    dominant_strengths: strengths,
    weaknesses,
    interpretation,
    vectors: {
      personalityVector: normalizedTraits,
      cognitiveVector: cognitive,
      behaviorVector: behavior,
    },
    introversion_score: clamp(100 - Number(normalizedTraits.E || 50), 0, 100),
    behavioral_summary: `${interpretation.label} with dominant ${traitLabels[dominantTrait].toLowerCase()} signal.`,
  };
};

module.exports = {
  evaluatePersonalityProfile,
  getDominantTrait,
};
