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
  toLegacyScaleAnswers,
} = require('./unified-contracts.service');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const FACET_CODES_BY_TRAIT = {
  O: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6'],
  C: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
  E: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'],
  A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  N: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'],
};

const FACET_OFFSETS = [-12, -6, -2, 3, 8, 12];

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
  const baseTraits = {
    O: Number(traitScores.O || 0),
    C: Number(traitScores.C || 0),
    E: Number(traitScores.E || 0),
    A: Number(traitScores.A || 0),
    N: Number(traitScores.N || 0),
  };

  const traitAdjustments = {
    O:
      (Number(cognitiveScores.creative || 50) - 50) * 0.16 +
      (Number(behaviorVector.risk_tolerance || 50) - 50) * 0.1,
    C:
      (Number(cognitiveScores.analytical || 50) - 50) * 0.12 +
      (Number(cognitiveScores.systematic || 50) - 50) * 0.12 +
      (Number(cognitiveScores.strategic || 50) - 50) * 0.08,
    E:
      (Number(behaviorVector.leadership || 50) - 50) * 0.16 +
      (Number(behaviorVector.decision_speed || 50) - 50) * 0.1,
    A:
      (Number(behaviorVector.team_preference || 50) - 50) * 0.16 +
      (Number(cognitiveScores.practical || 50) - 50) * 0.08,
    N:
      (Number(behaviorVector.stress_tolerance || 50) - 50) * -0.18 +
      (Number(behaviorVector.risk_tolerance || 50) - 50) * 0.05,
  };

  const insightHeatmap = Object.entries(baseTraits).map(([trait, value]) => ({
    trait,
    value: Math.round(clamp(value + Number(traitAdjustments[trait] || 0), 0, 100)),
  }));

  const facetScores = insightHeatmap.reduce((accumulator, entry) => {
    const facetCodes = FACET_CODES_BY_TRAIT[entry.trait] || [];
    facetCodes.forEach((code, index) => {
      const modeled = clamp(
        entry.value + FACET_OFFSETS[index % FACET_OFFSETS.length] + (index % 2 === 0 ? 2 : -1),
        0,
        100
      );
      accumulator[code] = Math.round(modeled);
    });
    return accumulator;
  }, {});

  return {
    insightHeatmap,
    facetScores,
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
    return targetIntents.has(intent);
  });

  if (!matched.length) {
    return 3;
  }

  const average = matched.reduce((sum, answer) => {
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
  const normalizedVariance = clamp(variance / (100 ** 2), 0, 1);

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

const computeTopCareerConfidence = ({ recommendations = [], consistencyScore = 1 }) => {
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
  const gap = clamp(Math.round(top1 - top2), 0, 100);
  const baseConfidence = gap / 100;
  const consistencyMultiplier = clamp(0.55 + Number(consistencyScore || 0) * 0.45, 0.45, 1);
  const adjustedConfidence = clamp(baseConfidence * consistencyMultiplier, 0, 1);
  const adjustedScore = Math.round(adjustedConfidence * 100);
  const band = adjustedScore < 25 ? 'low' : adjustedScore <= 55 ? 'medium' : 'high';
  const confidence = Number(adjustedConfidence.toFixed(4));

  return {
    confidenceGap: gap,
    confidenceBand: band,
    confidenceScore: adjustedScore,
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

const buildNarrativeFallback = ({
  personalityProfile = {},
  cognitiveScores = {},
  behaviorVector = {},
  recommendations = [],
  consistencyScore = 0.5,
}) => {
  const interpretationSummary = String(personalityProfile?.interpretation?.summary || '').trim();
  const topCareer = recommendations?.[0]?.career || 'your top matched path';

  const analytical = Number(cognitiveScores.analytical || 50);
  const strategic = Number(cognitiveScores.strategic || 50);
  const leadership = Number(behaviorVector.leadership || 50);

  return `You are a structured thinker with ${Math.round(analytical)}% analytical strength and ${Math.round(
    strategic
  )}% strategic orientation. ${interpretationSummary || 'Your profile indicates dependable execution in complex work contexts.'} Leadership signal is ${Math.round(
    leadership
  )}%, and current consistency is ${Math.round(consistencyScore * 100)}%, which supports ${topCareer} as a strong career direction.`;
};

const generateNarrativeSummary = async ({
  personalityProfile = {},
  cognitiveScores = {},
  behaviorVector = {},
  recommendations = [],
  consistencyScore = 0.5,
}) => {
  const fallback = buildNarrativeFallback({
    personalityProfile,
    cognitiveScores,
    behaviorVector,
    recommendations,
    consistencyScore,
  });

  if (!config.openaiApiKey) {
    return fallback;
  }

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.2,
      max_output_tokens: 220,
      input: [
        {
          role: 'system',
          content:
            'Write one concise career-intelligence narrative paragraph grounded in provided metrics. No markdown.',
        },
        {
          role: 'user',
          content: `Generate one paragraph (70-120 words).\n\nPersonality type: ${
            personalityProfile?.personality_type || 'Analytical Builder'
          }\nInterpretation: ${personalityProfile?.interpretation?.summary || 'n/a'}\nCognitive scores: ${JSON.stringify(
            cognitiveScores
          )}\nBehavior vector: ${JSON.stringify(
            behaviorVector
          )}\nTop careers: ${(recommendations || []).slice(0, 2).map((item) => item?.career).join(', ')}\nConsistency score: ${Math.round(
            Number(consistencyScore || 0) * 100
          )}%\n\nStyle: professional, explanatory, psychologically coherent.`,
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
      cognitiveScores,
      oceanNormalized: personalityProfile.ocean_normalized || {},
      oceanCounts: personalityProfile.ocean_counts || {},
      archetypes: {
        personalityType: personalityProfile.personality_type || 'Analytical Builder',
        dominantTrait,
        hybridTraitScores: personalityProfile.hybrid_trait_scores || {},
        dominantStrengths: personalityProfile.dominant_strengths || [],
        weaknesses: personalityProfile.weaknesses || [],
        interpretation: personalityProfile.interpretation || {},
        introversionScore: Number(personalityProfile.introversion_score || 0),
        behavioralSummary: personalityProfile.behavioral_summary || '',
      },
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
      confidence: confidenceOutput.confidence,
      confidenceScore: confidenceOutput.confidenceScore,
      confidenceGap: confidenceOutput.confidenceGap,
      confidenceBand: confidenceOutput.confidenceBand,
      stopConfidence: clamp(stopConfidence, 0, 1),
      balance: {
        personalityWeight: Math.round(Number(careerOutput?.balance?.weights?.personality || 0.25) * 100),
        careerWeight:
          100 - Math.round(Number(careerOutput?.balance?.weights?.personality || 0.25) * 100),
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

  const scaleAnswers = toLegacyScaleAnswers({
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
  });

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
    answers: scaleAnswers,
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
