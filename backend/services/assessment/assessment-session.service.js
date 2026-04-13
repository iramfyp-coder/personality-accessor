const mongoose = require('mongoose');
const AssessmentSession = require('../../models/AssessmentSession');
const { createHttpError } = require('../../utils/httpError');
const { emitProgress } = require('./progress-stream.service');
const {
  getSessionUnifiedAnswers,
  isValidStageTransition,
  normalizeCvData,
} = require('./unified-contracts.service');

const assertValidObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw createHttpError(400, `Invalid ${fieldName}`);
  }
};

const ensureUnifiedAnswers = async (session) => {
  if (!session) {
    return session;
  }

  const unifiedAnswers = getSessionUnifiedAnswers(session);
  const existingLength = Array.isArray(session.answers) ? session.answers.length : 0;

  if (unifiedAnswers.length > existingLength) {
    session.answers = unifiedAnswers;
    await session.save();
  }

  return session;
};

const getOrCreateInProgressSession = async ({ userId }) => {
  assertValidObjectId(userId, 'userId');

  const existing = await AssessmentSession.findOne({
    userId,
    status: 'in_progress',
  })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .exec();

  if (existing) {
    existing.lastActiveAt = new Date();
    await existing.save();
    return ensureUnifiedAnswers(existing);
  }

  try {
    const created = await AssessmentSession.create({
      userId,
      status: 'in_progress',
      stage: 'cv_upload',
      cvData: normalizeCvData({}),
      lastActiveAt: new Date(),
      startedAt: new Date(),
    });

    return created;
  } catch (error) {
    if (error?.code === 11000) {
      const winner = await AssessmentSession.findOne({ userId, status: 'in_progress' })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .exec();

      if (winner) {
        winner.lastActiveAt = new Date();
        await winner.save();
        return ensureUnifiedAnswers(winner);
      }
    }

    throw error;
  }
};

const getActiveInProgressSession = async ({ userId }) => {
  assertValidObjectId(userId, 'userId');

  const session = await AssessmentSession.findOne({
    userId,
    status: 'in_progress',
  })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .exec();

  return ensureUnifiedAnswers(session);
};

const getSessionForUser = async ({ sessionId, user }) => {
  assertValidObjectId(sessionId, 'sessionId');

  const session = await AssessmentSession.findById(sessionId).exec();

  if (!session) {
    throw createHttpError(404, 'Assessment session not found');
  }

  const isOwner = String(session.userId) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw createHttpError(403, 'Forbidden');
  }

  session.lastActiveAt = new Date();
  await session.save();

  return ensureUnifiedAnswers(session);
};

const transitionSessionStage = ({ session, nextStage }) => {
  if (!isValidStageTransition({ from: session.stage, to: nextStage })) {
    throw createHttpError(
      409,
      `Invalid stage transition from ${session.stage} to ${String(nextStage)}`
    );
  }

  session.stage = nextStage;
};

const appendProgressEvent = async ({ session, event }) => {
  const nextSequence = Number(session.lastEventId || 0) + 1;
  const createdAt = new Date();

  const nextEvent = {
    eventId: `${String(session._id)}:${nextSequence}`,
    stage: String(event.stage || session.stage || 'assessment'),
    status: String(event.status || 'info'),
    message: String(event.message || ''),
    meta: event.meta && typeof event.meta === 'object' ? event.meta : undefined,
    createdAt,
  };

  session.lastEventId = nextSequence;
  session.progressEvents = [...(session.progressEvents || []), nextEvent].slice(-300);
  session.lastActiveAt = new Date();

  await session.save();

  emitProgress({
    sessionId: String(session._id),
    event: {
      ...nextEvent,
      createdAt: nextEvent.createdAt.toISOString(),
    },
  });

  return nextEvent;
};

const toPublicQuestion = (session) => {
  const totalQuestions = Array.isArray(session.questionPlan) ? session.questionPlan.length : 0;
  const currentIndex = Number(session.currentQuestionIndex || 0);

  if (currentIndex >= totalQuestions) {
    return null;
  }

  const question = session.questionPlan[currentIndex];

  if (!question) {
    return null;
  }

  const rawType = String(question.type || '').toLowerCase();
  const normalizedType = ['likert', 'scale', 'mcq', 'text', 'scenario'].includes(rawType)
    ? rawType
    : 'likert';
  const stage = String(question.stage || 'personality').toLowerCase();

  return {
    id: question.id || question.questionId,
    index: currentIndex,
    sequence: currentIndex + 1,
    total: totalQuestions,
    questionId: question.questionId || question.id,
    text: question.text,
    type: normalizedType,
    category: question.category || 'personality',
    plannerCategory: question.plannerCategory || question.category || 'personality',
    intent: question.intent || '',
    trait: question.trait || question.traitTarget || question.traitFocus || '',
    difficulty: question.activeDifficulty || question.difficulty,
    answerFormat: question.answerFormat || '',
    scoringType: question.scoringType || '',
    stage,
    stageHeader: `${stage.toUpperCase()} ANALYSIS`,
    uiHint: question.uiHint || '',
    expectedLength: Number(question.expectedLength || 0),
    traitFocus: question.traitFocus,
    traitTarget: question.traitTarget || question.traitFocus,
    expectsExample: Boolean(question.expectsExample),
    options: Array.isArray(question.options) ? question.options : [],
    scaleMin: Number(question.scaleMin || 1),
    scaleMax: Number(question.scaleMax || (normalizedType === 'scale' ? 10 : 5)),
    expectedAnswer: question.expectedAnswer,
    scenario: question.scenario || '',
    theme: question.theme || 'personality',
  };
};

const toPublicBehaviorPrompt = (session) => {
  const totalPrompts = Array.isArray(session.behaviorPrompts)
    ? session.behaviorPrompts.length
    : 0;

  const currentIndex = Number(session.currentBehaviorIndex || 0);

  if (currentIndex >= totalPrompts) {
    return null;
  }

  const prompt = session.behaviorPrompts[currentIndex];

  if (!prompt) {
    return null;
  }

  return {
    index: currentIndex,
    total: totalPrompts,
    promptId: prompt.promptId,
    prompt: prompt.prompt,
  };
};

const toPublicSession = (session) => {
  const answers = getSessionUnifiedAnswers(session);

  return {
    sessionId: session._id,
    status: session.status,
    stage: session.stage,
    userRole: session.userRole || '',
    userProfile: session.userProfile || null,
    answers: answers.map((answer) => ({
      questionId: answer.questionId,
      type: answer.type,
      answer: answer.value,
      value: answer.value,
      metadata: {
        trait: answer.metadata?.trait || '',
        difficulty: answer.metadata?.difficulty || '',
        intent: answer.metadata?.intent || '',
        stage: answer.metadata?.stage || '',
        theme: answer.metadata?.theme || '',
        answerFormat: answer.metadata?.answerFormat || '',
        scoringType: answer.metadata?.scoringType || '',
        responseTimeMs: Number(answer.metadata?.responseTimeMs || 0),
        isNeutral: Boolean(answer.metadata?.isNeutral),
        isSkipped: Boolean(answer.metadata?.isSkipped),
      },
    })),
    currentQuestionIndex: Number(session.currentQuestionIndex || 0),
    totalQuestions: Array.isArray(session.questionPlan) ? session.questionPlan.length : 0,
    currentBehaviorIndex: Number(session.currentBehaviorIndex || 0),
    totalBehaviorPrompts: Array.isArray(session.behaviorPrompts)
      ? session.behaviorPrompts.length
      : 0,
    answersCount: answers.filter((answer) => answer.type !== 'behavior').length,
    behaviorAnswersCount: answers.filter((answer) => answer.type === 'behavior').length,
    cvData: session.cvData || null,
    askedQuestions: Array.isArray(session.askedQuestions) ? session.askedQuestions : [],
    usedIntents: Array.isArray(session.usedIntents) ? session.usedIntents : [],
    adaptiveMetrics: session.adaptiveMetrics || {},
    smartIntro: session.smartIntro || null,
    resultId: session.resultId || null,
    lastActiveAt: session.lastActiveAt,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    expiresAt: session.expiresAt,
  };
};

module.exports = {
  getOrCreateInProgressSession,
  getActiveInProgressSession,
  getSessionForUser,
  transitionSessionStage,
  appendProgressEvent,
  toPublicSession,
  toPublicQuestion,
  toPublicBehaviorPrompt,
};
