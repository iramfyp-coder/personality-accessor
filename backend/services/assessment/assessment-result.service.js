const AssessmentResult = require('../../models/AssessmentResult');
const { config } = require('../../config/env');
const { analyzeBehavior } = require('./behavior-analysis.service');
const { evaluatePersonalityProfile, getDominantTrait } = require('./personality-engine.service');
const { recommendCareers } = require('./career-recommendation.service');
const { computeCognitiveScores } = require('./cognitive-style.service');
const { toBehaviorVector } = require('./behavior-vector.service');
const { extractOutputText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');
const {
  getSessionUnifiedAnswers,
  mapResultToLegacySummary,
  normalizeCvData,
  normalizeResultSchemaVersion,
  toLegacyBehaviorAnswers,
} = require('./unified-contracts.service');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const FACET_MODEL = {
  O: [
    { code: 'O1', label: 'curiosity' },
    { code: 'O2', label: 'imagination' },
    { code: 'O3', label: 'creativity' },
    { code: 'O4', label: 'openness_to_ideas' },
    { code: 'O5', label: 'emotional_openness' },
    { code: 'O6', label: 'aesthetic_interest' },
  ],
  C: [
    { code: 'C1', label: 'self_discipline' },
    { code: 'C2', label: 'organization' },
    { code: 'C3', label: 'goal_focus' },
    { code: 'C4', label: 'reliability' },
    { code: 'C5', label: 'planning' },
    { code: 'C6', label: 'deliberation' },
  ],
  E: [
    { code: 'E1', label: 'social_energy' },
    { code: 'E2', label: 'assertiveness' },
    { code: 'E3', label: 'leadership' },
    { code: 'E4', label: 'communication_drive' },
    { code: 'E5', label: 'initiative' },
    { code: 'E6', label: 'influence_orientation' },
  ],
  A: [
    { code: 'A1', label: 'cooperation' },
    { code: 'A2', label: 'empathy' },
    { code: 'A3', label: 'trust' },
    { code: 'A4', label: 'supportiveness' },
    { code: 'A5', label: 'humility' },
    { code: 'A6', label: 'prosocial_behavior' },
  ],
  N: [
    { code: 'N1', label: 'stress_reactivity' },
    { code: 'N2', label: 'emotional_volatility' },
    { code: 'N3', label: 'worry_intensity' },
    { code: 'N4', label: 'pressure_sensitivity' },
    { code: 'N5', label: 'self_doubt' },
    { code: 'N6', label: 'threat_focus' },
  ],
};

const buildTrendVector = (traitScores = {}) => {
  const values = {
    O: Number(traitScores.O || 0),
    C: Number(traitScores.C || 0),
    E: Number(traitScores.E || 0),
    A: Number(traitScores.A || 0),
    N: Number(traitScores.N || 0),
  };

  const average = Object.values(values).reduce((sum, value) => sum + value, 0) / 5;

  return {
    ...values,
    average: Number(average.toFixed(2)),
  };
};

const buildInsightHeatmap = ({ traitScores = {}, cognitiveScores = {}, behaviorVector = {} }) => {
  const base = {
    O: Number(traitScores.O || 50),
    C: Number(traitScores.C || 50),
    E: Number(traitScores.E || 50),
    A: Number(traitScores.A || 50),
    N: Number(traitScores.N || 50),
  };

  const cognitive = {
    analytical: Number(cognitiveScores.analytical || 50),
    creative: Number(cognitiveScores.creative || 50),
    strategic: Number(cognitiveScores.strategic || 50),
    systematic: Number(cognitiveScores.systematic || 50),
    practical: Number(cognitiveScores.practical || 50),
    abstract: Number(cognitiveScores.abstract || 50),
  };

  const behavior = {
    leadership: Number(behaviorVector.leadership || 50),
    risk_tolerance: Number(behaviorVector.risk_tolerance || 50),
    decision_speed: Number(behaviorVector.decision_speed || 50),
    stress_tolerance: Number(behaviorVector.stress_tolerance || 50),
    team_preference: Number(behaviorVector.team_preference || 50),
  };

  const traitValues = {
    O: round(clamp(base.O * 0.76 + cognitive.creative * 0.14 + cognitive.abstract * 0.1, 0, 100)),
    C: round(
      clamp(base.C * 0.72 + cognitive.systematic * 0.16 + cognitive.analytical * 0.08 + behavior.decision_speed * 0.04, 0, 100)
    ),
    E: round(clamp(base.E * 0.74 + behavior.leadership * 0.16 + behavior.decision_speed * 0.1, 0, 100)),
    A: round(clamp(base.A * 0.76 + behavior.team_preference * 0.18 + cognitive.practical * 0.06, 0, 100)),
    N: round(
      clamp(base.N * 0.72 + (100 - behavior.stress_tolerance) * 0.2 + (100 - behavior.risk_tolerance) * 0.08, 0, 100)
    ),
  };

  const insightHeatmap = Object.entries(traitValues).map(([trait, value]) => ({
    trait,
    value: round(value),
  }));

  const facetScores = {};

  const assignFacet = (trait, code, value) => {
    facetScores[code] = round(clamp(value, 0, 100));
  };

  const O = traitValues.O;
  assignFacet('O', 'O1', O * 0.72 + cognitive.abstract * 0.28);
  assignFacet('O', 'O2', O * 0.74 + cognitive.creative * 0.26);
  assignFacet('O', 'O3', O * 0.68 + cognitive.creative * 0.32);
  assignFacet('O', 'O4', O * 0.74 + cognitive.strategic * 0.2 + behavior.risk_tolerance * 0.06);
  assignFacet('O', 'O5', O * 0.78 + traitValues.A * 0.22);
  assignFacet('O', 'O6', O * 0.82 + cognitive.creative * 0.18);

  const C = traitValues.C;
  assignFacet('C', 'C1', C * 0.74 + behavior.decision_speed * 0.26);
  assignFacet('C', 'C2', C * 0.8 + cognitive.systematic * 0.2);
  assignFacet('C', 'C3', C * 0.76 + cognitive.strategic * 0.24);
  assignFacet('C', 'C4', C * 0.74 + cognitive.analytical * 0.2 + behavior.stress_tolerance * 0.06);
  assignFacet('C', 'C5', C * 0.78 + cognitive.systematic * 0.22);
  assignFacet('C', 'C6', C * 0.8 + (100 - traitValues.N) * 0.2);

  const E = traitValues.E;
  assignFacet('E', 'E1', E * 0.74 + traitValues.A * 0.26);
  assignFacet('E', 'E2', E * 0.78 + behavior.decision_speed * 0.22);
  assignFacet('E', 'E3', E * 0.68 + behavior.leadership * 0.32);
  assignFacet('E', 'E4', E * 0.74 + behavior.decision_speed * 0.26);
  assignFacet('E', 'E5', E * 0.72 + behavior.risk_tolerance * 0.28);
  assignFacet('E', 'E6', E * 0.8 + (100 - traitValues.N) * 0.2);

  const A = traitValues.A;
  assignFacet('A', 'A1', A * 0.78 + behavior.team_preference * 0.22);
  assignFacet('A', 'A2', A * 0.74 + traitValues.O * 0.26);
  assignFacet('A', 'A3', A * 0.8 + behavior.team_preference * 0.2);
  assignFacet('A', 'A4', A * 0.72 + behavior.team_preference * 0.28);
  assignFacet('A', 'A5', A * 0.74 + (100 - traitValues.E) * 0.26);
  assignFacet('A', 'A6', A * 0.72 + traitValues.O * 0.14 + behavior.team_preference * 0.14);

  const N = traitValues.N;
  assignFacet('N', 'N1', N * 0.8 + (100 - behavior.stress_tolerance) * 0.2);
  assignFacet('N', 'N2', N * 0.74 + (100 - behavior.decision_speed) * 0.26);
  assignFacet('N', 'N3', N * 0.78 + (100 - traitValues.E) * 0.22);
  assignFacet('N', 'N4', N * 0.74 + (100 - behavior.stress_tolerance) * 0.26);
  assignFacet('N', 'N5', N * 0.76 + (100 - behavior.risk_tolerance) * 0.24);
  assignFacet('N', 'N6', N * 0.78 + (100 - behavior.stress_tolerance) * 0.22);

  const facetDefinitions = Object.values(FACET_MODEL).flat().reduce((accumulator, facet) => {
    accumulator[facet.code] = facet.label;
    return accumulator;
  }, {});

  return {
    insightHeatmap,
    facetScores,
    facetDefinitions,
  };
};

const toAnswerFivePoint = ({ answer = {}, question = {} }) => {
  const type = String(question?.type || answer?.type || '').toLowerCase();

  if (type === 'scale') {
    const raw = Number(answer?.value);
    const min = Number(question?.scaleMin || answer?.metadata?.scaleMin || 1);
    const max = Number(question?.scaleMax || answer?.metadata?.scaleMax || 10);

    if (Number.isFinite(raw) && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return clamp(((raw - min) / (max - min)) * 4 + 1, 1, 5);
    }

    return 3;
  }

  if (typeof answer?.value === 'number') {
    return clamp(answer.value, 1, 5);
  }

  if (answer?.value && typeof answer.value === 'object') {
    const candidate = Number(
      answer.value.normalizedScore ?? answer.metadata?.normalizedScore ?? answer.value.score
    );
    return Number.isFinite(candidate) ? clamp(candidate, 1, 5) : 3;
  }

  return clamp(Number(answer?.metadata?.normalizedScore || 3), 1, 5);
};

const averageScoreByIntent = ({ answers = [], questionPlan = [], intents = [] }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));
  const targetIntents = new Set(
    (Array.isArray(intents) ? intents : []).map((intent) => String(intent || '').toLowerCase())
  );

  const matched = (Array.isArray(answers) ? answers : []).filter((answer) => {
    const question = byQuestionId.get(answer.questionId);
    const intent = String(question?.intent || answer?.metadata?.intent || '').toLowerCase();
    if (targetIntents.has(intent)) {
      return true;
    }

    return Array.from(targetIntents).some((token) => intent.includes(token));
  });

  if (!matched.length) {
    return 3;
  }

  const average =
    matched.reduce((sum, answer) => {
      const question = byQuestionId.get(answer.questionId);
      return sum + toAnswerFivePoint({ answer, question });
    }, 0) / matched.length;

  return Number(average.toFixed(4));
};

const computeConsistencyScore = ({
  personalityProfile = {},
  behaviorAnalysis = {},
  behaviorVector = {},
  answers = [],
  questionPlan = [],
}) => {
  const traits = personalityProfile.trait_scores || {};
  const values = Object.values(traits).map((value) => Number(value || 0));

  if (values.length === 0) {
    return {
      score: 0.5,
      contradictions: [],
    };
  }

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  const normalizedVariance = clamp(variance / 1000, 0, 1);

  const behavioralStability = String(behaviorAnalysis.emotional_stability || '').toLowerCase();
  const stabilityBoost = behavioralStability.includes('stable') ? 0.08 : 0;
  const stabilityPenalty = behavioralStability.includes('reactive') ? 0.08 : 0;

  const stressSignal = Number(behaviorVector.stress_tolerance || 50);
  const stressBoost = (stressSignal - 50) / 700;

  const teamworkScore = averageScoreByIntent({
    answers,
    questionPlan,
    intents: ['teamwork', 'conflict'],
  });
  const soloScore = averageScoreByIntent({
    answers,
    questionPlan,
    intents: ['independence', 'structure'],
  });
  const riskScore = averageScoreByIntent({
    answers,
    questionPlan,
    intents: ['risk'],
  });
  const deadlineScore = averageScoreByIntent({
    answers,
    questionPlan,
    intents: ['deadline'],
  });

  const contradictions = [];

  if (teamworkScore >= 3.8 && soloScore >= 3.8) {
    contradictions.push('High teamwork and high solo-work preference were both strongly selected.');
  }

  if (riskScore >= 3.8 && deadlineScore <= 2.2) {
    contradictions.push('Risk-seeking responses were paired with low deadline-pressure tolerance.');
  }

  const contradictionPenalty = contradictions.length * 0.12;
  const score = clamp(
    0.72 - normalizedVariance + stabilityBoost - stabilityPenalty + stressBoost - contradictionPenalty,
    0,
    1
  );

  return {
    score: Number(score.toFixed(4)),
    contradictions,
  };
};

const computeTopCareerConfidence = ({
  recommendations = [],
  consistencyScore = 1,
  traitScores = {},
  answeredQuestions = 0,
  targetQuestions = 22,
}) => {
  const list = Array.isArray(recommendations) ? recommendations : [];

  if (list.length === 0) {
    return {
      confidenceGap: 0,
      confidenceBand: 'low',
      confidenceScore: 0,
      confidence: 0,
    };
  }

  const top1 = Number(list[0]?.score || 0);
  const top2 = Number(list[1]?.score || 0);
  const careerGap = clamp(round(top1 - top2), 0, 100);

  const traitValues = ['O', 'C', 'E', 'A', 'N'].map((key) => Number(traitScores[key] || 50));
  const traitMean = traitValues.reduce((sum, value) => sum + value, 0) / traitValues.length;
  const traitVariance =
    traitValues.reduce((sum, value) => sum + (value - traitMean) ** 2, 0) / traitValues.length;
  const traitStd = Math.sqrt(traitVariance);
  const traitVarianceFactor = (1 - clamp(traitStd / 35, 0, 1)) * 100;

  const consistencyFactor = clamp(Number(consistencyScore || 0), 0, 1) * 100;
  const questionCountFactor =
    clamp(Number(answeredQuestions || 0) / Math.max(Number(targetQuestions || 22), 1), 0, 1) * 100;

  const normalizedScore =
    consistencyFactor * 0.4 +
    traitVarianceFactor * 0.2 +
    careerGap * 0.25 +
    questionCountFactor * 0.15;

  const confidenceScore = clamp(round(normalizedScore), 0, 100);
  const confidence = Number((confidenceScore / 100).toFixed(4));
  const confidenceBand = confidenceScore < 45 ? 'low' : confidenceScore <= 70 ? 'medium' : 'high';

  return {
    confidenceGap: careerGap,
    confidenceBand,
    confidenceScore,
    confidence,
  };
};

const buildCareerContrast = (recommendations = []) => {
  const list = Array.isArray(recommendations) ? recommendations : [];
  if (list.length < 2) {
    return {};
  }

  const top1 = list[0];
  const top2 = list[1];

  const dimensions = [
    { key: 'personality_score', label: 'personality alignment' },
    { key: 'cognitive_match', label: 'cognitive match' },
    { key: 'behavior_match', label: 'behavior signal' },
    { key: 'aptitude_match', label: 'analytical aptitude' },
    { key: 'skill_alignment', label: 'skills fit' },
  ];

  const rankedReasons = dimensions
    .map((dimension) => ({
      label: dimension.label,
      delta: Number(top1?.[dimension.key] || 0) - Number(top2?.[dimension.key] || 0),
    }))
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  const reasons = rankedReasons.map(
    (item) => `${item.label} is ${Math.round(item.delta)} points stronger for ${top1.career}`
  );
  const summary =
    rankedReasons.length > 0
      ? `${top1.career} is stronger than ${top2.career} due to higher ${rankedReasons
          .map((item) => item.label)
          .join(', ')}.`
      : `${top1.career} outranks ${top2.career} through a stronger overall composite score.`;

  return {
    primaryCareer: top1.career,
    secondaryCareer: top2.career,
    summary,
    reasons,
  };
};

const toTopEntries = (source = {}, count = 2) =>
  Object.entries(source || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, count);

const buildNarrativeFallback = ({
  personalityProfile = {},
  cognitiveScores = {},
  behaviorVector = {},
  recommendations = [],
  consistencyScore = 0.5,
  cvData = {},
}) => {
  const interpretationSummary = String(personalityProfile?.interpretation?.summary || '').trim();
  const topCareer = recommendations?.[0]?.career || 'your top matched path';

  const topTraits = toTopEntries(personalityProfile?.trait_scores || {}, 2)
    .map(([trait, score]) => `${trait} ${round(score)}%`)
    .join(', ');

  const topCognitive = toTopEntries(cognitiveScores, 2)
    .map(([key, score]) => `${key.replace(/_/g, ' ')} ${round(score)}%`)
    .join(', ');

  const topBehavior = toTopEntries(behaviorVector, 2)
    .map(([key, score]) => `${key.replace(/_/g, ' ')} ${round(score)}%`)
    .join(', ');

  const topSkills = (Array.isArray(cvData.skills) ? cvData.skills : [])
    .map((item) => String(item?.name || item || '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return `Your profile is led by ${topTraits || 'balanced traits'}, with strongest cognition in ${
    topCognitive || 'analytical and strategic processing'
  } and behavior signals in ${topBehavior || 'steady execution'}. ${
    interpretationSummary || 'This pattern suggests reliable performance in complex environments.'
  } Core skills${topSkills ? ` (${topSkills})` : ''} support ${topCareer} as the strongest direction, with current profile consistency at ${round(
    Number(consistencyScore || 0) * 100
  )}%.`;
};

const generateNarrativeSummary = async ({
  personalityProfile = {},
  cognitiveScores = {},
  behaviorVector = {},
  recommendations = [],
  consistencyScore = 0.5,
  cvData = {},
}) => {
  const fallback = buildNarrativeFallback({
    personalityProfile,
    cognitiveScores,
    behaviorVector,
    recommendations,
    consistencyScore,
    cvData,
  });

  if (!config.openaiApiKey) {
    return fallback;
  }

  const topTraitEntries = toTopEntries(personalityProfile?.trait_scores || {}, 3);
  const topCognitiveEntries = toTopEntries(cognitiveScores, 3);
  const topBehaviorEntries = toTopEntries(behaviorVector, 3);
  const topSkills = (Array.isArray(cvData.skills) ? cvData.skills : [])
    .map((entry) => String(entry?.name || entry || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.2,
      max_output_tokens: 260,
      input: [
        {
          role: 'system',
          content:
            'Write one concise paragraph grounded in explicit profile signals. Mention top traits, top cognitive signals, top behavior signals, and top skills. Avoid generic advice.',
        },
        {
          role: 'user',
          content: `Generate one paragraph (80-140 words) with concrete metrics.\n\nArchetype: ${
            personalityProfile?.personality_type || 'Adaptive Generalist'
          }\nTop traits: ${JSON.stringify(topTraitEntries)}\nTop cognitive: ${JSON.stringify(
            topCognitiveEntries
          )}\nTop behavior: ${JSON.stringify(topBehaviorEntries)}\nTop skills: ${JSON.stringify(
            topSkills
          )}\nTop careers: ${(recommendations || [])
            .slice(0, 3)
            .map((item) => item?.career)
            .join(', ')}\nConsistency score: ${round(Number(consistencyScore || 0) * 100)}%`,
        },
      ],
    });

    const text = String(extractOutputText(response) || '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  } catch (error) {
    return fallback;
  }
};

const persistAssessmentResult = async ({
  session,
  unifiedAnswers,
  behaviorAnalysis,
  behaviorVector,
  cognitiveScores,
  personalityProfile,
  careerOutput,
  narrativeSummary,
  careerContrast,
}) => {
  const now = new Date();
  const normalizedCv = normalizeCvData(session.cvData || {});
  const traitScores = personalityProfile.trait_scores || {};
  const dominantTrait = getDominantTrait(traitScores);

  const consistencyOutput = computeConsistencyScore({
    personalityProfile,
    behaviorAnalysis,
    behaviorVector,
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
  });
  const consistencyScore = consistencyOutput.score;

  const confidenceOutput = computeTopCareerConfidence({
    recommendations: careerOutput.recommendations || [],
    consistencyScore,
    traitScores,
    answeredQuestions: unifiedAnswers.filter((answer) => answer.type !== 'behavior').length,
    targetQuestions: session.questionPlan?.length || 22,
  });

  const heatmapOutput = buildInsightHeatmap({
    traitScores,
    cognitiveScores,
    behaviorVector,
  });

  const stopConfidence = Number(session?.adaptiveMetrics?.questionnaireConfidence || 0);

  const resultPayload = {
    userId: session.userId,
    sessionId: session._id,
    cvData: normalizedCv,
    answers: unifiedAnswers,
    behavior: {
      analysis: behaviorAnalysis,
      vector: behaviorVector,
      signals: {
        personalitySignals: behaviorAnalysis.personality_signals || [],
        decisionStyle: behaviorAnalysis.decision_style || '',
        confidenceLevel: behaviorAnalysis.confidence_level || '',
        riskTendency: behaviorAnalysis.risk_tendency || '',
      },
    },
    personality: {
      traits: traitScores,
      traitZScores: personalityProfile.trait_z_scores || {},
      traitZNormalized: personalityProfile.trait_z_normalized || {},
      traitPreZScores: personalityProfile.trait_pre_z_scores || {},
      cognitiveScores,
      oceanNormalized: personalityProfile.ocean_normalized || {},
      oceanCounts: personalityProfile.ocean_counts || {},
      archetypes: {
        personalityType: personalityProfile.personality_type || 'Adaptive Generalist',
        dominantTrait,
        hybridTraitScores: personalityProfile.hybrid_trait_scores || {},
        dominantStrengths: personalityProfile.dominant_strengths || [],
        weaknesses: personalityProfile.weaknesses || [],
        interpretation: personalityProfile.interpretation || {},
        introversionScore: Number(personalityProfile.introversion_score || 0),
        behavioralSummary: personalityProfile.behavioral_summary || '',
      },
      vectors: personalityProfile.vectors || {},
      consistencyScore,
      consistencySignals: consistencyOutput.contradictions || [],
      narrativeSummary: narrativeSummary || '',
    },
    career: {
      recommendations: careerOutput.recommendations || [],
      roadmap: careerOutput.careerRoadmap || [],
      aptitudeSignals: careerOutput.aptitudeSignals || {},
      cluster: careerOutput.cluster || '',
      clusterLabel: careerOutput.clusterLabel || '',
      whyNotCatalog: careerOutput.whyNotCatalog || {},
      contrast: careerContrast || {},
      fitScores: (careerOutput.recommendations || []).reduce((accumulator, item) => {
        accumulator[String(item.career || 'unknown')] = Number(item.score || 0);
        return accumulator;
      }, {}),
    },
    analytics: {
      trendVector: buildTrendVector(traitScores),
      insightHeatmap: heatmapOutput.insightHeatmap,
      facetScores: heatmapOutput.facetScores,
      facetDefinitions: heatmapOutput.facetDefinitions,
      confidence: confidenceOutput.confidence,
      confidenceScore: confidenceOutput.confidenceScore,
      confidenceGap: confidenceOutput.confidenceGap,
      confidenceBand: confidenceOutput.confidenceBand,
      stopConfidence: clamp(stopConfidence, 0, 1),
      balance: {
        personalityWeight: Math.round(Number(careerOutput?.balance?.weights?.personality || 0.3) * 100),
        careerWeight:
          100 - Math.round(Number(careerOutput?.balance?.weights?.personality || 0.3) * 100),
        personalityScore: Number(careerOutput?.balance?.personalityScore || 0),
        careerScore: Number(careerOutput?.balance?.careerScore || 0),
        componentWeights: careerOutput?.balance?.weights || {},
      },
    },
    schemaVersion: normalizeResultSchemaVersion(),
    completedAt: session.completedAt || now,
  };

  const result = await AssessmentResult.findOneAndUpdate(
    { sessionId: session._id },
    {
      $set: resultPayload,
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).exec();

  return result;
};

const generateAssessmentResult = async ({ session }) => {
  const unifiedAnswers = getSessionUnifiedAnswers(session);

  const behaviorAnswers = toLegacyBehaviorAnswers({
    answers: unifiedAnswers,
    behaviorPrompts: session.behaviorPrompts || [],
    questionPlan: session.questionPlan || [],
  });

  const behaviorAnalysis = await analyzeBehavior({
    answers: behaviorAnswers,
    cvData: session.cvData || {},
    profileVector: session.profileVector || {},
  });

  const cognitiveScores = computeCognitiveScores({
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
    profileVector: session.profileVector || {},
  });

  const behaviorVector = toBehaviorVector({
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
    behaviorAnalysis,
  });

  const personalityProfile = evaluatePersonalityProfile({
    cvData: session.cvData || {},
    profileVector: session.profileVector || {},
    questionPlan: session.questionPlan || [],
    answers: unifiedAnswers,
    behaviorAnalysis,
    cognitiveScores,
    behaviorVector,
  });

  const careerOutput = recommendCareers({
    cvData: session.cvData || {},
    personalityProfile,
    profileVector: session.profileVector || {},
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
    cognitiveScores,
    behaviorVector,
  });

  const careerContrast = buildCareerContrast(careerOutput.recommendations || []);
  const consistencyPreview = computeConsistencyScore({
    personalityProfile,
    behaviorAnalysis,
    behaviorVector,
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
  });
  const narrativeSummary = await generateNarrativeSummary({
    personalityProfile,
    cognitiveScores,
    behaviorVector,
    recommendations: careerOutput.recommendations || [],
    consistencyScore: consistencyPreview.score,
    cvData: session.cvData || {},
  });

  const resultDocument = await persistAssessmentResult({
    session,
    unifiedAnswers,
    behaviorAnalysis,
    behaviorVector,
    cognitiveScores,
    personalityProfile,
    careerOutput,
    narrativeSummary,
    careerContrast,
  });

  const resultObject = resultDocument.toObject();

  return {
    behaviorAnalysis,
    behaviorVector,
    cognitiveScores,
    personalityProfile,
    careerOutput,
    resultDocument,
    resultSummary: mapResultToLegacySummary(resultObject),
  };
};

module.exports = {
  generateAssessmentResult,
};
