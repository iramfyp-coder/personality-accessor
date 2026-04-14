const AssessmentResult = require('../../models/AssessmentResult');
const { analyzeBehavior } = require('./behavior-analysis.service');
const { evaluatePersonalityProfile, getDominantTrait } = require('./personality-engine.service');
const { recommendCareers } = require('./career-recommendation.service');
const { buildTraitVector } = require('../trait-vector.service');
const {
  generateResultNarrative,
  computeConfidenceScore,
} = require('../ai-result-narrative.service');
const { extractAiCvIntelligence } = require('../ai-cv-intelligence.service');
const {
  getSessionUnifiedAnswers,
  mapResultToLegacySummary,
  normalizeCvData,
  normalizeResultSchemaVersion,
  toLegacyBehaviorAnswers,
} = require('./unified-contracts.service');

const TRAITS = ['O', 'C', 'E', 'A', 'N'];

const FACET_MODEL = {
  O: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6'],
  C: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
  E: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'],
  A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  N: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(Number(value) || 0);

const toLegacyBehaviorVector = ({ behavior = {}, traits = {} } = {}) => ({
  leadership: clamp(round(behavior.leadership || 50), 0, 100),
  risk_tolerance: clamp(round(behavior.risk || 50), 0, 100),
  decision_speed: clamp(round(behavior.execution || 50), 0, 100),
  stress_tolerance: clamp(round(100 - Number(traits.N || 50)), 0, 100),
  team_preference: clamp(round(behavior.collaboration || 50), 0, 100),
});

const buildTrendVector = (traitScores = {}) => {
  const values = {
    O: Number(traitScores.O || 50),
    C: Number(traitScores.C || 50),
    E: Number(traitScores.E || 50),
    A: Number(traitScores.A || 50),
    N: Number(traitScores.N || 50),
  };

  const average = Object.values(values).reduce((sum, value) => sum + value, 0) / 5;

  return {
    ...values,
    average: Number(average.toFixed(2)),
  };
};

const buildInsightHeatmap = ({ traitScores = {}, facetVector = {} }) => {
  const insightHeatmap = TRAITS.map((trait) => ({
    trait,
    value: clamp(round(traitScores[trait] || 50), 0, 100),
  }));

  const facetScores = {};

  TRAITS.forEach((trait) => {
    const base = Number(traitScores[trait] || 50);
    const codes = FACET_MODEL[trait] || [];

    codes.forEach((code, index) => {
      const explicit = Number(facetVector[String(code || '').toLowerCase()] || 0);
      const synthetic = clamp(round(base + (index - 2.5) * 2), 0, 100);
      facetScores[code] = explicit ? clamp(round(explicit), 0, 100) : synthetic;
    });
  });

  return {
    insightHeatmap,
    facetScores,
    facetDefinitions: Object.values(FACET_MODEL).flat().reduce((accumulator, code) => {
      accumulator[code] = code;
      return accumulator;
    }, {}),
  };
};

const computeConsistencyScore = ({ traitVectorOutput = {} } = {}) => {
  const responses = Array.isArray(traitVectorOutput.responseSignals)
    ? traitVectorOutput.responseSignals
    : [];

  if (!responses.length) {
    return {
      score: 0.5,
      contradictions: [],
    };
  }

  const normalizedScores = responses.map((entry) => Number(entry?.normalized_score || 3));
  const mean = normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length;
  const variance =
    normalizedScores.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(normalizedScores.length, 1);

  const responseConfidence = clamp(Number(traitVectorOutput.responseConfidence || 0.55), 0, 1);
  const variancePenalty = clamp(variance / 2.6, 0, 1);

  const contradictions = [];
  if (variance >= 1.8) {
    contradictions.push('Answer variance is elevated across similar psychometric intents.');
  }
  if (responseConfidence < 0.45) {
    contradictions.push('Low response confidence in text/scenario answers reduced stability.');
  }

  const score = clamp(responseConfidence * 0.7 + (1 - variancePenalty) * 0.3, 0, 1);

  return {
    score: Number(score.toFixed(4)),
    contradictions,
  };
};

const computeTraitVarianceFactor = (traitScores = {}) => {
  const values = TRAITS.map((trait) => Number(traitScores[trait] || 50));
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
  const stdDev = Math.sqrt(variance);

  return Number(clamp(stdDev / 24, 0, 1).toFixed(4));
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
    { key: 'behavior_match', label: 'behavior alignment' },
    { key: 'skill_alignment', label: 'skill overlap' },
  ];

  const rankedReasons = dimensions
    .map((dimension) => ({
      label: dimension.label,
      delta: Number(top1?.[dimension.key] || 0) - Number(top2?.[dimension.key] || 0),
    }))
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  return {
    primaryCareer: top1.career,
    secondaryCareer: top2.career,
    summary:
      rankedReasons.length > 0
        ? `${top1.career} ranks above ${top2.career} due to stronger ${rankedReasons
            .map((item) => item.label)
            .join(', ')}.`
        : `${top1.career} ranks above ${top2.career} on overall profile alignment.`,
    reasons: rankedReasons.map(
      (item) => `${item.label} is ${Math.round(item.delta)} points stronger for ${top1.career}`
    ),
  };
};

const persistAssessmentResult = async ({
  session,
  unifiedAnswers,
  behaviorAnalysis,
  behaviorVector,
  cognitiveScores,
  personalityProfile,
  careerOutput,
  narrativeOutput,
  careerContrast,
  confidenceOutput,
  consistencyOutput,
  heatmapOutput,
  aiProfile,
}) => {
  const now = new Date();
  const normalizedCv = normalizeCvData(session.cvData || {});
  const traitScores = personalityProfile.trait_scores || {};
  const dominantTrait = getDominantTrait(traitScores);
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
        personalityType: personalityProfile.personality_type || 'Trait-Led Profile',
        dominantTrait,
        hybridTraitScores: personalityProfile.hybrid_trait_scores || {},
        dominantStrengths:
          narrativeOutput?.strengths || personalityProfile.dominant_strengths || [],
        weaknesses:
          narrativeOutput?.weaknesses || personalityProfile.weaknesses || [],
        interpretation: personalityProfile.interpretation || {},
        introversionScore: Number(personalityProfile.introversion_score || 0),
        behavioralSummary: personalityProfile.behavioral_summary || '',
      },
      vectors: personalityProfile.vectors || {},
      consistencyScore: consistencyOutput.score,
      consistencySignals: consistencyOutput.contradictions || [],
      narrativeSummary: narrativeOutput?.summary || '',
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
      confidenceGap: clamp(
        Number(careerOutput?.recommendations?.[0]?.score || 0) -
          Number(careerOutput?.recommendations?.[1]?.score || 0),
        0,
        100
      ),
      confidenceBand: confidenceOutput.confidenceBand,
      stopConfidence: clamp(stopConfidence, 0, 1),
      balance: {
        personalityWeight: 50,
        careerWeight: 50,
        personalityScore: Number(careerOutput?.balance?.personalityScore || 0),
        careerScore: Number(careerOutput?.balance?.careerScore || 0),
        componentWeights: careerOutput?.balance?.weights || {},
      },
      aiReport: {
        summary: narrativeOutput?.summary || '',
        strengths: narrativeOutput?.strengths || [],
        weaknesses: narrativeOutput?.weaknesses || [],
        communicationStyle: behaviorAnalysis?.decision_style || '',
        workStyle: (Array.isArray(aiProfile?.work_style) ? aiProfile.work_style : []).join(', '),
        growthSuggestions: narrativeOutput?.growth_path || [],
        careerRecommendations: (careerOutput?.recommendations || []).slice(0, 3),
        model: 'adaptive-ai-pipeline',
        promptVersion: 'phase-7.8',
        generatedAt: now,
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

  const aiProfile = await extractAiCvIntelligence({
    cvData: session.cvData || {},
    cvRawText: session.cvRawText || '',
    existingProfile: session.aiProfile,
  });
  session.aiProfile = aiProfile;

  const behaviorAnswers = toLegacyBehaviorAnswers({
    answers: unifiedAnswers,
    behaviorPrompts: session.behaviorPrompts || [],
    questionPlan: session.questionPlan || [],
  });

  const behaviorAnalysis = await analyzeBehavior({
    answers: behaviorAnswers,
    cvData: session.cvData || {},
    profileVector: {
      ...(session.profileVector || {}),
      aiProfile,
    },
  });

  const traitVectorOutput = await buildTraitVector({
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
    aiProfile,
  });

  const cognitiveScores = traitVectorOutput.cognitiveVector || {};
  const behaviorVector = toLegacyBehaviorVector({
    behavior: traitVectorOutput.behaviorVector || {},
    traits: traitVectorOutput.oceanVector || {},
  });

  const personalityProfile = evaluatePersonalityProfile({
    cvData: session.cvData || {},
    profileVector: {
      ...(session.profileVector || {}),
      aiProfile,
    },
    traitVectorOutput,
    cognitiveScores,
    behaviorVector,
  });

  const careerOutput = await recommendCareers({
    cvData: session.cvData || {},
    aiProfile,
    personalityProfile,
    profileVector: session.profileVector || {},
    traitVectorOutput,
    cognitiveScores,
    behaviorVector,
  });

  const careerContrast = buildCareerContrast(careerOutput.recommendations || []);

  const narrativeOutput = await generateResultNarrative({
    aiProfile,
    traitVector: personalityProfile.trait_scores || {},
    careers: careerOutput.recommendations || [],
    skills: aiProfile.skills || [],
    cognitiveVector: traitVectorOutput.cognitiveVector || {},
    behaviorVector: traitVectorOutput.behaviorVector || {},
  });

  const consistencyOutput = computeConsistencyScore({ traitVectorOutput });
  const traitVarianceFactor = computeTraitVarianceFactor(personalityProfile.trait_scores || {});
  const top1 = Number(careerOutput?.recommendations?.[0]?.score || 0);
  const top2 = Number(careerOutput?.recommendations?.[1]?.score || 0);

  const confidenceOutput = computeConfidenceScore({
    consistency: consistencyOutput.score,
    trait_variance: traitVarianceFactor,
    coverage: Number(traitVectorOutput.coverage || 0),
    career_gap: clamp((top1 - top2) / 100, 0, 1),
    cv_strength: clamp(Number(aiProfile.confidence || 0.5), 0, 1),
    response_confidence: clamp(Number(traitVectorOutput.responseConfidence || 0.55), 0, 1),
  });

  const heatmapOutput = buildInsightHeatmap({
    traitScores: personalityProfile.trait_scores || {},
    facetVector: traitVectorOutput.facetVector || {},
  });

  const resultDocument = await persistAssessmentResult({
    session,
    unifiedAnswers,
    behaviorAnalysis,
    behaviorVector,
    cognitiveScores,
    personalityProfile,
    careerOutput,
    narrativeOutput,
    careerContrast,
    confidenceOutput,
    consistencyOutput,
    heatmapOutput,
    aiProfile,
  });

  const resultObject = resultDocument.toObject();

  return {
    aiProfile,
    behaviorAnalysis,
    behaviorVector,
    cognitiveScores,
    personalityProfile,
    careerOutput,
    traitVectorOutput,
    resultDocument,
    resultSummary: mapResultToLegacySummary(resultObject),
  };
};

module.exports = {
  generateAssessmentResult,
};
