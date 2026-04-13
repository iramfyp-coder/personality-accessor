const { sendSuccess } = require('../utils/response');
const {
  getTraitTrends,
  compareAssessments,
} = require('../services/analyticsService');

const getAnalyticsTrends = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const trends = await getTraitTrends({
      requester: req.user,
      userId,
    });

    return sendSuccess(res, {
      data: { trends },
      message: 'Trait trends fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const getAssessmentComparison = async (req, res, next) => {
  try {
    const { a: assessmentAId, b: assessmentBId } = req.query;

    const comparisonResult = await compareAssessments({
      requester: req.user,
      assessmentAId,
      assessmentBId,
    });

    return sendSuccess(res, {
      data: comparisonResult,
      message: 'Assessment comparison fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAnalyticsTrends,
  getAssessmentComparison,
};
