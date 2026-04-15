const AssessmentSession = require('../../models/AssessmentSession');
const User = require('../../models/User');
const { appendProgressEvent } = require('./assessment-session.service');
const { generateSupplementalQuestionPlan } = require('./question-engine.service');

const DEFAULT_TARGET_TOTAL = 22;
const QUEUE_CLEANUP_DELAY_MS = 5 * 60 * 1000;

const runningJobs = new Map();

const toText = (value) => String(value || '').trim();

const toQuestionPoolBackupItem = (question = {}) => ({
  id: question.id,
  questionId: question.questionId,
  text: question.text,
  type: question.type,
  category: question.category,
  trait: question.trait,
  difficulty: question.difficulty,
  answerFormat: question.answerFormat,
  scoringType: question.scoringType,
  stage: question.stage,
  theme: question.theme,
  contextBucket: question.contextBucket,
  uiHint: question.uiHint,
  expectedLength: question.expectedLength,
  options: question.options,
  scaleMin: question.scaleMin,
  scaleMax: question.scaleMax,
  expectedAnswer: question.expectedAnswer,
  intent: question.intent,
  intentTag: question.intentTag || question.intent,
  signature: question.memorySignature,
});

const mergeAskedQuestionMemory = async ({ userId, questions = [] }) => {
  if (!userId || !Array.isArray(questions) || !questions.length) {
    return;
  }

  const user = await User.findById(userId).select('_id askedQuestions').lean().exec();
  if (!user) {
    return;
  }

  const incoming = questions
    .map((question) => ({
      signature: toText(question.memorySignature),
      text: toText(question.text),
      category: toText(question.category),
      intent: toText(question.intentTag || question.intent),
      createdAt: new Date(),
    }))
    .filter((item) => item.signature);

  if (!incoming.length) {
    return;
  }

  const bySignature = new Map();
  (Array.isArray(user.askedQuestions) ? user.askedQuestions : []).forEach((item) => {
    const signature = toText(item?.signature);
    if (!signature) {
      return;
    }

    bySignature.set(signature, item);
  });

  incoming.forEach((item) => {
    bySignature.set(item.signature, item);
  });

  const nextAskedQuestions = Array.from(bySignature.values()).slice(-600);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        askedQuestions: nextAskedQuestions,
      },
    }
  ).exec();
};

const normalizeTargetTotal = (value) => {
  const parsed = Number(value || DEFAULT_TARGET_TOTAL);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TARGET_TOTAL;
  }

  return Math.max(1, Math.round(parsed));
};

const isQuestionGenerationPending = (session = {}) => {
  const generation = session?.adaptiveMetrics?.questionGeneration || {};
  const status = String(generation.status || '').toLowerCase();
  const targetTotal = normalizeTargetTotal(generation.targetTotal || session?.adaptiveMetrics?.targetQuestionCount);
  const currentCount = Array.isArray(session?.questionPlan) ? session.questionPlan.length : 0;

  return (status === 'queued' || status === 'running') && currentCount < targetTotal;
};

const setQuestionGenerationStatus = ({ session, status, targetTotal }) => {
  const currentCount = Array.isArray(session.questionPlan) ? session.questionPlan.length : 0;
  const nextTarget = normalizeTargetTotal(
    targetTotal ||
      session?.adaptiveMetrics?.questionGeneration?.targetTotal ||
      session?.adaptiveMetrics?.targetQuestionCount
  );

  session.adaptiveMetrics = {
    ...(session.adaptiveMetrics || {}),
    targetQuestionCount: nextTarget,
    questionGeneration: {
      ...(session?.adaptiveMetrics?.questionGeneration || {}),
      status,
      targetTotal: nextTarget,
      generatedCount: currentCount,
      updatedAt: new Date(),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    },
  };
};

const executeQueueJob = async ({ sessionId, userId, targetTotal }) => {
  const queueKey = String(sessionId);

  let session = await AssessmentSession.findById(sessionId).exec();
  if (!session || session.status !== 'in_progress' || session.stage !== 'questionnaire') {
    runningJobs.delete(queueKey);
    return;
  }

  setQuestionGenerationStatus({ session, status: 'running', targetTotal });
  await session.save();

  await appendProgressEvent({
    session,
    event: {
      stage: 'questionnaire',
      status: 'processing',
      message: 'Preparing your personalized questions…',
      meta: {
        generated: Array.isArray(session.questionPlan) ? session.questionPlan.length : 0,
        targetTotal: normalizeTargetTotal(targetTotal),
      },
    },
  });

  const existingPlan = Array.isArray(session.questionPlan) ? session.questionPlan : [];
  const desiredTotal = normalizeTargetTotal(targetTotal);
  const remainingCount = Math.max(0, desiredTotal - existingPlan.length);

  if (!remainingCount) {
    setQuestionGenerationStatus({ session, status: 'completed', targetTotal: desiredTotal });
    await session.save();
    runningJobs.delete(queueKey);
    return;
  }

  const generated = await generateSupplementalQuestionPlan({
    cvData: session.cvData || {},
    cvRawText: session.cvRawText || '',
    askedQuestions: session.askedQuestions || [],
    existingQuestionPlan: existingPlan,
    additionalCount: remainingCount,
    aiProfile: session.aiProfile || undefined,
  });

  session = await AssessmentSession.findById(sessionId).exec();
  if (!session || session.status !== 'in_progress' || session.stage !== 'questionnaire') {
    runningJobs.delete(queueKey);
    return;
  }

  const currentPlan = Array.isArray(session.questionPlan) ? session.questionPlan : [];
  const existingIds = new Set(currentPlan.map((item) => toText(item?.questionId || item?.id)).filter(Boolean));

  const uniqueGenerated = generated.filter((item) => {
    const id = toText(item?.questionId || item?.id);
    if (!id || existingIds.has(id)) {
      return false;
    }

    existingIds.add(id);
    return true;
  });

  if (uniqueGenerated.length) {
    session.questionPlan = [...currentPlan, ...uniqueGenerated];
    session.questionPoolBackup = [
      ...(Array.isArray(session.questionPoolBackup) ? session.questionPoolBackup : []),
      ...uniqueGenerated.map((question) => toQuestionPoolBackupItem(question)),
    ].slice(-260);

    const usedIntents = new Set(Array.isArray(session.usedIntents) ? session.usedIntents : []);
    uniqueGenerated.forEach((question) => {
      const intent = toText(question.intentTag || question.intent);
      if (intent) {
        usedIntents.add(intent);
      }
    });
    session.usedIntents = Array.from(usedIntents).slice(-320);
  }

  setQuestionGenerationStatus({ session, status: 'completed', targetTotal: desiredTotal });
  session.lastActiveAt = new Date();
  await session.save();

  await appendProgressEvent({
    session,
    event: {
      stage: 'questionnaire',
      status: 'completed',
      message: `Question queue ready (${session.questionPlan.length} questions).`,
      meta: {
        generated: session.questionPlan.length,
        targetTotal: desiredTotal,
      },
    },
  });

  await mergeAskedQuestionMemory({ userId, questions: uniqueGenerated });
  runningJobs.delete(queueKey);
};

const enqueueRemainingQuestions = ({ sessionId, userId, targetTotal = DEFAULT_TARGET_TOTAL }) => {
  const queueKey = String(sessionId || '');
  if (!queueKey) {
    return false;
  }

  const current = runningJobs.get(queueKey);
  if (current && (current.status === 'queued' || current.status === 'running')) {
    return false;
  }

  runningJobs.set(queueKey, {
    status: 'queued',
    startedAt: new Date(),
  });

  setTimeout(async () => {
    const job = runningJobs.get(queueKey);
    if (!job) {
      return;
    }

    job.status = 'running';

    try {
      await executeQueueJob({
        sessionId,
        userId,
        targetTotal,
      });
    } catch (error) {
      try {
        const session = await AssessmentSession.findById(sessionId).exec();
        if (session) {
          setQuestionGenerationStatus({
            session,
            status: 'failed',
            targetTotal,
          });
          session.adaptiveMetrics = {
            ...(session.adaptiveMetrics || {}),
            questionGeneration: {
              ...(session?.adaptiveMetrics?.questionGeneration || {}),
              status: 'failed',
              errorMessage: toText(error?.message || 'Background question generation failed'),
              updatedAt: new Date(),
            },
          };
          await session.save();
          await appendProgressEvent({
            session,
            event: {
              stage: 'questionnaire',
              status: 'error',
              message: 'Background question generation is delayed. Retrying automatically.',
            },
          });
        }
      } catch (_) {
        // no-op
      }
    } finally {
      const activeJob = runningJobs.get(queueKey);
      if (activeJob) {
        activeJob.status = 'completed';
      }

      setTimeout(() => {
        runningJobs.delete(queueKey);
      }, QUEUE_CLEANUP_DELAY_MS);
    }
  }, 0);

  return true;
};

module.exports = {
  enqueueRemainingQuestions,
  isQuestionGenerationPending,
  setQuestionGenerationStatus,
};
