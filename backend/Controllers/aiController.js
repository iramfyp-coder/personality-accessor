const { createHttpError } = require('../utils/httpError');
const { sendSuccess } = require('../utils/response');
const { generatePersonalityReport } = require('../services/aiService');
const { generateInsightSnapshot } = require('../services/insightService');
const { buildCareerContext } = require('../services/careerEngine');
const {
  getResultByIdForUpdate,
  normalizeCareerRecommendations,
  toAiReportMeta,
  toPublicAiReport,
  toTraitPayload,
} = require('../services/assessmentResultView.service');

const generateAssessmentAiReport = async (req, res, next) => {
  try {
    const { assessmentId } = req.params;

    if (!assessmentId) {
      throw createHttpError(400, 'Invalid assessmentId');
    }

    const forceRefresh = ['1', 'true', 'yes'].includes(
      String(req.query.forceRefresh || '').toLowerCase()
    );

    const assessmentResult = await getResultByIdForUpdate({
      requester: req.user,
      assessmentId,
    });

    const traits = toTraitPayload(assessmentResult.personality?.traits || {});
    const deterministicInsights = generateInsightSnapshot(traits);
    const adaptiveCareer = normalizeCareerRecommendations(
      assessmentResult.career?.recommendations || []
    );
    const careerEngine = adaptiveCareer.length > 0 ? adaptiveCareer : buildCareerContext(traits, 5);

    const existingAiReport = assessmentResult.analytics?.aiReport;

    if (existingAiReport && !forceRefresh) {
      return sendSuccess(res, {
        data: {
          assessmentId: assessmentResult._id,
          cached: true,
          aiReport: toPublicAiReport(existingAiReport),
          aiReportMeta: toAiReportMeta(existingAiReport),
          insightEngine: deterministicInsights,
          careerEngine,
        },
        message: 'Cached AI report returned successfully',
      });
    }

    const generatedReport = await generatePersonalityReport(traits, {});

    assessmentResult.analytics = {
      ...(assessmentResult.analytics || {}),
      aiReport: {
        summary: generatedReport.summary,
        strengths: generatedReport.strengths,
        weaknesses: generatedReport.weaknesses,
        communicationStyle: generatedReport.communicationStyle,
        workStyle: generatedReport.workStyle,
        growthSuggestions: generatedReport.growthSuggestions,
        careerRecommendations: generatedReport.careerRecommendations,
        model: generatedReport.metadata.model,
        promptVersion: generatedReport.metadata.promptVersion,
        generatedAt: new Date(generatedReport.metadata.generatedAt),
      },
    };

    if (Array.isArray(generatedReport.careerRecommendations)) {
      assessmentResult.career = {
        ...(assessmentResult.career || {}),
        recommendations: generatedReport.careerRecommendations,
      };
    }

    await assessmentResult.save();

    return sendSuccess(res, {
      data: {
        assessmentId: assessmentResult._id,
        cached: false,
        aiReport: toPublicAiReport(assessmentResult.analytics?.aiReport),
        aiReportMeta: {
          ...toAiReportMeta(assessmentResult.analytics?.aiReport),
          usage: generatedReport.metadata.usage,
        },
        insightEngine: generatedReport.deterministicInsights,
        careerEngine: normalizeCareerRecommendations(
          assessmentResult.career?.recommendations || generatedReport.staticCareerMatches
        ),
      },
      message: 'AI report generated successfully',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  generateAssessmentAiReport,
};
