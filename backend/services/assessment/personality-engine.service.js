const TRAITS = ['O', 'C', 'E', 'A', 'N'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const normalizeTraitScores = (scores = {}) =>
  TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = clamp(round(scores[trait] || 0), 0, 100);
    return accumulator;
  }, {});

const zScoreNormalizeTraits = (scores = {}) => {
  const raw = normalizeTraitScores(scores);
  const values = TRAITS.map((trait) => Number(raw[trait] || 50));
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
  const stdDev = Math.sqrt(variance);
  const safeStdDev = stdDev > 0.001 ? stdDev : 1;

  const zScores = {};
  const zNormalized = {};
  const blended = {};

  TRAITS.forEach((trait) => {
    const value = Number(raw[trait] || 50);
    const z = (value - mean) / safeStdDev;
    const zScaled = clamp(50 + z * 12, 0, 100);

    zScores[trait] = Number(z.toFixed(4));
    zNormalized[trait] = round(zScaled);
    blended[trait] = clamp(round(zScaled * 0.72 + value * 0.28), 0, 100);
  });

  return {
    traits: normalizeTraitScores(blended),
    zScores,
    zNormalized: normalizeTraitScores(zNormalized),
  };
};

const traitLabels = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
};

const getDominantTrait = (traits = {}) =>
  TRAITS.reduce((best, trait) => (traits[trait] > traits[best] ? trait : best), 'O');

const toAnswerScore = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, 1, 5);
  }

  if (value && typeof value === 'object') {
    const candidate = Number(value.normalizedScore || value.score || value.weight);
    return Number.isFinite(candidate) ? clamp(candidate, 1, 5) : 3;
  }

  return 3;
};

const resolveTraitFromQuestion = (question = {}) => {
  const explicit = String(question.traitFocus || '').toUpperCase().charAt(0);
  if (TRAITS.includes(explicit)) {
    return explicit;
  }

  const traitToken = String(question.traitTarget || question.trait || '')
    .toLowerCase()
    .trim();

  if (traitToken.includes('social') || traitToken.includes('leader')) {
    return 'E';
  }

  if (traitToken.includes('stress') || traitToken.includes('risk')) {
    return 'N';
  }

  if (traitToken.includes('team') || traitToken.includes('conflict')) {
    return 'A';
  }

  if (traitToken.includes('plan') || traitToken.includes('system') || traitToken.includes('analytic')) {
    return 'C';
  }

  return 'O';
};

const calculateOceanFromAnswers = ({ answers = [], questionPlan = [] }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const totals = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  const counts = { O: 0, C: 0, E: 0, A: 0, N: 0 };

  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    const question = byQuestionId.get(answer.questionId);
    if (!question) {
      return;
    }

    if (String(answer.type || '').toLowerCase() === 'behavior') {
      return;
    }

    const trait = resolveTraitFromQuestion(question);
    const score = toAnswerScore(answer.value || answer.metadata);

    totals[trait] += score;
    counts[trait] += 1;
  });

  const normalized = TRAITS.reduce((accumulator, trait) => {
    const maxScore = counts[trait] * 5;

    if (!maxScore) {
      accumulator[trait] = 50;
      return accumulator;
    }

    accumulator[trait] = clamp(Math.round((totals[trait] / maxScore) * 100), 0, 100);
    return accumulator;
  }, {});

  return {
    normalized,
    counts,
  };
};

const baseTraitInfluenceFromCv = (cvData = {}, profileVector = {}) => {
  const base = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  const categories = profileVector.skillDominance || {};

  const add = (trait, amount) => {
    base[trait] = clamp(base[trait] + amount, -18, 18);
  };

  if ((categories.frontend || 0) + (categories.design || 0) >= 8) {
    add('O', 6);
    add('E', 2);
  }

  if ((categories.backend || 0) + (categories.cloud_devops || 0) >= 9) {
    add('C', 8);
    add('O', 2);
  }

  if ((categories.ai_ml || 0) + (categories.data || 0) >= 8) {
    add('O', 7);
    add('C', 4);
  }

  if (categories.soft_skills >= 7) {
    add('A', 6);
    add('E', 5);
  }

  if ((profileVector.educationStrength || 0) >= 70) {
    add('C', 4);
  }

  if ((profileVector.yearsOfExperience || 0) >= 5) {
    add('N', -5);
    add('C', 3);
  }

  if ((cvData.interests || []).length >= 5) {
    add('O', 3);
  }

  return base;
};

const traitAdjustmentsFromBehavior = (behavior = {}, behaviorVector = {}) => {
  const deltas = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  const emotional = String(behavior.emotional_stability || '').toLowerCase();
  const confidence = String(behavior.confidence_level || '').toLowerCase();
  const decision = String(behavior.decision_style || '').toLowerCase();
  const risk = String(behavior.risk_tendency || '').toLowerCase();

  if (emotional.includes('stable')) {
    deltas.N -= 7;
    deltas.C += 2;
  }

  if (emotional.includes('reactive')) {
    deltas.N += 7;
  }

  if (confidence.includes('high')) {
    deltas.E += 6;
  } else if (confidence.includes('moderate')) {
    deltas.E += 2;
  }

  if (decision.includes('evidence')) {
    deltas.C += 4;
    deltas.O += 2;
  }

  if (decision.includes('collaborative')) {
    deltas.A += 4;
    deltas.E += 2;
  }

  if (risk.includes('calculated')) {
    deltas.O += 3;
    deltas.N -= 2;
  }

  if (risk.includes('risk-averse')) {
    deltas.N += 2;
    deltas.O -= 1;
  }

  const leadershipSignal = Number(behaviorVector.leadership || 50);
  const stressSignal = Number(behaviorVector.stress_tolerance || 50);
  const teamSignal = Number(behaviorVector.team_preference || 50);

  deltas.E += (leadershipSignal - 50) / 18;
  deltas.N -= (stressSignal - 50) / 20;
  deltas.A += (teamSignal - 50) / 20;

  return deltas;
};

const mergeTraitSignals = (...signals) => {
  const merged = { O: 0, C: 0, E: 0, A: 0, N: 0 };

  signals.forEach((signal) => {
    TRAITS.forEach((trait) => {
      merged[trait] += Number(signal?.[trait] || 0);
    });
  });

  return merged;
};

const scaleTraitSignal = (signal = {}, multiplier = 1) =>
  TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = Number(signal?.[trait] || 0) * Number(multiplier || 1);
    return accumulator;
  }, {});

const applyDeltas = (base, delta) => {
  const next = {};

  TRAITS.forEach((trait) => {
    next[trait] = clamp(Number(base[trait] || 50) + Number(delta[trait] || 0), 0, 100);
  });

  return normalizeTraitScores(next);
};

const toHybridArchetypeScores = ({ traits, cognitiveScores = {}, behaviorVector = {}, profileVector = {} }) => {
  const technicalSignal =
    Number(profileVector?.skillDominance?.backend || 0) +
    Number(profileVector?.skillDominance?.frontend || 0) +
    Number(profileVector?.skillDominance?.cloud_devops || 0);

  const creativeSignal = Number(cognitiveScores.creative || 50);
  const strategicSignal = Number(cognitiveScores.strategic || 50);
  const analyticalSignal = Number(cognitiveScores.analytical || 50);
  const leadershipSignal = Number(behaviorVector.leadership || 50);

  const scores = {
    Analytical:
      traits.C * 0.32 +
      traits.O * 0.2 +
      (100 - traits.N) * 0.2 +
      analyticalSignal * 0.2 +
      clamp(technicalSignal * 2, 0, 15),
    Creative: traits.O * 0.35 + traits.E * 0.15 + traits.A * 0.1 + creativeSignal * 0.35,
    Leadership: traits.E * 0.3 + traits.C * 0.2 + traits.A * 0.15 + leadershipSignal * 0.25 + strategicSignal * 0.1,
    Strategic: traits.C * 0.2 + traits.O * 0.2 + traits.E * 0.15 + strategicSignal * 0.45,
    Technical_Builder: traits.C * 0.32 + traits.O * 0.2 + (100 - traits.N) * 0.18 + analyticalSignal * 0.2,
  };

  return Object.entries(scores).reduce((accumulator, [key, value]) => {
    accumulator[key] = clamp(round(value), 0, 100);
    return accumulator;
  }, {});
};

const buildInterpretation = ({
  traits = {},
  traitZScores = {},
  cognitiveScores = {},
  behaviorVector = {},
}) => {
  const introversionScore = clamp(100 - Number(traits.E || 50), 0, 100);
  const analytical = Number(cognitiveScores.analytical || 50);
  const creative = Number(cognitiveScores.creative || 50);
  const strategic = Number(cognitiveScores.strategic || 50);
  const systematic = Number(cognitiveScores.systematic || 50);
  const leadership = Number(behaviorVector.leadership || 50);
  const teamPreference = Number(behaviorVector.team_preference || 50);
  const stability = Number(behaviorVector.stress_tolerance || 50);
  const zE = Number(traitZScores.E || 0);
  const zC = Number(traitZScores.C || 0);
  const zO = Number(traitZScores.O || 0);

  const profileCandidates = [
    {
      label: 'Logical Researcher',
      score:
        analytical * 0.36 +
        introversionScore * 0.2 +
        traits.C * 0.18 +
        (100 - traits.N) * 0.16 +
        stability * 0.1,
      summary:
        'Strong analytical depth with focused independent execution suggests high-quality evidence-led reasoning.',
      best_fit_paths: ['Research-heavy engineering', 'Data science', 'R&D and experimentation'],
    },
    {
      label: 'Social Leader',
      score:
        leadership * 0.28 +
        traits.E * 0.24 +
        teamPreference * 0.14 +
        traits.A * 0.14 +
        strategic * 0.1 +
        traits.C * 0.1 +
        (zE > 0.4 ? 2 : -2),
      summary:
        'Influence, communication, and directional clarity indicate strong cross-team mobilization potential.',
      best_fit_paths: ['Product leadership', 'Program management', 'Business-facing technical roles'],
    },
    {
      label: 'Creative Strategist',
      score: creative * 0.34 + strategic * 0.28 + traits.O * 0.22 + traits.E * 0.08 + traits.C * 0.08,
      summary:
        'Creative ideation combined with strategic framing suggests strong innovation direction and scenario planning.',
      best_fit_paths: ['Product strategy', 'UX innovation', 'Growth experimentation'],
    },
    {
      label: 'Technical Architect',
      score: systematic * 0.32 + analytical * 0.26 + traits.C * 0.22 + (100 - traits.N) * 0.12 + traits.O * 0.08,
      summary:
        'Systematic cognition and analytical discipline indicate strong architecture and reliability-oriented execution.',
      best_fit_paths: ['Backend engineering', 'Platform architecture', 'DevOps and reliability'],
    },
    {
      label: 'Analytical Builder',
      score:
        analytical * 0.28 +
        traits.C * 0.28 +
        strategic * 0.14 +
        stability * 0.14 +
        traits.O * 0.08 +
        (zC > 0.35 ? 2 : 0),
      summary:
        'Balanced analysis and execution suggest dependable delivery through structured decomposition and follow-through.',
      best_fit_paths: ['Engineering execution roles', 'Operations analytics', 'Technical consulting'],
    },
    {
      label: 'Balanced Operator',
      score:
        ((traits.O + traits.C + traits.E + traits.A + (100 - Math.abs(50 - traits.N))) / 5) * 0.68 +
        (strategic + stability + teamPreference) * 0.106,
      summary:
        'Adaptable and steady profile with balanced technical, interpersonal, and decision behavior across contexts.',
      best_fit_paths: ['Generalist software roles', 'Cross-functional execution', 'Business analysis'],
    },
  ];

  profileCandidates.sort((a, b) => b.score - a.score);
  const top = profileCandidates[0];
  const margin = Number(top?.score || 0) - Number(profileCandidates[1]?.score || 0);

  if (margin < 1.6 && top?.label !== 'Balanced Operator') {
    return profileCandidates.find((item) => item.label === 'Balanced Operator') || top;
  }

  return top;
};

const buildStrengthsAndWeaknesses = (traits, profileVector) => {
  const traitEntries = Object.entries(traits).sort((a, b) => b[1] - a[1]);
  const strongest = traitEntries.slice(0, 2);
  const lowest = traitEntries.slice(-2);

  const strengths = strongest.map(
    ([trait, score]) => `${traitLabels[trait]} (${score}): consistently visible in your assessment behavior.`
  );

  const topCategories = Object.entries(profileVector.skillDominance || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => category.replace(/_/g, ' '));

  if (topCategories.length > 0) {
    strengths.push(`Skill momentum: strongest practical traction in ${topCategories.join(' and ')}.`);
  }

  const weaknesses = lowest.map(
    ([trait, score]) => `${traitLabels[trait]} (${score}): this area may need intentional practice to balance performance.`
  );

  if (traits.N >= 70) {
    weaknesses.push('Stress reactivity is elevated; build recovery rituals and structured decompression.');
  }

  if (traits.C <= 40) {
    weaknesses.push('Execution consistency is below target; add clear milestone planning and accountability loops.');
  }

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
  };
};

const buildBehavioralSummary = ({ traits, behaviorAnalysis = {}, interpretation, behaviorVector = {} }) => {
  const dominantTrait = getDominantTrait(traits);

  return `${interpretation.label} profile with ${traitLabels[dominantTrait].toLowerCase()} as dominant trait. Decision style appears ${String(
    behaviorAnalysis?.decision_style || 'balanced'
  ).toLowerCase()}, confidence is ${String(behaviorAnalysis?.confidence_level || 'moderate').toLowerCase()}, and leadership signal is ${Math.round(
    Number(behaviorVector.leadership || 50)
  )}/100.`;
};

const evaluatePersonalityProfile = ({
  cvData = {},
  profileVector = {},
  questionPlan = [],
  answers = [],
  behaviorAnalysis = {},
  cognitiveScores = {},
  behaviorVector = {},
}) => {
  const ocean = calculateOceanFromAnswers({ answers, questionPlan });
  const cvDeltas = scaleTraitSignal(baseTraitInfluenceFromCv(cvData, profileVector), 0.34);
  const behaviorDeltas = scaleTraitSignal(
    traitAdjustmentsFromBehavior(behaviorAnalysis, behaviorVector),
    0.88
  );
  const blendedRawTraits = applyDeltas(ocean.normalized, mergeTraitSignals(cvDeltas, behaviorDeltas));
  const zNormalization = zScoreNormalizeTraits(blendedRawTraits);
  const traits = zNormalization.traits;

  const interpretation = buildInterpretation({
    traits,
    traitZScores: zNormalization.zScores,
    cognitiveScores,
    behaviorVector,
  });

  const archetypeScores = toHybridArchetypeScores({
    traits,
    cognitiveScores,
    behaviorVector,
    profileVector,
  });

  const { strengths, weaknesses } = buildStrengthsAndWeaknesses(traits, profileVector);

  return {
    personality_type: interpretation.label,
    trait_scores: traits,
    trait_z_scores: zNormalization.zScores,
    trait_z_normalized: zNormalization.zNormalized,
    trait_pre_z_scores: blendedRawTraits,
    ocean_normalized: ocean.normalized,
    ocean_counts: ocean.counts,
    hybrid_trait_scores: archetypeScores,
    dominant_strengths: strengths,
    weaknesses,
    interpretation,
    introversion_score: clamp(100 - Number(traits.E || 50), 0, 100),
    behavioral_summary: buildBehavioralSummary({
      traits,
      behaviorAnalysis,
      interpretation,
      behaviorVector,
    }),
  };
};

module.exports = {
  evaluatePersonalityProfile,
  getDominantTrait,
};
