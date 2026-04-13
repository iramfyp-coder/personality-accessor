const mongoose = require('mongoose');
const AssessmentResult = require('../models/AssessmentResult');
const LegacyAssessmentSession = require('../models/LegacyAssessmentSession');
const Question = require('../models/Question');
const { calculateScores, MODEL_VERSION } = require('../services/scoringEngine');
const { sendSuccess } = require('../utils/response');
const { createHttpError } = require('../utils/httpError');
const {
  getResultReport,
  listResultsByUser,
} = require('../services/assessmentResultView.service');
const { toUnifiedAnswer } = require('../services/assessment/unified-contracts.service');
const { getTraitTrends } = require('../services/analyticsService');

const MIN_SCALE = 1;
const MAX_SCALE = 5;

const toSessionPayload = (session) => ({
  sessionId: session._id,
  answers: (session.answers || []).map((answer) => ({
    questionId: String(answer.questionId),
    value: answer.value,
  })),
  currentQuestionIndex: Array.isArray(session.answers) ? session.answers.length : 0,
  status: session.status,
  startedAt: session.startedAt,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

const normalizeAnswers = ({ answers, allowEmpty = false }) => {
  if (!Array.isArray(answers)) {
    return { error: 'answers must be an array' };
  }

  if (!allowEmpty && answers.length === 0) {
    return { error: 'answers must be a non-empty array' };
  }

  const seenQuestionIds = new Set();
  const normalizedAnswers = [];

  for (const answer of answers) {
    if (!answer || !mongoose.isValidObjectId(answer.questionId)) {
      return { error: 'Each answer must include a valid questionId' };
    }

    const numericValue = Number(answer.value);
    if (
      !Number.isFinite(numericValue) ||
      numericValue < MIN_SCALE ||
      numericValue > MAX_SCALE
    ) {
      return {
        error: `Each answer value must be a number between ${MIN_SCALE} and ${MAX_SCALE}`,
      };
    }

    const questionId = String(answer.questionId);
    if (seenQuestionIds.has(questionId)) {
      return { error: 'Duplicate answers for the same question are not allowed' };
    }

    seenQuestionIds.add(questionId);
    normalizedAnswers.push({ questionId, value: numericValue });
  }

  return { normalizedAnswers };
};

const validateAnswers = (answers) => normalizeAnswers({ answers, allowEmpty: false });

const validateSessionAnswers = (answers) => normalizeAnswers({ answers, allowEmpty: true });

const startAssessmentSession = async (req, res, next) => {
  try {
    const session = await LegacyAssessmentSession.create({
      userId: req.user.id,
      answers: [],
      status: 'in_progress',
      startedAt: new Date(),
      completedAt: null,
    });

    res.setHeader('Deprecation', 'true');

    return sendSuccess(res, {
      status: 201,
      data: {
        sessionId: session._id,
        status: session.status,
        startedAt: session.startedAt,
      },
      message: 'Legacy assessment session started (deprecated)',
    });
  } catch (error) {
    return next(error);
  }
};

const getActiveAssessmentSession = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      throw createHttpError(400, 'Invalid userId');
    }

    if (String(req.user.id) !== String(userId) && req.user.role !== 'admin') {
      throw createHttpError(403, 'Forbidden');
    }

    const session = await LegacyAssessmentSession.findOne({
      userId,
      status: 'in_progress',
    })
      .sort({ updatedAt: -1, startedAt: -1, _id: -1 })
      .select('_id userId answers status startedAt createdAt updatedAt')
      .lean();

    res.setHeader('Deprecation', 'true');

    if (!session) {
      return sendSuccess(res, {
        data: {
          sessionId: null,
          answers: [],
          currentQuestionIndex: 0,
          status: null,
        },
        message: 'No active legacy session found',
      });
    }

    return sendSuccess(res, {
      data: toSessionPayload(session),
      message: 'Active legacy assessment session fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const syncAssessmentSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { answers = [] } = req.body || {};

    if (!mongoose.isValidObjectId(sessionId)) {
      throw createHttpError(400, 'Invalid sessionId');
    }

    const { normalizedAnswers, error } = validateSessionAnswers(answers);

    if (error) {
      throw createHttpError(400, error);
    }

    const session = await LegacyAssessmentSession.findOne({
      _id: sessionId,
      userId: req.user.id,
      status: 'in_progress',
    });

    if (!session) {
      throw createHttpError(404, 'Legacy assessment session not found');
    }

    session.answers = normalizedAnswers;
    await session.save();

    res.setHeader('Deprecation', 'true');

    return sendSuccess(res, {
      data: toSessionPayload(session),
      message: 'Legacy assessment session synced successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const completeAssessmentSession = async ({ sessionId, userId, answers }) => {
  const now = new Date();

  if (sessionId) {
    if (!mongoose.isValidObjectId(sessionId)) {
      throw createHttpError(400, 'Invalid sessionId');
    }

    const existingSession = await LegacyAssessmentSession.findOne({ _id: sessionId, userId });
    if (!existingSession) {
      throw createHttpError(404, 'Legacy assessment session not found');
    }

    if (existingSession.status === 'completed') {
      throw createHttpError(409, 'Legacy assessment session already completed');
    }

    existingSession.answers = answers;
    existingSession.status = 'completed';
    existingSession.completedAt = now;
    await existingSession.save();
    return existingSession;
  }

  return LegacyAssessmentSession.create({
    userId,
    answers,
    status: 'completed',
    startedAt: now,
    completedAt: now,
  });
};

const saveAssessment = async (req, res, next) => {
  try {
    const { answers, sessionId } = req.body;
    const { normalizedAnswers, error } = validateAnswers(answers);

    if (error) {
      throw createHttpError(400, error);
    }

    const questionIds = normalizedAnswers.map((answer) => answer.questionId);

    const questions = await Question.find({ _id: { $in: questionIds } })
      .select('_id domain facetCode keyedDirection reverse')
      .lean();

    if (questions.length !== normalizedAnswers.length) {
      throw createHttpError(400, 'One or more questionIds are invalid');
    }

    const questionsById = new Map(
      questions.map((question) => [String(question._id), question])
    );

    const scoreResult = calculateScores({
      answers: normalizedAnswers,
      questionsById,
    });

    const session = await completeAssessmentSession({
      sessionId,
      userId: req.user.id,
      answers: normalizedAnswers,
    });

    const now = new Date();

    const unifiedAnswers = normalizedAnswers.map((answer) =>
      toUnifiedAnswer({
        questionId: String(answer.questionId),
        type: 'mcq',
        value: answer.value,
        metadata: {
          trait: '',
          difficulty: '',
        },
        answeredAt: now,
      })
    );

    const assessmentResult = await AssessmentResult.findOneAndUpdate(
      { sessionId: session._id },
      {
        $set: {
          userId: req.user.id,
          sessionId: session._id,
          cvData: {
            name: '',
            skills: [],
            subjects: [],
            marks: [],
            projects: [],
            tools: [],
            education: [],
            experience: [],
            interests: [],
            careerSignals: [],
            subjectVector: {},
            skillVector: {},
            interestVector: {},
            confidenceScore: 0.5,
            source: 'heuristic',
            schemaVersion: '1.0.0',
          },
          answers: unifiedAnswers,
          behavior: {
            analysis: {},
            signals: {},
          },
          personality: {
            traits: scoreResult.traits,
            archetypes: {
              personalityType: 'Legacy Big Five',
              dominantTrait: scoreResult.dominantTrait,
              hybridTraitScores: {},
              dominantStrengths: [],
              weaknesses: [],
              behavioralSummary: '',
            },
            consistencyScore: 0.65,
          },
          career: {
            recommendations: [],
            roadmap: [],
            fitScores: {},
          },
          analytics: {
            trendVector: {
              ...scoreResult.traits,
              average: Number(
                (
                  (scoreResult.traits.O +
                    scoreResult.traits.C +
                    scoreResult.traits.E +
                    scoreResult.traits.A +
                    scoreResult.traits.N) /
                  5
                ).toFixed(2)
              ),
            },
            confidence: 0.7,
          },
          schemaVersion: '2.0.0',
          completedAt: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).exec();

    res.setHeader('Deprecation', 'true');

    return sendSuccess(res, {
      status: 201,
      data: {
        assessmentId: assessmentResult._id,
        sessionId: session._id,
        result: {
          traits: scoreResult.traits,
          dominantTrait: scoreResult.dominantTrait,
          facetScores: scoreResult.facetScores,
          modelVersion: MODEL_VERSION,
        },
      },
      message: 'Assessment saved successfully (stored in unified AssessmentResult)',
    });
  } catch (error) {
    return next(error);
  }
};

const getAssessmentsByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const items = await listResultsByUser({
      requester: req.user,
      userId,
    });

    return sendSuccess(res, {
      data: { assessments: items },
      message: 'Assessments fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const getAssessmentReport = async (req, res, next) => {
  try {
    const { assessmentId } = req.params;

    const { report } = await getResultReport({
      requester: req.user,
      assessmentId,
    });

    return sendSuccess(res, {
      data: { report },
      message: 'Assessment report fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const getDashboardSnapshot = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const assessments = await listResultsByUser({
      requester: req.user,
      userId,
    });

    const latestAssessmentId = assessments[0]?.assessmentId
      ? String(assessments[0].assessmentId)
      : '';

    const latestReport = latestAssessmentId
      ? (
          await getResultReport({
            requester: req.user,
            assessmentId: latestAssessmentId,
          })
        ).report
      : null;

    const trends = await getTraitTrends({
      requester: req.user,
      userId,
    });

    return sendSuccess(res, {
      data: {
        assessments,
        latestReport,
        trends,
      },
      message: 'Dashboard snapshot fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  startAssessmentSession,
  getActiveAssessmentSession,
  syncAssessmentSession,
  saveAssessment,
  getAssessmentsByUser,
  getAssessmentReport,
  getDashboardSnapshot,
};
