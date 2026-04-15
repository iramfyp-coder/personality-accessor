const AssessmentResult = require('../models/AssessmentResult');
const User = require('../models/User');
const { sendSuccess } = require('../utils/response');
const { createHttpError } = require('../utils/httpError');
const { analyzeCv } = require('../services/assessment/cvAnalysis.service');
const {
  generateQuestionPlan,
  generateSupplementalQuestionPlan,
  evaluateAdaptiveExtensionNeed,
  adaptUpcomingQuestions,
  computeFatigueMetrics,
  shouldStopAssessmentEarly,
} = require('../services/assessment/question-engine.service');
const {
  enqueueRemainingQuestions,
  isQuestionGenerationPending,
  setQuestionGenerationStatus,
} = require('../services/assessment/question-queue.service');
const {
  getOrCreateInProgressSession,
  getActiveInProgressSession,
  getSessionForUser,
  transitionSessionStage,
  appendProgressEvent,
  toPublicSession,
  toPublicQuestion,
  toPublicQuestionByIndex,
  toPublicBehaviorPrompt,
} = require('../services/assessment/assessment-session.service');
const { generateAssessmentResult } = require('../services/assessment/assessment-result.service');
const { generateCareerChatReply } = require('../services/assessment/career-chatbot.service');
const { explainWhyNotCareer } = require('../services/assessment/career-recommendation.service');
const { generateAssessmentPdfBuffer } = require('../services/assessment/pdf-report.service');
const { streamProgress } = require('../services/assessment/progress-stream.service');
const { interpretTextAnswer } = require('../services/response-parser.service');
const {
  ensureJsonObjectPayload,
  extractSubmittedSessionId,
  extractSubmittedQuestionId,
  extractSubmittedQuestionSequence,
  assertSessionMatch,
  assertQuestionProvided,
} = require('../utils/assessmentRequestValidation');
const {
  getSessionUnifiedAnswers,
  mapResultToLegacySummary,
  normalizeCvData,
  toLegacyBehaviorAnswers,
  toLegacyScaleAnswers,
  upsertUnifiedAnswer,
} = require('../services/assessment/unified-contracts.service');

const MIN_BEHAVIOR_ANSWER_LENGTH = 4;
const MIN_TEXT_ANSWER_LENGTH = 4;
const USER_ROLES = ['student', 'graduate', 'professional'];
const FIRST_QUESTION_BATCH_SIZE = 5;
const TARGET_QUESTION_TOTAL = 22;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toText = (value) => String(value || '').trim();
const toTextList = (value, limit = 24) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, limit);
};
const mergeUniqueTextLists = (...lists) =>
  Array.from(
    new Set(
      lists.flatMap((list) =>
        (Array.isArray(list) ? list : [])
          .map((item) => toText(item))
          .filter(Boolean)
      )
    )
  );

const parseMaybeJsonObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

const toCsvList = (value, limit = 24) => {
  if (Array.isArray(value)) {
    return toTextList(value, limit);
  }

  return String(value || '')
    .split(',')
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeUserRole = (value) => {
  const role = toText(value).toLowerCase();
  return USER_ROLES.includes(role) ? role : '';
};

const normalizeManualMark = (entry = {}) => {
  if (typeof entry === 'string') {
    const [subject, scoreRaw] = entry.split(':');
    const score = Number(scoreRaw);
    const normalizedSubject = toText(subject);

    if (!normalizedSubject) {
      return null;
    }

    return {
      subject: normalizedSubject,
      score: Number.isFinite(score) ? clamp(Math.round(score), 0, 100) : 0,
    };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const subject = toText(entry.subject || entry.name);
  const score = Number(entry.score ?? entry.value ?? entry.marks ?? entry.percentage);

  if (!subject) {
    return null;
  }

  return {
    subject,
    score: Number.isFinite(score) ? clamp(Math.round(score), 0, 100) : 0,
  };
};

const normalizeUserProfile = (raw = {}) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const marksInput = Array.isArray(raw.marks)
    ? raw.marks
    : toCsvList(raw.marks, 24);

  const marks = marksInput
    .map((entry) => normalizeManualMark(entry))
    .filter(Boolean)
    .slice(0, 24);

  const ageNumeric = Number(raw.age);

  return {
    subjects: toCsvList(raw.subjects, 24),
    marks,
    interests: toCsvList(raw.interests, 24),
    skills: toCsvList(raw.skills, 36),
    preferredCareers: toCsvList(raw.preferredCareers || raw.preferred_roles, 24),
    age: Number.isFinite(ageNumeric) ? clamp(Math.round(ageNumeric), 10, 90) : null,
    gender: toText(raw.gender).toLowerCase(),
  };
};

const toCvDataFromProfile = ({ profile = {}, userRole = '' }) =>
  normalizeCvData({
    name: '',
    skills: (profile.skills || []).map((skill) => ({
      name: skill,
      level: 3,
      category: 'manual_input',
    })),
    subjects: profile.subjects || [],
    marks: profile.marks || [],
    interests: profile.interests || [],
    careerSignals: profile.preferredCareers || [],
    education: userRole ? [userRole] : [],
    source: 'heuristic',
  });

const toProfileRawText = ({ profile = {}, userRole = '' }) => {
  const parts = [];
  if (userRole) {
    parts.push(`Role: ${userRole}`);
  }

  if (Array.isArray(profile.subjects) && profile.subjects.length) {
    parts.push(`Subjects: ${profile.subjects.join(', ')}`);
  }

  if (Array.isArray(profile.skills) && profile.skills.length) {
    parts.push(`Skills: ${profile.skills.join(', ')}`);
  }

  if (Array.isArray(profile.interests) && profile.interests.length) {
    parts.push(`Interests: ${profile.interests.join(', ')}`);
  }

  if (Array.isArray(profile.preferredCareers) && profile.preferredCareers.length) {
    parts.push(`Preferred careers: ${profile.preferredCareers.join(', ')}`);
  }

  if (profile.age) {
    parts.push(`Age: ${profile.age}`);
  }

  if (profile.gender) {
    parts.push(`Gender: ${profile.gender}`);
  }

  const marks = Array.isArray(profile.marks)
    ? profile.marks
        .map((mark) => `${toText(mark?.subject)}:${Number(mark?.score || 0)}`)
        .filter((token) => token && !token.startsWith(':'))
    : [];

  if (marks.length) {
    parts.push(`Marks: ${marks.join(', ')}`);
  }

  return parts.join('\n');
};

const toParsedProfileFromCvData = ({ cvData = {}, existingProfile = {} } = {}) => {
  const existingSubjects = Array.isArray(existingProfile.subjects) ? existingProfile.subjects : [];
  const existingSkills = Array.isArray(existingProfile.skills) ? existingProfile.skills : [];
  const existingInterests = Array.isArray(existingProfile.interests) ? existingProfile.interests : [];
  const existingPreferred = Array.isArray(existingProfile.preferredCareers)
    ? existingProfile.preferredCareers
    : [];

  const cvSubjects = Array.isArray(cvData.subjects) ? cvData.subjects : [];
  const cvSkills = Array.isArray(cvData.skills)
    ? cvData.skills.map((skill) => toText(skill?.name || skill)).filter(Boolean)
    : [];
  const cvInterests = Array.isArray(cvData.interests) ? cvData.interests : [];
  const cvPreferred = Array.isArray(cvData.careerSignals)
    ? cvData.careerSignals
    : Array.isArray(cvData.career_signals)
    ? cvData.career_signals
    : [];
  const sourceDomain = toText(cvData.source_domain).replace(/[-_]+/g, ' ');

  const subjects = mergeUniqueTextLists(existingSubjects, cvSubjects).slice(0, 24);
  const skills = mergeUniqueTextLists(existingSkills, cvSkills).slice(0, 36);
  const interests = mergeUniqueTextLists(existingInterests, cvInterests).slice(0, 24);
  const preferredCareers = mergeUniqueTextLists(existingPreferred, cvPreferred).slice(0, 24);

  const explicitField = toText(existingProfile.field);
  const fallbackField = sourceDomain || toText(subjects[0]);

  return {
    field: explicitField || fallbackField || '',
    subjects,
    skills,
    interests,
    preferredCareers,
    age: Number(existingProfile.age) || null,
    gender: toText(existingProfile.gender).toLowerCase(),
    marks: Array.isArray(existingProfile.marks) ? existingProfile.marks : [],
  };
};

const toQuestionIdentity = (question = {}) => toText(question.questionId || question.id);

const prefetchNextQuestion = ({ session }) => {
  const currentIndex = Number(session.currentQuestionIndex || 0);
  const prefetchedQuestion = toPublicQuestionByIndex(session, currentIndex + 1);

  const previousPrefetchedId = toText(session?.adaptiveMetrics?.prefetchedQuestion?.questionId);
  const nextPrefetchedId = toText(prefetchedQuestion?.questionId);

  if (previousPrefetchedId !== nextPrefetchedId) {
    session.adaptiveMetrics = {
      ...(session.adaptiveMetrics || {}),
      prefetchedQuestion,
      prefetchedQuestionId: nextPrefetchedId || '',
      prefetchedAt: new Date(),
    };
  }

  return prefetchedQuestion;
};

const normalizeResponseTimeMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return clamp(Math.round(numeric), 0, 240000);
};

const normalizeRangeValue = ({ value, min = 1, max = 5, fieldName = 'value' }) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw createHttpError(400, `${fieldName} must be a number between ${min} and ${max}`);
  }

  return numeric;
};

const toNormalizedFivePointScore = ({ value, min = 1, max = 5 }) => {
  if (max <= min) {
    return 3;
  }

  const normalized = ((Number(value) - min) / (max - min)) * 4 + 1;
  return clamp(normalized, 1, 5);
};

const hydrateLegacyAnswerViews = (session) => {
  const unifiedAnswers = getSessionUnifiedAnswers(session);
  session.answers = unifiedAnswers;
  session.answersJson = toLegacyScaleAnswers({
    answers: unifiedAnswers,
    questionPlan: session.questionPlan || [],
  });
  session.behaviorAnswers = toLegacyBehaviorAnswers({
    answers: unifiedAnswers,
    behaviorPrompts: session.behaviorPrompts || [],
    questionPlan: session.questionPlan || [],
  });
};

const loadResultForSession = async (session) => {
  const byResultId = session.resultId
    ? await AssessmentResult.findById(session.resultId).exec()
    : null;

  if (byResultId) {
    return byResultId;
  }

  const bySession = await AssessmentResult.findOne({ sessionId: session._id }).exec();

  if (bySession && !session.resultId) {
    session.resultId = bySession._id;
    await session.save();
  }

  return bySession;
};

const findOption = ({ question, optionId, optionLabel }) => {
  const options = Array.isArray(question.options) ? question.options : [];

  if (!options.length) {
    return null;
  }

  const byId = options.find((item) => String(item.id || '').trim() === String(optionId || '').trim());
  if (byId) {
    return byId;
  }

  if (!optionLabel) {
    return null;
  }

  const normalizedLabel = String(optionLabel).trim().toLowerCase();
  return options.find((item) => String(item.label || '').trim().toLowerCase() === normalizedLabel) || null;
};

const normalizeTextFields = ({ text, example, expectsExample }) => {
  const normalizedText = String(text || '').trim();
  const normalizedExample = String(example || '').trim();

  if (normalizedText.length < MIN_TEXT_ANSWER_LENGTH) {
    throw createHttpError(400, `text answer must be at least ${MIN_TEXT_ANSWER_LENGTH} characters`);
  }

  if (expectsExample && normalizedExample.length < MIN_TEXT_ANSWER_LENGTH) {
    throw createHttpError(
      400,
      `example is required for this question and must be at least ${MIN_TEXT_ANSWER_LENGTH} characters`
    );
  }

  return {
    text: normalizedText,
    example: normalizedExample,
  };
};

const toBaseMetadata = (question, normalizedScore = 0, extra = {}) => ({
  trait: question.trait || question.traitTarget || question.traitFocus || '',
  difficulty: question.activeDifficulty || question.difficulty || '',
  category: question.category || '',
  plannerCategory: question.plannerCategory || question.category || '',
  traitTarget: question.trait || question.traitTarget || question.traitFocus || '',
  intent: question.intent || question.intentTag || '',
  intentTag: question.intentTag || question.intent || '',
  stage: question.stage || '',
  theme: question.theme || '',
  answerFormat: question.answerFormat || '',
  scoringType: question.scoringType || '',
  responseTimeMs: normalizeResponseTimeMs(extra.responseTimeMs),
  isNeutral: Boolean(extra.isNeutral),
  isSkipped: Boolean(extra.isSkipped),
  normalizedScore: clamp(Number(normalizedScore || 0), 0, 5),
});

const normalizeQuestionAnswer = async ({ body, question, profileVector }) => {
  const rawType = String(question.type || '').toLowerCase();
  const questionType = ['likert', 'scale', 'mcq', 'text', 'scenario'].includes(rawType)
    ? rawType
    : 'likert';
  const responseTimeMs = normalizeResponseTimeMs(body?.answerTimeMs || body?.responseTimeMs);
  const skipped = Boolean(body?.skipped);
  const answerObject = body?.answer && typeof body.answer === 'object' ? body.answer : {};
  const scalarAnswer =
    body?.answer && typeof body.answer !== 'object' ? body.answer : undefined;

  if (skipped) {
    if (questionType === 'likert') {
      return {
        type: 'likert',
        value: 3,
        metadata: toBaseMetadata(question, 3, {
          responseTimeMs,
          isNeutral: true,
          isSkipped: true,
        }),
        answerValueForAdaptation: 3,
      };
    }

    if (questionType === 'scale') {
      const min = clamp(Number(question.scaleMin || 1), 1, 10);
      const max = clamp(Number(question.scaleMax || 10), Math.max(min + 1, 2), 10);
      const mid = Math.round((min + max) / 2);

      return {
        type: 'scale',
        value: mid,
        metadata: {
          ...toBaseMetadata(question, 3, {
            responseTimeMs,
            isNeutral: true,
            isSkipped: true,
          }),
          scaleMin: min,
          scaleMax: max,
        },
        answerValueForAdaptation: 3,
      };
    }

    if (questionType === 'mcq' || questionType === 'scenario') {
      const fallbackOptions = Array.isArray(question.options) ? question.options : [];
      const option = fallbackOptions[1] || fallbackOptions[0] || null;
      const normalizedScore = option ? normalizeRangeValue({
        value: option.weight || 3,
        min: 1,
        max: 5,
        fieldName: 'option weight',
      }) : 3;

      return {
        type: 'mcq',
        value: {
          optionId: option?.id || 'SKIP',
          optionLabel: option?.label || 'Skipped',
          normalizedScore,
        },
        metadata: toBaseMetadata(question, normalizedScore, {
          responseTimeMs,
          isNeutral: true,
          isSkipped: true,
        }),
        answerValueForAdaptation: normalizedScore,
      };
    }

    return {
      type: 'text',
      value: {
        text: 'Skipped by user',
        example: '',
        normalizedScore: 3,
      },
      metadata: toBaseMetadata(question, 3, {
        responseTimeMs,
        isNeutral: true,
        isSkipped: true,
      }),
      answerValueForAdaptation: 3,
    };
  }

  if (questionType === 'likert') {
    const numericValue = normalizeRangeValue({
      value: body?.value ?? answerObject?.value ?? scalarAnswer,
      min: 1,
      max: 5,
      fieldName: 'value',
    });

    return {
      type: 'likert',
      value: numericValue,
      metadata: toBaseMetadata(question, numericValue, {
        responseTimeMs,
        isNeutral: numericValue === 3,
        isSkipped: false,
      }),
      answerValueForAdaptation: numericValue,
    };
  }

  if (questionType === 'scale') {
    const min = clamp(Number(question.scaleMin || 1), 1, 10);
    const max = clamp(Number(question.scaleMax || 10), Math.max(min + 1, 2), 10);

    const numericValue = normalizeRangeValue({
      value: body?.value ?? answerObject?.value ?? scalarAnswer,
      min,
      max,
      fieldName: 'value',
    });

    const normalizedScore = toNormalizedFivePointScore({
      value: numericValue,
      min,
      max,
    });

    return {
      type: 'scale',
      value: numericValue,
      metadata: {
        ...toBaseMetadata(question, normalizedScore, {
          responseTimeMs,
          isNeutral: Math.abs(normalizedScore - 3) <= 0.2,
          isSkipped: false,
        }),
        scaleMin: min,
        scaleMax: max,
      },
      answerValueForAdaptation: normalizedScore,
    };
  }

  if (questionType === 'mcq' || questionType === 'scenario') {
    const option = findOption({
      question,
      optionId:
        body?.optionId ||
        body?.option_id ||
        answerObject?.optionId ||
        answerObject?.option_id,
      optionLabel:
        body?.optionLabel ||
        body?.option_label ||
        answerObject?.optionLabel ||
        answerObject?.option_label ||
        body?.value ||
        scalarAnswer,
    });

    if (!option && questionType === 'mcq') {
      throw createHttpError(400, 'Valid optionId is required for mcq question');
    }

    if (!option && questionType === 'scenario') {
      const { text, example } = normalizeTextFields({
        text:
          body?.text ||
          answerObject?.text ||
          body?.answer ||
          body?.value ||
          scalarAnswer,
        example: body?.example || answerObject?.example,
        expectsExample: Boolean(question.expectsExample),
      });

      const analysis = await interpretTextAnswer({
        answerText: `${text}\n${example}`.trim(),
        question,
        aiProfile:
          profileVector?.aiProfile ||
          {
            domain: profileVector?.domainCategory || '',
            skills: profileVector?.skillHighlights || [],
            interests: profileVector?.interests || [],
          },
      });

      const normalizedScore = normalizeRangeValue({
        value: analysis.normalized_score || 3,
        min: 1,
        max: 5,
        fieldName: 'analysis score',
      });

      return {
        type: 'text',
        value: {
          text,
          example,
          normalizedScore,
        },
        metadata: {
          ...toBaseMetadata(question, normalizedScore, {
            responseTimeMs,
            isNeutral: Math.abs(normalizedScore - 3) <= 0.2,
            isSkipped: false,
          }),
          analysis,
        },
        answerValueForAdaptation: normalizedScore,
      };
    }

    const normalizedScore = normalizeRangeValue({
      value: option?.weight || 3,
      min: 1,
      max: 5,
      fieldName: 'option weight',
    });

    return {
      type: 'mcq',
      value: {
        optionId: option.id,
        optionLabel: option.label,
        normalizedScore,
      },
      metadata: toBaseMetadata(question, normalizedScore, {
        responseTimeMs,
        isNeutral: Math.abs(normalizedScore - 3) <= 0.2,
        isSkipped: false,
      }),
      answerValueForAdaptation: normalizedScore,
    };
  }

  if (questionType === 'text') {
    const { text, example } = normalizeTextFields({
      text:
        body?.text ||
        answerObject?.text ||
        body?.answer ||
        body?.value ||
        scalarAnswer,
      example: body?.example || answerObject?.example,
      expectsExample: Boolean(question.expectsExample),
    });

    const analysis = await interpretTextAnswer({
      answerText: `${text}\n${example}`.trim(),
      question,
      aiProfile:
        profileVector?.aiProfile ||
        {
          domain: profileVector?.domainCategory || '',
          skills: profileVector?.skillHighlights || [],
          interests: profileVector?.interests || [],
        },
    });

    const normalizedScore = normalizeRangeValue({
      value: analysis.normalized_score || 3,
      min: 1,
      max: 5,
      fieldName: 'analysis score',
    });

    return {
      type: 'text',
      value: {
        text,
        example,
        normalizedScore,
      },
      metadata: {
        ...toBaseMetadata(question, normalizedScore, {
          responseTimeMs,
          isNeutral: Math.abs(normalizedScore - 3) <= 0.2,
          isSkipped: false,
        }),
        analysis,
      },
      answerValueForAdaptation: normalizedScore,
    };
  }

  throw createHttpError(400, `Unsupported question type: ${String(question.type || 'unknown')}`);
};

const finalizeAssessment = async ({ session }) => {
  await appendProgressEvent({
    session,
    event: {
      stage: 'result',
      status: 'processing',
      message: 'Building your personality profile...',
    },
  });

  const resultOutput = await generateAssessmentResult({ session });

  transitionSessionStage({ session, nextStage: 'result' });
  session.status = 'completed';
  session.completedAt = new Date();
  session.lastActiveAt = new Date();
  session.resultId = resultOutput.resultDocument._id;

  // Deprecated denormalized fields are intentionally cleared; AssessmentResult is source of truth.
  session.behaviorAnalysis = undefined;
  session.personalityProfile = undefined;
  session.careerRecommendations = [];
  session.careerRoadmap = [];
  session.resultSummary = undefined;

  await session.save();

  await appendProgressEvent({
    session,
    event: {
      stage: 'result',
      status: 'completed',
      message: 'Assessment result generated successfully',
      meta: {
        resultId: String(resultOutput.resultDocument._id),
      },
    },
  });

  return resultOutput;
};

const uploadCv = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      throw createHttpError(400, 'Please upload a CV file (PDF or DOCX)');
    }

    const session = await getOrCreateInProgressSession({ userId: req.user.id });
    const parsedProfileInput = parseMaybeJsonObject(req.body?.userProfile);
    const normalizedRole = normalizeUserRole(req.body?.userRole);
    const normalizedProfile = normalizeUserProfile(parsedProfileInput);

    await appendProgressEvent({
      session,
      event: {
        stage: 'cv_upload',
        status: 'processing',
        message: 'Analyzing your CV...',
      },
    });

    const analysis = await analyzeCv({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    transitionSessionStage({ session, nextStage: 'cv_upload' });
    session.status = 'in_progress';
    if (normalizedRole) {
      session.userRole = normalizedRole;
    }
    const existingUserProfile =
      session.userProfile && typeof session.userProfile === 'object'
        ? session.userProfile
        : {};
    session.cvRawText = analysis.rawText;
    session.cvData = normalizeCvData(analysis.parsed);
    const parsedProfile = toParsedProfileFromCvData({
      cvData: session.cvData,
      existingProfile: normalizedProfile || existingUserProfile,
    });
    session.userProfile = {
      ...(normalizedProfile || existingUserProfile),
      field: parsedProfile.field,
      subjects: parsedProfile.subjects,
      skills: parsedProfile.skills,
      interests: parsedProfile.interests,
      preferredCareers: parsedProfile.preferredCareers,
      age: parsedProfile.age,
      gender: parsedProfile.gender,
      marks: parsedProfile.marks,
    };
    session.aiProfile = undefined;
    session.profileVector = undefined;
    session.smartIntro = undefined;
    session.questionPlan = [];
    session.questionPoolBackup = [];
    session.askedQuestions = [];
    session.usedIntents = [];
    session.adaptiveMetrics = {
      answerTelemetry: [],
      fatigue: null,
      fatigueDetected: false,
      questionnaireConfidence: 0,
      shouldStopEarly: false,
      targetQuestionCount: 0,
      cvComplexity: 0,
      confidenceExtensionApplied: false,
      inconsistencyExtensionApplied: false,
      extensionReasons: [],
      prefetchedSupplementalQuestionPlan: [],
      evaluatedAt: new Date(),
    };
    session.currentQuestionIndex = 0;
    session.answers = [];
    session.answersJson = [];
    session.behaviorPrompts = [];
    session.currentBehaviorIndex = 0;
    session.behaviorAnswers = [];
    session.resultId = null;
    session.behaviorAnalysis = undefined;
    session.personalityProfile = undefined;
    session.careerRecommendations = [];
    session.careerRoadmap = [];
    session.resultSummary = undefined;
    session.completedAt = null;
    session.lastActiveAt = new Date();

    await session.save();

    await appendProgressEvent({
      session,
      event: {
        stage: 'cv_upload',
        status: 'completed',
        message: 'CV analyzed successfully',
      },
    });

    return sendSuccess(res, {
      status: 201,
      data: {
        session: toPublicSession(session),
        cvData: session.cvData,
        parsedProfile,
      },
      message: 'CV uploaded and analyzed successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const startAdaptiveAssessment = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId;
    const skipCv = Boolean(req.body?.skipCv);
    const normalizedRole = normalizeUserRole(req.body?.userRole);
    const normalizedProfile = normalizeUserProfile(parseMaybeJsonObject(req.body?.userProfile));

    const session = sessionId
      ? await getSessionForUser({ sessionId, user: req.user })
      : await getOrCreateInProgressSession({ userId: req.user.id });

    if (normalizedRole) {
      session.userRole = normalizedRole;
    }

    if (normalizedProfile) {
      session.userProfile = normalizedProfile;
    }

    if (skipCv) {
      const profileToUse = session.userProfile || normalizedProfile || {};
      const roleToUse = session.userRole || normalizedRole || '';
      session.cvData = toCvDataFromProfile({
        profile: profileToUse,
        userRole: roleToUse,
      });
      session.cvRawText = toProfileRawText({
        profile: profileToUse,
        userRole: roleToUse,
      });
      session.aiProfile = undefined;
      session.lastActiveAt = new Date();
    }

    if (!session.cvData || !session.cvRawText) {
      throw createHttpError(400, 'Please upload CV or complete manual profile before starting assessment');
    }

    await appendProgressEvent({
      session,
      event: {
        stage: 'questionnaire',
        status: 'processing',
        message: 'Preparing your personalized questions…',
      },
    });

    const user = await User.findById(req.user.id).select('_id askedQuestions').lean().exec();

    const questionOutput = await generateQuestionPlan({
      cvData: session.cvData,
      cvRawText: session.cvRawText || '',
      askedQuestions: user?.askedQuestions || [],
      aiProfile: session.aiProfile || undefined,
      targetCount: FIRST_QUESTION_BATCH_SIZE,
      includeSupplemental: false,
    });

    if (user) {
      const existing = Array.isArray(user.askedQuestions) ? user.askedQuestions : [];
      const incoming = Array.isArray(questionOutput.askedQuestionMemory)
        ? questionOutput.askedQuestionMemory
        : [];

      const bySignature = new Map();
      existing.forEach((item) => {
        if (item?.signature) {
          bySignature.set(String(item.signature), item);
        }
      });

      incoming.forEach((item) => {
        if (!item?.signature) {
          return;
        }

        bySignature.set(String(item.signature), {
          signature: item.signature,
          text: item.text || '',
          category: item.category || '',
          intent: item.intent || '',
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
      });

      const nextAskedQuestions = Array.from(bySignature.values()).slice(-600);
      await User.updateOne(
        { _id: req.user.id },
        {
          $set: {
            askedQuestions: nextAskedQuestions,
          },
        }
      ).exec();
    }

    session.profileVector = questionOutput.profileVector;
    session.aiProfile = questionOutput.aiProfile || undefined;
    session.smartIntro = questionOutput.smartIntro;
    session.questionPlan = questionOutput.questionPlan;
    session.questionPoolBackup = questionOutput.questionPoolBackup;
    session.usedIntents = Array.isArray(questionOutput.usedIntents) ? questionOutput.usedIntents : [];
    session.askedQuestions = [];
    session.currentQuestionIndex = 0;
    session.answers = [];
    session.answersJson = [];
    session.behaviorPrompts = [];
    session.currentBehaviorIndex = 0;
    session.behaviorAnswers = [];
    session.adaptiveMetrics = {
      answerTelemetry: [],
      fatigue: null,
      fatigueDetected: false,
      questionnaireConfidence: 0,
      shouldStopEarly: false,
      consistencyScore: 0,
      targetQuestionCount: TARGET_QUESTION_TOTAL,
      cvComplexity: Number(questionOutput.cvComplexity || 0),
      confidenceExtensionApplied: false,
      inconsistencyExtensionApplied: false,
      extensionReasons: [],
      prefetchedSupplementalQuestionPlan: [],
      questionGeneration: {
        status: 'queued',
        targetTotal: TARGET_QUESTION_TOTAL,
        generatedCount: Array.isArray(questionOutput.questionPlan) ? questionOutput.questionPlan.length : 0,
        initialBatchSize: FIRST_QUESTION_BATCH_SIZE,
        updatedAt: new Date(),
      },
      evaluatedAt: new Date(),
    };
    session.status = 'in_progress';
    transitionSessionStage({ session, nextStage: 'questionnaire' });
    session.lastActiveAt = new Date();
    const prefetchedQuestion = prefetchNextQuestion({ session });

    await session.save();

    await appendProgressEvent({
      session,
      event: {
        stage: 'questionnaire',
        status: 'completed',
        message: `First questions ready (${session.questionPlan.length}). Remaining questions will keep preparing in background.`,
        meta: {
          generated: session.questionPlan.length,
          targetTotal: TARGET_QUESTION_TOTAL,
        },
      },
    });

    enqueueRemainingQuestions({
      sessionId: session._id,
      userId: req.user.id,
      targetTotal: TARGET_QUESTION_TOTAL,
    });

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        question: toPublicQuestion(session),
        prefetchedQuestion,
        queue: {
          mode: 'background',
          generated: session.questionPlan.length,
          targetTotal: TARGET_QUESTION_TOTAL,
          status: 'running',
        },
      },
      message: 'Adaptive assessment started successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const getCurrentQuestion = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    if (session.stage === 'questionnaire') {
      const currentQuestion = toPublicQuestion(session);

      if (!currentQuestion && isQuestionGenerationPending(session)) {
        enqueueRemainingQuestions({
          sessionId: session._id,
          userId: req.user.id,
          targetTotal: Number(session.adaptiveMetrics?.targetQuestionCount || TARGET_QUESTION_TOTAL),
        });

        return sendSuccess(res, {
          data: {
            session: toPublicSession(session),
            question: null,
            prefetchedQuestion: null,
            waitingForNextQuestion: true,
            next: 'questionnaire',
          },
          message: 'Preparing next question…',
        });
      }

      const prefetchedQuestion = prefetchNextQuestion({ session });
      session.lastActiveAt = new Date();
      await session.save();

      return sendSuccess(res, {
        data: {
          session: toPublicSession(session),
          question: currentQuestion,
          prefetchedQuestion,
          next: 'questionnaire',
        },
        message: 'Current adaptive question fetched',
      });
    }

    if (session.stage === 'behavior') {
      return sendSuccess(res, {
        data: {
          session: toPublicSession(session),
          behaviorPrompt: toPublicBehaviorPrompt(session),
          next: 'behavior',
        },
        message: 'Current behavior prompt fetched',
      });
    }

    const result = await loadResultForSession(session);

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        result: result ? mapResultToLegacySummary(result.toObject()) : null,
        next: 'result',
      },
      message: 'Assessment already completed',
    });
  } catch (error) {
    return next(error);
  }
};

const getPreviousQuestion = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    if (session.stage !== 'questionnaire') {
      throw createHttpError(409, 'Previous question navigation is only available during questionnaire stage');
    }

    const currentIndex = Number(session.currentQuestionIndex || 0);
    session.currentQuestionIndex = clamp(currentIndex - 1, 0, Math.max((session.questionPlan || []).length - 1, 0));
    const prefetchedQuestion = prefetchNextQuestion({ session });
    session.lastActiveAt = new Date();
    await session.save();

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        question: toPublicQuestion(session),
        prefetchedQuestion,
        movedBack: session.currentQuestionIndex !== currentIndex,
        next: 'questionnaire',
      },
      message: 'Previous question loaded',
    });
  } catch (error) {
    return next(error);
  }
};

const answerAdaptiveQuestion = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    if (session.stage === 'questionnaire') {
      const payload = ensureJsonObjectPayload(req.body);
      const submittedSessionId = extractSubmittedSessionId(payload);
      assertSessionMatch({
        submittedSessionId,
        activeSessionId: session._id,
      });
      const submittedQuestionId = extractSubmittedQuestionId(payload);
      assertQuestionProvided({ submittedQuestionId });

      const currentQuestion = toPublicQuestion(session);

      if (!currentQuestion) {
        throw createHttpError(409, 'Questionnaire is already complete for this session');
      }

      const currentQuestionId = toQuestionIdentity(currentQuestion);
      const submittedSequence = extractSubmittedQuestionSequence(payload);
      const isCurrentQuestionId = submittedQuestionId === currentQuestionId;

      const existingAnswer = getSessionUnifiedAnswers(session).find(
        (answer) => toText(answer.questionId) === submittedQuestionId
      );

      if (!isCurrentQuestionId && existingAnswer) {
        // Idempotent recovery path for delayed duplicate submits from previously answered questions.
        hydrateLegacyAnswerViews(session);
        const prefetchedQuestion = prefetchNextQuestion({ session });
        session.lastActiveAt = new Date();
        await session.save();

        return sendSuccess(res, {
          data: {
            session: toPublicSession(session),
            question: toPublicQuestion(session),
            prefetchedQuestion,
            completedQuestionnaire: false,
            staleSubmissionRecovered: true,
            adaptiveConfidence: Number(session.adaptiveMetrics?.questionnaireConfidence || 0),
          },
          message: 'Answer already recorded. Returning current question.',
        });
      }

      if (!isCurrentQuestionId) {
        throw createHttpError(400, 'Submitted question does not match current question');
      }

      let fatigueSnapshot = session.adaptiveMetrics?.fatigue || null;

      const normalized = await normalizeQuestionAnswer({
        body: payload,
        question: currentQuestion,
        profileVector: session.profileVector || {},
      });

      const upsertResult = upsertUnifiedAnswer({
        answers: session.answers || [],
        answer: {
          questionId: currentQuestionId,
          type: normalized.type,
          value: normalized.value,
          metadata: normalized.metadata,
          answeredAt: new Date(),
        },
      });

      session.answers = upsertResult.answers;

      const previousTelemetry = Array.isArray(session.adaptiveMetrics?.answerTelemetry)
        ? session.adaptiveMetrics.answerTelemetry
        : [];

      const nextTelemetryEntry = {
        questionId: currentQuestionId,
        responseTimeMs: Number(normalized.metadata?.responseTimeMs || 0),
        isNeutral: Boolean(normalized.metadata?.isNeutral),
        isSkipped: Boolean(normalized.metadata?.isSkipped),
        stage: currentQuestion.stage || '',
        sequence: Number.isFinite(submittedSequence) ? submittedSequence : currentQuestion.sequence,
        answeredAt: new Date().toISOString(),
      };

      const existingTelemetryIndex = previousTelemetry.findIndex(
        (item) => String(item?.questionId || '') === String(currentQuestionId)
      );

      const nextTelemetry =
        existingTelemetryIndex >= 0
          ? previousTelemetry.map((item, index) =>
              index === existingTelemetryIndex ? nextTelemetryEntry : item
            )
          : [...previousTelemetry, nextTelemetryEntry];

      fatigueSnapshot = computeFatigueMetrics({
        answerTelemetry: nextTelemetry,
        totalQuestions: Array.isArray(session.questionPlan) ? session.questionPlan.length : 0,
      });

      session.questionPlan = adaptUpcomingQuestions({
        session,
        answeredQuestionId: currentQuestionId,
        fatigueState: fatigueSnapshot,
      });
      session.currentQuestionIndex = Math.min(
        Number(session.currentQuestionIndex || 0) + 1,
        Array.isArray(session.questionPlan) ? session.questionPlan.length : Number(session.currentQuestionIndex || 0) + 1
      );

      session.adaptiveMetrics = {
        ...(session.adaptiveMetrics || {}),
        answerTelemetry: nextTelemetry.slice(-400),
        fatigue: fatigueSnapshot,
        fatigueDetected: Boolean(fatigueSnapshot?.isFatigued),
      };

      session.askedQuestions = [...(session.askedQuestions || []), currentQuestionId].slice(-400);

      const intent = String(currentQuestion.intentTag || currentQuestion.intent || '').trim();
      if (intent) {
        const existingIntents = Array.isArray(session.usedIntents) ? session.usedIntents : [];
        if (!existingIntents.includes(intent)) {
          session.usedIntents = [...existingIntents, intent].slice(-300);
        }
      }

      hydrateLegacyAnswerViews(session);
      session.lastActiveAt = new Date();

      const reachedEnd = session.currentQuestionIndex >= (session.questionPlan || []).length;
      const targetQuestionCount = Math.max(
        Number(session.adaptiveMetrics?.targetQuestionCount || TARGET_QUESTION_TOTAL),
        TARGET_QUESTION_TOTAL
      );
      const stillExpectingQuestions = Array.isArray(session.questionPlan)
        ? session.questionPlan.length < targetQuestionCount
        : true;
      const generationPending = isQuestionGenerationPending(session);

      if (reachedEnd && stillExpectingQuestions) {
        if (!generationPending) {
          setQuestionGenerationStatus({
            session,
            status: 'queued',
            targetTotal: targetQuestionCount,
          });
        }

        enqueueRemainingQuestions({
          sessionId: session._id,
          userId: req.user.id,
          targetTotal: targetQuestionCount,
        });

        await session.save();

        return sendSuccess(res, {
          data: {
            session: toPublicSession(session),
            question: toPublicQuestion(session),
            prefetchedQuestion: null,
            waitingForNextQuestion: true,
            completedQuestionnaire: false,
            adaptiveConfidence: Number(session.adaptiveMetrics?.questionnaireConfidence || 0),
          },
          message: 'Preparing next question…',
        });
      }

      const extensionSignal = reachedEnd && !stillExpectingQuestions
        ? evaluateAdaptiveExtensionNeed({ session })
        : { extraQuestions: 0, reasons: [], confidence: 0, inconsistency: { inconsistencyScore: 0 } };

      if (reachedEnd && extensionSignal.extraQuestions > 0) {
        await appendProgressEvent({
          session,
          event: {
            stage: 'questionnaire',
            status: 'processing',
            message: extensionSignal.refiningMessage || 'Refining your profile for better accuracy…',
            meta: {
              extraQuestions: extensionSignal.extraQuestions,
              reasons: extensionSignal.reasons,
            },
          },
        });

        const cachedSupplemental = Array.isArray(
          session.adaptiveMetrics?.prefetchedSupplementalQuestionPlan
        )
              ? session.adaptiveMetrics.prefetchedSupplementalQuestionPlan
              .slice(0, extensionSignal.extraQuestions)
              .filter(Boolean)
          : [];

        const supplemental =
          cachedSupplemental.length === extensionSignal.extraQuestions
            ? cachedSupplemental
            : await generateSupplementalQuestionPlan({
                cvData: session.cvData || {},
                cvRawText: session.cvRawText || '',
                askedQuestions: session.askedQuestions || [],
                existingQuestionPlan: session.questionPlan || [],
                additionalCount: extensionSignal.extraQuestions,
                aiProfile: session.aiProfile || undefined,
              });

        if (supplemental.length > 0) {
          session.questionPlan = [...(session.questionPlan || []), ...supplemental];
          session.questionPoolBackup = [
            ...(Array.isArray(session.questionPoolBackup) ? session.questionPoolBackup : []),
            ...supplemental.map((question) => ({
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
            })),
          ].slice(-240);

          const nextExtensionReasons = Array.from(
            new Set([
              ...(Array.isArray(session.adaptiveMetrics?.extensionReasons)
                ? session.adaptiveMetrics.extensionReasons
                : []),
              ...extensionSignal.reasons,
            ])
          );

          const prefetchedQuestion = prefetchNextQuestion({ session });

          session.adaptiveMetrics = {
            ...(session.adaptiveMetrics || {}),
            questionnaireConfidence: Number(extensionSignal.confidence || 0),
            consistencyScore: Number(extensionSignal.inconsistency?.inconsistencyScore || 0),
            targetQuestionCount: session.questionPlan.length,
            confidenceExtensionApplied:
              Boolean(session.adaptiveMetrics?.confidenceExtensionApplied) ||
              extensionSignal.reasons.includes('low_confidence'),
            inconsistencyExtensionApplied: Boolean(session.adaptiveMetrics?.inconsistencyExtensionApplied),
            extensionReasons: nextExtensionReasons,
            shouldStopEarly: false,
            evaluatedAt: new Date(),
            refinementMessage: extensionSignal.refiningMessage || '',
            prefetchedSupplementalQuestionPlan: [],
          };

          await session.save();

          await appendProgressEvent({
            session,
            event: {
              stage: 'questionnaire',
              status: 'completed',
              message: `Questionnaire extended by ${supplemental.length} questions for deeper confidence.`,
              meta: {
                totalQuestions: session.questionPlan.length,
                reasons: extensionSignal.reasons,
              },
            },
          });

          return sendSuccess(res, {
            data: {
              session: toPublicSession(session),
              question: toPublicQuestion(session),
              prefetchedQuestion,
              completedQuestionnaire: false,
              adaptiveConfidence: Number(extensionSignal.confidence || 0),
              extensionApplied: true,
              extensionReasons: extensionSignal.reasons,
              refiningProfile: true,
              refiningMessage: extensionSignal.refiningMessage || 'Refining your profile for better accuracy…',
            },
            message:
              extensionSignal.refiningMessage || 'Question answer recorded. Additional adaptive questions added.',
          });
        }
      }

      const stopSignalRaw = shouldStopAssessmentEarly({ session });
      const stopSignal = stillExpectingQuestions
        ? { ...stopSignalRaw, shouldStop: false }
        : stopSignalRaw;
      session.adaptiveMetrics = {
        ...(session.adaptiveMetrics || {}),
        fatigue: fatigueSnapshot || session.adaptiveMetrics?.fatigue || null,
        fatigueDetected: Boolean(
          (fatigueSnapshot && fatigueSnapshot.isFatigued) ||
            session.adaptiveMetrics?.fatigue?.isFatigued
        ),
        questionnaireConfidence: Number(stopSignal.confidence || 0),
        shouldStopEarly: Boolean(stopSignal.shouldStop),
        consistencyScore: Number(extensionSignal.inconsistency?.inconsistencyScore || session.adaptiveMetrics?.consistencyScore || 0),
        targetQuestionCount: Math.max(
          Number(session.questionPlan?.length || 0),
          Number(session.adaptiveMetrics?.targetQuestionCount || 0),
          TARGET_QUESTION_TOTAL
        ),
        evaluatedAt: new Date(),
      };
      const shouldFinalize = (reachedEnd && !stillExpectingQuestions) || stopSignal.shouldStop;

      if (shouldFinalize) {
        const resultOutput = await finalizeAssessment({ session });

        return sendSuccess(res, {
          data: {
            session: toPublicSession(session),
            result: resultOutput.resultSummary,
            completedQuestionnaire: true,
            completedAssessment: true,
            stoppedEarly: Boolean(stopSignal.shouldStop),
            adaptiveConfidence: Number(stopSignal.confidence || 0),
            resultId: resultOutput.resultDocument._id,
          },
          message: existingAnswer
            ? 'Question answer already recorded. Assessment is complete.'
            : stopSignal.shouldStop
            ? 'Question answer recorded. Assessment completed early with high confidence.'
            : 'Question answer recorded. Assessment completed successfully.',
        });
      }

      const prefetchedQuestion = prefetchNextQuestion({ session });
      await session.save();

      return sendSuccess(res, {
        data: {
          session: toPublicSession(session),
          question: toPublicQuestion(session),
          prefetchedQuestion,
          completedQuestionnaire: false,
          adaptiveConfidence: Number(stopSignal.confidence || 0),
        },
        message: 'Question answer recorded successfully',
      });
    }

    if (session.stage === 'behavior') {
      // Backward-compatible behavior stage support for existing in-progress sessions.
      const payload = ensureJsonObjectPayload(req.body);
      const promptId = String(payload.promptId || '').trim();
      const text = String(payload.text || '').trim();

      if (!promptId) {
        throw createHttpError(400, 'promptId is required');
      }

      if (text.length < MIN_BEHAVIOR_ANSWER_LENGTH) {
        throw createHttpError(
          400,
          `Behavior response must be at least ${MIN_BEHAVIOR_ANSWER_LENGTH} characters`
        );
      }

      const existingAnswer = getSessionUnifiedAnswers(session).find(
        (answer) => answer.type === 'behavior' && answer.questionId === promptId
      );

      const prompt = toPublicBehaviorPrompt(session);

      if (!existingAnswer) {
        if (!prompt) {
          throw createHttpError(409, 'Behavior section is already complete');
        }

        if (promptId !== prompt.promptId) {
          throw createHttpError(400, 'Submitted prompt does not match current behavior prompt');
        }

        const upsertResult = upsertUnifiedAnswer({
          answers: session.answers || [],
          answer: {
            questionId: prompt.promptId,
            type: 'behavior',
            value: text,
            metadata: {
              trait: '',
              difficulty: '',
              category: 'personality',
              traitTarget: 'N',
              normalizedScore: 3,
            },
            answeredAt: new Date(),
          },
        });

        session.answers = upsertResult.answers;

        if (upsertResult.inserted) {
          session.currentBehaviorIndex += 1;
        }
      }

      hydrateLegacyAnswerViews(session);
      session.lastActiveAt = new Date();

      const reachedEnd =
        session.currentBehaviorIndex >=
        (Array.isArray(session.behaviorPrompts) ? session.behaviorPrompts.length : 0);

      if (!reachedEnd) {
        await session.save();

        return sendSuccess(res, {
          data: {
            session: toPublicSession(session),
            behaviorPrompt: toPublicBehaviorPrompt(session),
            completedBehavior: false,
          },
          message: existingAnswer
            ? 'Behavior response already recorded. Returning next prompt.'
            : 'Behavior response recorded successfully',
        });
      }

      const resultOutput = await finalizeAssessment({ session });

      return sendSuccess(res, {
        data: {
          session: toPublicSession(session),
          result: resultOutput.resultSummary,
          completedBehavior: true,
          completedAssessment: true,
          resultId: resultOutput.resultDocument._id,
        },
        message: existingAnswer
          ? 'Behavior response was already recorded. Assessment is complete.'
          : 'Behavior response recorded. Assessment completed successfully.',
      });
    }

    const result = await loadResultForSession(session);

    if (!result) {
      throw createHttpError(409, 'Assessment is already completed for this session');
    }

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        result: mapResultToLegacySummary(result.toObject()),
        completedAssessment: true,
      },
      message: 'Assessment already completed for this session',
    });
  } catch (error) {
    return next(error);
  }
};

const getAssessmentResult = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    const result = await loadResultForSession(session);

    if (!result) {
      throw createHttpError(409, 'Assessment result is not ready yet');
    }

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        result: mapResultToLegacySummary(result.toObject()),
        resultId: result._id,
        history: session.chatHistory || [],
      },
      message: 'Assessment result fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const downloadAssessmentResultPdf = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    const result = await loadResultForSession(session);

    if (!result) {
      throw createHttpError(409, 'Assessment result is not ready yet');
    }

    const summary = mapResultToLegacySummary(result.toObject());
    const pdfBuffer = generateAssessmentPdfBuffer({ resultSummary: summary });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=\"career-intelligence-report-${String(session._id)}.pdf\"`
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
};

const getActiveFlowSession = async (req, res, next) => {
  try {
    const session = await getActiveInProgressSession({ userId: req.user.id });

    if (!session) {
      return sendSuccess(res, {
        data: {
          session: null,
          question: null,
          behaviorPrompt: null,
        },
        message: 'No active assessment flow session found',
      });
    }

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        question: toPublicQuestion(session),
        behaviorPrompt: toPublicBehaviorPrompt(session),
      },
      message: 'Active assessment flow session fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const getFlowSessionById = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    return sendSuccess(res, {
      data: {
        session: toPublicSession(session),
        question: toPublicQuestion(session),
        behaviorPrompt: toPublicBehaviorPrompt(session),
      },
      message: 'Assessment flow session fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const streamAssessmentProgress = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    streamProgress({
      req,
      res,
      sessionId: String(session._id),
      initialEvents: session.progressEvents || [],
    });
  } catch (error) {
    return next(error);
  }
};

const careerChat = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    const result = await loadResultForSession(session);

    if (!result) {
      throw createHttpError(409, 'Chat is available after assessment result is generated');
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      throw createHttpError(400, 'message is required');
    }

    const reply = await generateCareerChatReply({
      session,
      result: result.toObject(),
      message,
    });

    session.chatHistory = [
      ...(session.chatHistory || []),
      {
        role: 'user',
        message,
        createdAt: new Date(),
      },
      {
        role: 'assistant',
        message: reply,
        createdAt: new Date(),
      },
    ];

    session.lastActiveAt = new Date();
    await session.save();

    return sendSuccess(res, {
      data: {
        sessionId: session._id,
        answer: reply,
        history: session.chatHistory,
      },
      message: 'Career assistant response generated successfully',
    });
  } catch (error) {
    return next(error);
  }
};

const explainWhyNotCareerForSession = async (req, res, next) => {
  try {
    const session = await getSessionForUser({
      sessionId: req.params.id,
      user: req.user,
    });

    const result = await loadResultForSession(session);

    if (!result) {
      throw createHttpError(409, 'Assessment result is required before using why-not analysis');
    }

    const career = String(req.body?.career || req.body?.careerName || req.query?.career || '').trim();
    if (!career) {
      throw createHttpError(400, 'career is required');
    }

    const resultObject = result.toObject();

    const explanation = explainWhyNotCareer({
      careerName: career,
      recommendations: resultObject?.career?.recommendations || [],
      traitScores: resultObject?.personality?.traits || {},
      cognitiveScores: resultObject?.personality?.cognitiveScores || {},
      behaviorVector: resultObject?.behavior?.vector || {},
      aptitudeSignals: resultObject?.career?.aptitudeSignals || {},
    });

    return sendSuccess(res, {
      data: {
        sessionId: session._id,
        explanation,
      },
      message: 'Why-not career explanation generated successfully',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadCv,
  startAdaptiveAssessment,
  getCurrentQuestion,
  getPreviousQuestion,
  answerAdaptiveQuestion,
  getAssessmentResult,
  downloadAssessmentResultPdf,
  getActiveFlowSession,
  getFlowSessionById,
  streamAssessmentProgress,
  careerChat,
  explainWhyNotCareerForSession,
};
