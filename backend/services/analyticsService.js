const mongoose = require('mongoose');
const AssessmentResult = require('../models/AssessmentResult');
const { createHttpError } = require('../utils/httpError');
const { TRAIT_KEYS, toTraitPayload } = require('./assessmentResultView.service');

const assertReadableUserId = ({ requester, targetUserId }) => {
  if (!mongoose.isValidObjectId(targetUserId)) {
    throw createHttpError(400, 'Invalid userId');
  }

  if (String(requester.id) !== String(targetUserId) && requester.role !== 'admin') {
    throw createHttpError(403, 'Forbidden');
  }
};

const getTraitTrends = async ({ requester, userId }) => {
  assertReadableUserId({ requester, targetUserId: userId });

  const results = await AssessmentResult.find({ userId })
    .sort({ createdAt: 1 })
    .select('_id userId personality createdAt')
    .lean();

  return results.map((result) => ({
    assessmentId: result._id,
    date: result.createdAt,
    traits: toTraitPayload(result.personality?.traits || {}),
  }));
};

const validateComparisonIds = ({ assessmentAId, assessmentBId }) => {
  if (!mongoose.isValidObjectId(assessmentAId)) {
    throw createHttpError(400, 'Invalid assessment id: a');
  }

  if (!mongoose.isValidObjectId(assessmentBId)) {
    throw createHttpError(400, 'Invalid assessment id: b');
  }
};

const assertAssessmentOwnership = ({ requester, result }) => {
  if (!result) {
    throw createHttpError(404, 'Assessment not found');
  }

  if (String(result.userId) !== String(requester.id) && requester.role !== 'admin') {
    throw createHttpError(403, 'Forbidden');
  }
};

const compareAssessments = async ({ requester, assessmentAId, assessmentBId }) => {
  validateComparisonIds({ assessmentAId, assessmentBId });

  const [assessmentA, assessmentB] = await Promise.all([
    AssessmentResult.findById(assessmentAId)
      .select('_id userId personality createdAt')
      .lean(),
    AssessmentResult.findById(assessmentBId)
      .select('_id userId personality createdAt')
      .lean(),
  ]);

  assertAssessmentOwnership({ requester, result: assessmentA });
  assertAssessmentOwnership({ requester, result: assessmentB });

  if (String(assessmentA.userId) !== String(assessmentB.userId)) {
    throw createHttpError(400, 'Assessments must belong to the same user');
  }

  const traitsA = toTraitPayload(assessmentA.personality?.traits || {});
  const traitsB = toTraitPayload(assessmentB.personality?.traits || {});

  const comparison = TRAIT_KEYS.reduce((accumulator, traitKey) => {
    const difference = Number((traitsB[traitKey] - traitsA[traitKey]).toFixed(2));
    accumulator[traitKey] = difference;
    return accumulator;
  }, {});

  return {
    assessmentA: {
      id: assessmentA._id,
      createdAt: assessmentA.createdAt,
      traits: traitsA,
    },
    assessmentB: {
      id: assessmentB._id,
      createdAt: assessmentB.createdAt,
      traits: traitsB,
    },
    comparison,
  };
};

module.exports = {
  getTraitTrends,
  compareAssessments,
};
