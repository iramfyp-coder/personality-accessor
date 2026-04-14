const TRAITS = ['O', 'C', 'E', 'A', 'N'];
const COGNITIVE_KEYS = ['analytical', 'creative', 'strategic', 'systematic', 'practical', 'abstract'];
const BEHAVIOR_KEYS = ['leadership', 'risk_tolerance', 'decision_speed', 'stress_tolerance', 'team_preference'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const traitLabels = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
};

const ARCHETYPE_PROFILES = [
  {
    label: 'Analytical Builder',
    personality: { O: 72, C: 84, E: 46, A: 54, N: 28 },
    cognitive: {
      analytical: 86,
      creative: 56,
      strategic: 72,
      systematic: 84,
      practical: 78,
      abstract: 68,
    },
    behavior: {
      leadership: 58,
      risk_tolerance: 56,
      decision_speed: 68,
      stress_tolerance: 78,
      team_preference: 56,
    },
    summary:
      'Strong analytical structure plus reliable execution. You usually break complex work into solvable units and ship with consistency.',
    best_fit_paths: ['Engineering execution', 'Systems analysis', 'Technical consulting'],
  },
  {
    label: 'Technical Specialist',
    personality: { O: 64, C: 88, E: 36, A: 46, N: 26 },
    cognitive: {
      analytical: 88,
      creative: 45,
      strategic: 62,
      systematic: 90,
      practical: 82,
      abstract: 60,
    },
    behavior: {
      leadership: 42,
      risk_tolerance: 54,
      decision_speed: 66,
      stress_tolerance: 82,
      team_preference: 48,
    },
    summary:
      'Deep technical precision, high standards, and strong reliability focus. You thrive where domain mastery matters most.',
    best_fit_paths: ['Core engineering', 'Infrastructure', 'Specialist technical tracks'],
  },
  {
    label: 'Strategic Thinker',
    personality: { O: 74, C: 76, E: 58, A: 52, N: 32 },
    cognitive: {
      analytical: 78,
      creative: 64,
      strategic: 90,
      systematic: 68,
      practical: 62,
      abstract: 80,
    },
    behavior: {
      leadership: 72,
      risk_tolerance: 62,
      decision_speed: 72,
      stress_tolerance: 70,
      team_preference: 58,
    },
    summary:
      'Long-range framing and tradeoff clarity are core strengths. You naturally optimize for leverage, sequencing, and outcomes.',
    best_fit_paths: ['Strategy roles', 'Product direction', 'Program planning'],
  },
  {
    label: 'Creative Explorer',
    personality: { O: 88, C: 52, E: 62, A: 58, N: 40 },
    cognitive: {
      analytical: 58,
      creative: 92,
      strategic: 70,
      systematic: 46,
      practical: 54,
      abstract: 86,
    },
    behavior: {
      leadership: 60,
      risk_tolerance: 70,
      decision_speed: 56,
      stress_tolerance: 60,
      team_preference: 62,
    },
    summary:
      'High idea velocity and experimentation drive your best work. You excel in ambiguous environments requiring novelty and reframing.',
    best_fit_paths: ['Innovation', 'Design and concept work', 'Exploratory R&D'],
  },
  {
    label: 'Social Leader',
    personality: { O: 66, C: 72, E: 88, A: 78, N: 34 },
    cognitive: {
      analytical: 58,
      creative: 62,
      strategic: 78,
      systematic: 60,
      practical: 76,
      abstract: 54,
    },
    behavior: {
      leadership: 90,
      risk_tolerance: 58,
      decision_speed: 70,
      stress_tolerance: 66,
      team_preference: 88,
    },
    summary:
      'You mobilize people effectively through communication, direction, and alignment. Team momentum is a key lever in your decision process.',
    best_fit_paths: ['Team leadership', 'Client-facing roles', 'Cross-functional coordination'],
  },
  {
    label: 'Independent Problem Solver',
    personality: { O: 76, C: 82, E: 34, A: 44, N: 30 },
    cognitive: {
      analytical: 84,
      creative: 58,
      strategic: 64,
      systematic: 76,
      practical: 72,
      abstract: 74,
    },
    behavior: {
      leadership: 44,
      risk_tolerance: 64,
      decision_speed: 76,
      stress_tolerance: 74,
      team_preference: 40,
    },
    summary:
      'You handle difficult problems with autonomy and strong reasoning depth. Independent execution under uncertainty is a recurring strength.',
    best_fit_paths: ['Individual contributor tracks', 'Technical investigations', 'Complex troubleshooting'],
  },
  {
    label: 'Systematic Operator',
    personality: { O: 52, C: 90, E: 42, A: 62, N: 28 },
    cognitive: {
      analytical: 78,
      creative: 42,
      strategic: 66,
      systematic: 92,
      practical: 84,
      abstract: 48,
    },
    behavior: {
      leadership: 56,
      risk_tolerance: 46,
      decision_speed: 68,
      stress_tolerance: 82,
      team_preference: 64,
    },
    summary:
      'Process control, quality discipline, and operational consistency are standout strengths in your profile.',
    best_fit_paths: ['Operations', 'Quality and reliability', 'Process-heavy engineering'],
  },
  {
    label: 'Adaptive Generalist',
    personality: { O: 68, C: 68, E: 64, A: 66, N: 36 },
    cognitive: {
      analytical: 70,
      creative: 70,
      strategic: 70,
      systematic: 68,
      practical: 70,
      abstract: 68,
    },
    behavior: {
      leadership: 68,
      risk_tolerance: 60,
      decision_speed: 66,
      stress_tolerance: 70,
      team_preference: 70,
    },
    summary:
      'Balanced multi-domain adaptability. You shift effectively between exploration, execution, and collaboration as context changes.',
    best_fit_paths: ['Generalist roles', 'Hybrid product-technical work', 'Cross-functional programs'],
  },
];

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

const getDominantTrait = (traits = {}) =>
  TRAITS.reduce((best, trait) => (Number(traits[trait] || 0) > Number(traits[best] || 0) ? trait : best), 'O');

const toAnswerType = (answer = {}, question = {}) =>
  String(question.type || answer.type || '').toLowerCase();

const toFivePointScore = ({ answer = {}, question = {} }) => {
  const type = toAnswerType(answer, question);

  if (type === 'scale') {
    const raw = Number(answer?.value);
    const min = Number(question?.scaleMin || answer?.metadata?.scaleMin || 1);
    const max = Number(question?.scaleMax || answer?.metadata?.scaleMax || 10);

    if (Number.isFinite(raw) && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return clamp(((raw - min) / (max - min)) * 4 + 1, 1, 5);
    }

    return 3;
  }

  if (typeof answer?.value === 'number' && Number.isFinite(answer.value)) {
    return clamp(Number(answer.value), 1, 5);
  }

  if (answer?.value && typeof answer.value === 'object') {
    const candidate = Number(
      answer.value.normalizedScore ??
        answer.metadata?.normalizedScore ??
        answer.value.score ??
        answer.value.weight
    );

    return Number.isFinite(candidate) ? clamp(candidate, 1, 5) : 3;
  }

  if (Number.isFinite(Number(answer?.metadata?.normalizedScore))) {
    return clamp(Number(answer.metadata.normalizedScore), 1, 5);
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

  if (traitToken.includes('stress') || traitToken.includes('risk') || traitToken.includes('uncertain')) {
    return 'N';
  }

  if (traitToken.includes('team') || traitToken.includes('conflict') || traitToken.includes('empathy')) {
    return 'A';
  }

  if (traitToken.includes('plan') || traitToken.includes('system') || traitToken.includes('analytic')) {
    return 'C';
  }

  return 'O';
};

const toIntentToken = (question = {}, answer = {}) =>
  String(question.intentTag || question.intent || answer?.metadata?.intentTag || answer?.metadata?.intent || '')
    .toLowerCase()
    .trim();

const rotateTraits = (startTrait = 'O') => {
  const base = ['O', 'C', 'A', 'E', 'N'];
  const index = Math.max(base.indexOf(startTrait), 0);
  return [...base.slice(index), ...base.slice(0, index)];
};

const emptyTraitVector = () => ({ O: 0, C: 0, E: 0, A: 0, N: 0 });

const optionLabelTraitHints = (label = '') => {
  const token = String(label || '').toLowerCase();
  const hints = emptyTraitVector();

  if (/lead|initiate|decide|assert/.test(token)) {
    hints.E += 1;
  }

  if (/analy|document|evidence|debug|recalculate|plan|system/.test(token)) {
    hints.C += 1;
  }

  if (/consult|team|collabor|listen|cooperate|delegate/.test(token)) {
    hints.A += 1;
  }

  if (/innov|idea|explore|experiment|prototype|creative/.test(token)) {
    hints.O += 1;
  }

  if (/wait|delay|clarity|avoid|safe|risk-averse|postpone/.test(token)) {
    hints.N += 1;
  }

  return hints;
};

const buildMcqOptionTraitMap = ({ question = {}, answer = {} }) => {
  const options = Array.isArray(question.options) ? question.options : [];
  const focus = resolveTraitFromQuestion(question);
  const rotated = rotateTraits(focus);
  const intent = toIntentToken(question, answer);

  const defaultMap = options.reduce((accumulator, option, index) => {
    const optionId = String(option?.id || '').trim();
    if (!optionId) {
      return accumulator;
    }

    const traits = emptyTraitVector();
    const primary = rotated[index % rotated.length] || 'O';
    traits[primary] += 2;

    if (index === 0) {
      traits[focus] += 1;
    }

    const labelHints = optionLabelTraitHints(option?.label || '');
    TRAITS.forEach((trait) => {
      traits[trait] += labelHints[trait];
    });

    if (intent.includes('risk') || intent.includes('stress') || intent.includes('uncertain')) {
      if (/wait|delay|avoid|safe|clarity/.test(String(option?.label || '').toLowerCase()) || index === 3) {
        traits.N += 2;
      }
    }

    accumulator[optionId] = traits;
    return accumulator;
  }, {});

  return defaultMap;
};

const applyContribution = ({ totals, minTotals, maxTotals, contribution }) => {
  TRAITS.forEach((trait) => {
    const value = Number(contribution?.[trait] || 0);
    totals[trait] += value;
  });

  TRAITS.forEach((trait) => {
    const value = Number(contribution?.[trait] || 0);
    minTotals[trait] += Math.min(value, 0);
    maxTotals[trait] += Math.max(value, 0);
  });
};

const applyRangeForSingleTrait = ({ totals, minTotals, maxTotals, trait, value, min = -2, max = 2 }) => {
  totals[trait] += Number(value || 0);
  minTotals[trait] += Number(min || 0);
  maxTotals[trait] += Number(max || 0);
};

const calculateOceanFromAnswers = ({ answers = [], questionPlan = [] }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const totals = emptyTraitVector();
  const minTotals = emptyTraitVector();
  const maxTotals = emptyTraitVector();
  const counts = emptyTraitVector();

  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    const question = byQuestionId.get(answer.questionId);
    if (!question) {
      return;
    }

    const type = toAnswerType(answer, question);
    if (type === 'behavior') {
      return;
    }

    const focusTrait = resolveTraitFromQuestion(question);

    if (type === 'likert' || type === 'scale') {
      const fivePoint = toFivePointScore({ answer, question });
      const centered = fivePoint - 3;
      applyRangeForSingleTrait({
        totals,
        minTotals,
        maxTotals,
        trait: focusTrait,
        value: centered,
        min: -2,
        max: 2,
      });
      counts[focusTrait] += 1;
      return;
    }

    if (type === 'mcq' || type === 'scenario') {
      const optionMap = buildMcqOptionTraitMap({ question, answer });
      const selectedId = String(answer?.value?.optionId || '').trim();
      const selected = optionMap[selectedId] || emptyTraitVector();

      applyContribution({
        totals,
        minTotals,
        maxTotals,
        contribution: selected,
      });

      const options = Array.isArray(question.options) ? question.options : [];
      TRAITS.forEach((trait) => {
        const values = options.map((option) => Number(optionMap[String(option?.id || '').trim()]?.[trait] || 0));
        if (!values.length) {
          return;
        }

        minTotals[trait] += Math.min(...values);
        maxTotals[trait] += Math.max(...values);
      });

      TRAITS.forEach((trait) => {
        if (selected[trait] !== 0) {
          counts[trait] += 1;
        }
      });

      return;
    }

    if (type === 'text') {
      const analysisSignals =
        answer?.metadata?.analysis && typeof answer.metadata.analysis === 'object'
          ? answer.metadata.analysis.trait_signals || answer.metadata.analysis.traitSignals || {}
          : {};

      const hasSignals = TRAITS.some((trait) => Number.isFinite(Number(analysisSignals?.[trait])));

      if (hasSignals) {
        TRAITS.forEach((trait) => {
          const signal = clamp(Number(analysisSignals?.[trait] || 0), -1, 1);
          applyRangeForSingleTrait({
            totals,
            minTotals,
            maxTotals,
            trait,
            value: signal * 2,
            min: -2,
            max: 2,
          });
          counts[trait] += 1;
        });
      } else {
        const centered = toFivePointScore({ answer, question }) - 3;
        applyRangeForSingleTrait({
          totals,
          minTotals,
          maxTotals,
          trait: focusTrait,
          value: centered,
          min: -2,
          max: 2,
        });
        counts[focusTrait] += 1;
      }
    }
  });

  const normalized = TRAITS.reduce((accumulator, trait) => {
    const minValue = Number(minTotals[trait] || 0);
    const maxValue = Number(maxTotals[trait] || 0);
    const current = Number(totals[trait] || 0);

    if (Math.abs(maxValue - minValue) < 0.0001) {
      accumulator[trait] = 50;
      return accumulator;
    }

    const normalizedScore = ((current - minValue) / (maxValue - minValue)) * 100;
    accumulator[trait] = clamp(round(normalizedScore), 0, 100);
    return accumulator;
  }, {});

  return {
    normalized,
    counts,
    raw: totals,
    min: minTotals,
    max: maxTotals,
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

  if ((categories.hardware || 0) + (categories.electrical || 0) >= 7) {
    add('C', 6);
    add('O', 3);
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

const toProfileVectorBundle = ({ traits = {}, cognitiveScores = {}, behaviorVector = {} }) => {
  const personalityVector = TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = clamp(Number(traits[trait] || 50), 0, 100);
    return accumulator;
  }, {});

  const cognitiveVector = COGNITIVE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = clamp(Number(cognitiveScores[key] || 50), 0, 100);
    return accumulator;
  }, {});

  const behaviorVectorNormalized = BEHAVIOR_KEYS.reduce((accumulator, key) => {
    accumulator[key] = clamp(Number(behaviorVector[key] || 50), 0, 100);
    return accumulator;
  }, {});

  return {
    personalityVector,
    cognitiveVector,
    behaviorVector: behaviorVectorNormalized,
  };
};

const toCombinedVector = ({ personalityVector = {}, cognitiveVector = {}, behaviorVector = {} }) => {
  const vector = [];
  const personalityWeight = 1.1;
  const cognitiveWeight = 1;
  const behaviorWeight = 0.95;
  const toCentered = (value) => clamp((Number(value || 50) - 50) / 50, -1, 1);

  TRAITS.forEach((trait) => {
    vector.push(toCentered(personalityVector[trait]) * personalityWeight);
  });

  COGNITIVE_KEYS.forEach((key) => {
    vector.push(toCentered(cognitiveVector[key]) * cognitiveWeight);
  });

  BEHAVIOR_KEYS.forEach((key) => {
    vector.push(toCentered(behaviorVector[key]) * behaviorWeight);
  });

  return vector;
};

const cosineSimilarity = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || !right.length) {
    return 0;
  }

  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  for (let index = 0; index < size; index += 1) {
    const l = Number(left[index] || 0);
    const r = Number(right[index] || 0);
    dot += l * r;
    leftMag += l * l;
    rightMag += r * r;
  }

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const classifyArchetype = ({ traits = {}, cognitiveScores = {}, behaviorVector = {} }) => {
  const profileVectors = toProfileVectorBundle({ traits, cognitiveScores, behaviorVector });
  const candidateVector = toCombinedVector(profileVectors);

  const ranked = ARCHETYPE_PROFILES.map((profile) => {
    const profileVector = toCombinedVector({
      personalityVector: profile.personality,
      cognitiveVector: profile.cognitive,
      behaviorVector: profile.behavior,
    });

    const similarity = cosineSimilarity(candidateVector, profileVector);

    return {
      ...profile,
      similarity,
      similarityScore: clamp(round(similarity * 100), 0, 100),
    };
  }).sort((a, b) => b.similarity - a.similarity);

  const top = ranked[0] || ARCHETYPE_PROFILES[0];

  const scoreMap = ranked.reduce((accumulator, item) => {
    accumulator[item.label] = item.similarityScore;
    return accumulator;
  }, {});

  return {
    interpretation: {
      label: top.label,
      score: top.similarityScore,
      summary: top.summary,
      best_fit_paths: top.best_fit_paths,
      method: 'cosine_similarity_cluster_classification',
    },
    archetypeScores: scoreMap,
    vectors: profileVectors,
  };
};

const buildStrengthsAndWeaknesses = (traits, profileVector, cognitiveScores = {}, behaviorVector = {}) => {
  const traitEntries = Object.entries(traits).sort((a, b) => b[1] - a[1]);
  const strongest = traitEntries.slice(0, 2);
  const lowest = traitEntries.slice(-2);

  const strengths = strongest.map(
    ([trait, score]) => `${traitLabels[trait]} (${score}): consistently visible in your assessment behavior.`
  );

  const topCognitive = Object.entries(cognitiveScores)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 1)
    .map(([key, value]) => `${key.replace(/_/g, ' ')} (${round(value)}%)`);

  if (topCognitive.length) {
    strengths.push(`Cognitive edge: ${topCognitive.join(', ')}.`);
  }

  const topBehavior = Object.entries(behaviorVector)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 1)
    .map(([key, value]) => `${key.replace(/_/g, ' ')} (${round(value)}%)`);

  if (topBehavior.length) {
    strengths.push(`Behavioral edge: ${topBehavior.join(', ')}.`);
  }

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

  const archetypeOutput = classifyArchetype({
    traits,
    cognitiveScores,
    behaviorVector,
  });

  const { strengths, weaknesses } = buildStrengthsAndWeaknesses(
    traits,
    profileVector,
    cognitiveScores,
    behaviorVector
  );

  return {
    personality_type: archetypeOutput.interpretation.label,
    trait_scores: traits,
    trait_z_scores: zNormalization.zScores,
    trait_z_normalized: zNormalization.zNormalized,
    trait_pre_z_scores: blendedRawTraits,
    ocean_normalized: ocean.normalized,
    ocean_counts: ocean.counts,
    ocean_raw: ocean.raw,
    ocean_min: ocean.min,
    ocean_max: ocean.max,
    hybrid_trait_scores: archetypeOutput.archetypeScores,
    dominant_strengths: strengths,
    weaknesses,
    interpretation: archetypeOutput.interpretation,
    vectors: archetypeOutput.vectors,
    introversion_score: clamp(100 - Number(traits.E || 50), 0, 100),
    behavioral_summary: buildBehavioralSummary({
      traits,
      behaviorAnalysis,
      interpretation: archetypeOutput.interpretation,
      behaviorVector,
    }),
  };
};

module.exports = {
  evaluatePersonalityProfile,
  getDominantTrait,
};
