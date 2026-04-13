const mongoose = require('mongoose');
const AssessmentResult = require('../models/AssessmentResult');
const { createHttpError } = require('../utils/httpError');
const { generateInsightSnapshot } = require('./insightService');
const { buildCareerContext } = require('./careerEngine');

const TRAIT_KEYS = ['O', 'C', 'E', 'A', 'N'];

const toTraitPayload = (traitScores = {}) => ({
  O: Number(traitScores.O || 0),
  C: Number(traitScores.C || 0),
  E: Number(traitScores.E || 0),
  A: Number(traitScores.A || 0),
  N: Number(traitScores.N || 0),
});

const getDominantTrait = (traits = {}) =>
  TRAIT_KEYS.reduce((best, key) => (traits[key] > traits[best] ? key : best), 'O');

const normalizeCareerRecommendations = (careerRecommendations = []) =>
  (Array.isArray(careerRecommendations) ? careerRecommendations : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const career = String(item.career || '').trim();
      if (!career) {
        return null;
      }

      return {
        career,
        reason: String(item.reason || item.why_fit || '').trim(),
        skillsNeeded: Array.isArray(item.skillsNeeded)
          ? item.skillsNeeded
          : Array.isArray(item.key_skills_to_build)
          ? item.key_skills_to_build
          : [],
        source: item.source || 'adaptive',
        signal: item.signal || null,
      };
    })
    .filter(Boolean);

const toPublicAiReport = (aiReport) => {
  if (!aiReport) {
    return null;
  }

  return {
    summary: String(aiReport.summary || ''),
    strengths: Array.isArray(aiReport.strengths) ? aiReport.strengths : [],
    weaknesses: Array.isArray(aiReport.weaknesses) ? aiReport.weaknesses : [],
    communicationStyle: String(aiReport.communicationStyle || ''),
    workStyle: String(aiReport.workStyle || ''),
    growthSuggestions: Array.isArray(aiReport.growthSuggestions)
      ? aiReport.growthSuggestions
      : [],
    careerRecommendations: normalizeCareerRecommendations(aiReport.careerRecommendations),
  };
};

const toAiReportMeta = (aiReport) => {
  if (!aiReport) {
    return null;
  }

  return {
    model: aiReport.model,
    promptVersion: aiReport.promptVersion,
    generatedAt: aiReport.generatedAt,
  };
};

const toAssessmentReport = (result) => {
  const traits = toTraitPayload(result.personality?.traits || {});
  const aiReport = result.analytics?.aiReport;

  const adaptiveCareer = normalizeCareerRecommendations(result.career?.recommendations || []);
  const careerEngine = adaptiveCareer.length > 0 ? adaptiveCareer : buildCareerContext(traits, 5);

  return {
    assessmentId: result._id,
    sessionId: result.sessionId,
    userId: result.userId,
    traits,
    oceanScores: result.personality?.oceanNormalized || {},
    personalityTypeLabel:
      String(result.personality?.archetypes?.interpretation?.label || '').trim() ||
      String(result.personality?.archetypes?.personalityType || '').trim() ||
      'Analytical',
    dominantTrait:
      String(result.personality?.archetypes?.dominantTrait || '').trim() ||
      getDominantTrait(traits),
    facetScores: {},
    modelVersion: result.schemaVersion || '2.0.0',
    aiReport: toPublicAiReport(aiReport),
    aiReportMeta: toAiReportMeta(aiReport),
    insightEngine: generateInsightSnapshot(traits),
    careerEngine,
    aptitudeSignals: result.career?.aptitudeSignals || {},
    cognitiveScores: result.personality?.cognitiveScores || {},
    behaviorVector: result.behavior?.vector || {},
    careerCluster: result.career?.clusterLabel || result.career?.cluster || '',
    cvData: result.cvData || {},
    analytics: {
      trendVector: result.analytics?.trendVector || {},
      confidence: Number(result.analytics?.confidence || 0),
      confidenceScore: Number(result.analytics?.confidenceScore || 0),
      confidenceBand: String(result.analytics?.confidenceBand || ''),
      confidenceGap: Number(result.analytics?.confidenceGap || 0),
    },
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    completedAt: result.completedAt,
  };
};

const assertReadableUserId = ({ requester, targetUserId }) => {
  if (!mongoose.isValidObjectId(targetUserId)) {
    throw createHttpError(400, 'Invalid userId');
  }

  if (String(requester.id) !== String(targetUserId) && requester.role !== 'admin') {
    throw createHttpError(403, 'Forbidden');
  }
};

const assertResultOwnership = ({ requester, result }) => {
  if (!result) {
    throw createHttpError(404, 'Assessment not found');
  }

  if (String(result.userId) !== String(requester.id) && requester.role !== 'admin') {
    throw createHttpError(403, 'Forbidden');
  }
};

const listResultsByUser = async ({ requester, userId }) => {
  assertReadableUserId({ requester, targetUserId: userId });

  const results = await AssessmentResult.find({ userId })
    .sort({ createdAt: -1 })
    .select('_id sessionId userId personality schemaVersion createdAt updatedAt completedAt')
    .lean();

  return results.map((result) => {
    const traits = toTraitPayload(result.personality?.traits || {});

    return {
      assessmentId: result._id,
      sessionId: result.sessionId,
      traits,
      dominantTrait:
        String(result.personality?.archetypes?.dominantTrait || '').trim() ||
        getDominantTrait(traits),
      modelVersion: result.schemaVersion || '2.0.0',
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      completedAt: result.completedAt,
    };
  });
};

const getResultReport = async ({ requester, assessmentId }) => {
  if (!mongoose.isValidObjectId(assessmentId)) {
    throw createHttpError(400, 'Invalid assessmentId');
  }

  const result = await AssessmentResult.findById(assessmentId).exec();

  assertResultOwnership({ requester, result });

  return {
    result,
    report: toAssessmentReport(result),
  };
};

const getResultByIdForUpdate = async ({ requester, assessmentId }) => {
  if (!mongoose.isValidObjectId(assessmentId)) {
    throw createHttpError(400, 'Invalid assessmentId');
  }

  const result = await AssessmentResult.findById(assessmentId).exec();

  assertResultOwnership({ requester, result });

  return result;
};

module.exports = {
  TRAIT_KEYS,
  toTraitPayload,
  toAssessmentReport,
  normalizeCareerRecommendations,
  toPublicAiReport,
  toAiReportMeta,
  listResultsByUser,
  getResultReport,
  getResultByIdForUpdate,
};
