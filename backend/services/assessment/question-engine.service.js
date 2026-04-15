const {
  extractAiCvIntelligence,
  normalizeAiProfile,
} = require('../ai-cv-intelligence.service');
const {
  computeQuestionCoverage,
  FACET_LIBRARY,
  TRAITS,
} = require('../question-coverage.service');
const {
  generateAdaptiveQuestion,
  toQuestionPlanItem,
  DIFFICULTY_LEVELS,
} = require('../ai-question-generator.service');

const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior'];
const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

const BASE_QUESTION_COUNT = 22;
const MAX_QUESTION_COUNT = 26;
const QUESTION_EXTENSION_STEP = 4;
const LOW_CONFIDENCE_EXTENSION_THRESHOLD = 0.74;

const INTENT_POOL = Object.entries(FACET_LIBRARY).flatMap(([trait, facets]) =>
  (Array.isArray(facets) ? facets : []).map((facet) => `${trait.toLowerCase()}_${facet}`)
);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toText = (value) => String(value || '').trim();
const toWords = (value = '') =>
  toText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const toQuestionSignature = (value = '') => {
  const crypto = require('crypto');
  return crypto
    .createHash('sha1')
    .update(String(value || '').toLowerCase().replace(/\s+/g, ' ').trim())
    .digest('hex');
};

const toSkillDominance = (skills = []) =>
  (Array.isArray(skills) ? skills : []).reduce((accumulator, skill) => {
    const category = toText(skill?.category || 'general').toLowerCase() || 'general';
    accumulator[category] = Number(accumulator[category] || 0) + Number(skill?.level || 1);
    return accumulator;
  }, {});

const inferYearsOfExperience = (experience = []) => {
  const lines = Array.isArray(experience) ? experience : [];
  const years = lines.reduce((max, line) => {
    const match = String(line || '').match(/(\d+)\+?\s*(?:years|yrs|year)/i);
    if (!match) {
      return max;
    }
    return Math.max(max, Number(match[1] || 0));
  }, 0);

  return years;
};

const buildUserProfileVector = (cvData = {}, aiProfile = {}) => {
  const normalizedAiProfile = normalizeAiProfile(aiProfile || {});
  const skills = (Array.isArray(cvData.skills) ? cvData.skills : [])
    .map((skill) => toText(skill?.name || skill))
    .filter(Boolean)
    .slice(0, 16);

  const interests = (Array.isArray(cvData.interests) ? cvData.interests : [])
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, 10);

  const yearsOfExperience = inferYearsOfExperience(cvData.experience || []);

  return {
    aiProfile: normalizedAiProfile,
    domainCategory: toText(normalizedAiProfile.domain || cvData.source_domain || 'general'),
    domainRole: `${toText(normalizedAiProfile.domain || 'general')} professional`,
    experience:
      normalizedAiProfile.experience_level === 'senior'
        ? 'senior'
        : normalizedAiProfile.experience_level === 'mid'
        ? 'mid'
        : 'entry',
    experienceLevel: normalizedAiProfile.experience_level,
    yearsOfExperience,
    skillHighlights: skills,
    interests,
    skillDominance: toSkillDominance(cvData.skills || []),
    cvSignals: {
      domain: normalizedAiProfile.domain,
      skills: normalizedAiProfile.skills,
      subjects: normalizedAiProfile.subjects,
      interests: normalizedAiProfile.interests,
      tools: normalizedAiProfile.tools,
      careerSignals: normalizedAiProfile.career_signals,
      behaviorSignals: normalizedAiProfile.behavior_signals,
    },
    subjectVector: cvData.subjectVector || {},
    skillVector: cvData.skillVector || {},
    interestVector: cvData.interestVector || {},
  };
};

const computeCvComplexity = ({ cvData = {}, aiProfile = {} } = {}) => {
  const skillsCount = Array.isArray(cvData.skills) ? cvData.skills.length : 0;
  const projectsCount = Array.isArray(cvData.projects) ? cvData.projects.length : 0;
  const experienceCount = Array.isArray(cvData.experience) ? cvData.experience.length : 0;
  const interestsCount = Array.isArray(cvData.interests) ? cvData.interests.length : 0;

  const weighted = skillsCount * 1.9 + projectsCount * 1.5 + experienceCount * 2.2 + interestsCount * 1.1;
  const aiConfidence = clamp(Number(aiProfile?.confidence || 0.5), 0, 1);

  return Number(clamp(weighted / 42, 0, 1).toFixed(4)) * 0.78 + aiConfidence * 0.22;
};

const buildAskedMemory = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item) {
        return null;
      }

      if (typeof item === 'string') {
        return {
          signature: toQuestionSignature(item),
          text: item,
        };
      }

      const text = toText(item?.text || item?.question || '');
      if (!text) {
        return null;
      }

      return {
        signature: toText(item.signature) || toQuestionSignature(text),
        text,
      };
    })
    .filter(Boolean);

const buildAdaptiveQuestionSet = async ({
  aiProfile = {},
  existingQuestions = [],
  askedQuestions = [],
  targetCount = BASE_QUESTION_COUNT,
  baseIndex = 0,
}) => {
  const generated = [];
  const typeCycle = ['mcq', 'likert', 'slider', 'text'];
  const usedSignatures = new Set(
    (Array.isArray(existingQuestions) ? existingQuestions : [])
      .map((item) => toText(item?.memorySignature || toQuestionSignature(item?.text || '')))
      .filter(Boolean)
  );
  const memory = [
    ...buildAskedMemory(askedQuestions),
    ...buildAskedMemory(existingQuestions),
  ];

  for (let index = 0; index < targetCount; index += 1) {
    const questionIndex = baseIndex + index;

    const coverage = computeQuestionCoverage({
      questionPlan: [...existingQuestions, ...generated],
      questionIndex,
      targetCount: baseIndex + targetCount,
      aiProfile,
    });

    const generatedQuestion = await generateAdaptiveQuestion({
      aiProfile,
      askedQuestions: memory,
      traitCoverage: coverage,
      difficultyProgression: coverage.difficultyProgression,
      questionIndex,
      targetCount: baseIndex + targetCount,
      forceAnswerType:
        baseIndex === 0 && questionIndex < 8
          ? typeCycle[questionIndex % typeCycle.length]
          : undefined,
    });

    const planItem = toQuestionPlanItem({
      generated: generatedQuestion,
      aiProfile,
      index: questionIndex,
    });

    let signature = toText(planItem.memorySignature || toQuestionSignature(planItem.text || ''));
    let dedupeAttempt = 0;
    while (usedSignatures.has(signature) && dedupeAttempt < 3) {
      dedupeAttempt += 1;
      const words = toWords(String(planItem.text || '').replace(/\?+$/, ''));
      if (words.length > 0) {
        words[0] = `${words[0]}-${questionIndex + 1}-${dedupeAttempt}`;
      }
      const patchedText = `${words.join(' ').replace(/\?+$/, '')}?`;
      planItem.text = patchedText;
      signature = toQuestionSignature(patchedText);
      planItem.memorySignature = signature;
    }

    usedSignatures.add(signature);

    generated.push(planItem);
    memory.push({
      signature,
      text: planItem.text,
    });
  }

  return generated;
};

const generateQuestionPlan = async ({
  cvData = {},
  cvRawText = '',
  askedQuestions = [],
  targetCount = BASE_QUESTION_COUNT,
  aiProfile,
  includeSupplemental = true,
} = {}) => {
  const resolvedTarget = clamp(Number(targetCount || BASE_QUESTION_COUNT), 1, BASE_QUESTION_COUNT);

  const resolvedAiProfile = await extractAiCvIntelligence({
    cvData,
    cvRawText,
    existingProfile: aiProfile,
  });

  const profileVector = buildUserProfileVector(cvData, resolvedAiProfile);

  const questionPlan = await buildAdaptiveQuestionSet({
    aiProfile: resolvedAiProfile,
    existingQuestions: [],
    askedQuestions,
    targetCount: resolvedTarget,
    baseIndex: 0,
  });

  const prefetchedSupplementalQuestionPlan = includeSupplemental
    ? await buildAdaptiveQuestionSet({
        aiProfile: resolvedAiProfile,
        existingQuestions: questionPlan,
        askedQuestions: [...askedQuestions, ...questionPlan],
        targetCount: QUESTION_EXTENSION_STEP,
        baseIndex: questionPlan.length,
      })
    : [];

  const usedIntents = questionPlan.map((question) => toText(question.intentTag || question.intent)).filter(Boolean);

  return {
    aiProfile: resolvedAiProfile,
    profileVector,
    questionPlan,
    prefetchedSupplementalQuestionPlan,
    questionPoolBackup: [...questionPlan, ...prefetchedSupplementalQuestionPlan],
    usedIntents,
    askedQuestionMemory: questionPlan.map((question) => ({
      signature: question.memorySignature,
      text: question.text,
      category: question.category,
      intent: question.intentTag || question.intent,
      stage: question.stage,
      theme: question.theme,
      createdAt: new Date().toISOString(),
    })),
    smartIntro: {
      greeting: `Your adaptive assessment is grounded in ${profileVector.domainRole} context (${profileVector.experienceLevel} level).`,
      focus:
        'Questions adapt to your CV intelligence, trait coverage gaps, and confidence signals in real time.',
      distribution: {
        total: questionPlan.length,
        cvDomain: resolvedAiProfile.domain,
        targetTraits: TRAITS,
      },
    },
    targetQuestionCount: resolvedTarget,
    cvComplexity: Number(computeCvComplexity({ cvData, aiProfile: resolvedAiProfile }).toFixed(4)),
    psychometricDiagnostics: {
      adaptive: true,
      source: 'ai_only',
    },
  };
};

const generateSupplementalQuestionPlan = async ({
  cvData = {},
  cvRawText = '',
  askedQuestions = [],
  existingQuestionPlan = [],
  additionalCount = QUESTION_EXTENSION_STEP,
  aiProfile,
}) => {
  const existing = Array.isArray(existingQuestionPlan) ? existingQuestionPlan : [];
  const allowed = clamp(Number(additionalCount || 0), 0, MAX_QUESTION_COUNT - existing.length);

  if (!allowed) {
    return [];
  }

  const resolvedAiProfile = await extractAiCvIntelligence({
    cvData,
    cvRawText,
    existingProfile: aiProfile,
  });

  return buildAdaptiveQuestionSet({
    aiProfile: resolvedAiProfile,
    existingQuestions: existing,
    askedQuestions,
    targetCount: allowed,
    baseIndex: existing.length,
  });
};

const toAnswerNormalizedScore = ({ answer = {}, question = {} }) => {
  const type = String(question?.type || answer?.type || '').toLowerCase();

  if (type === 'scale' || type === 'slider') {
    const raw = Number(answer?.value);
    const min = Number(question?.scaleMin || answer?.metadata?.scaleMin || 1);
    const max = Number(question?.scaleMax || answer?.metadata?.scaleMax || 10);

    if (Number.isFinite(raw) && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return clamp(((raw - min) / (max - min)) * 4 + 1, 1, 5);
    }

    return 3;
  }

  const direct = Number(
    answer?.value?.normalizedScore ?? answer?.metadata?.normalizedScore ?? answer?.value ?? 3
  );

  return Number.isFinite(direct) ? clamp(direct, 1, 5) : 3;
};

const computeAdaptiveConfidence = ({ answers = [], questionPlan = [] }) => {
  const normalizedAnswers = (Array.isArray(answers) ? answers : []).filter(
    (answer) => String(answer?.type || '').toLowerCase() !== 'behavior'
  );

  if (!normalizedAnswers.length) {
    return 0;
  }

  const byQuestionId = new Map(
    (Array.isArray(questionPlan) ? questionPlan : []).map((question) => [
      String(question.questionId || question.id || ''),
      question,
    ])
  );

  const scores = normalizedAnswers.map((answer) => {
    const question = byQuestionId.get(String(answer.questionId || ''));
    return toAnswerNormalizedScore({
      answer,
      question,
    });
  });

  const avg = scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1);
  const variance = scores.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(scores.length, 1);
  const consistency = clamp(1 - variance / 2.2, 0, 1);
  const decisiveness =
    scores.reduce((sum, value) => sum + Math.abs(value - 3) / 2, 0) / Math.max(scores.length, 1);
  const coverage = clamp(
    normalizedAnswers.length / Math.max((Array.isArray(questionPlan) ? questionPlan.length : BASE_QUESTION_COUNT) || 1, 1),
    0,
    1
  );

  const confidence = clamp(consistency * 0.45 + decisiveness * 0.2 + coverage * 0.35, 0, 1);
  return Number(confidence.toFixed(4));
};

const computeFatigueMetrics = ({ answerTelemetry = [], totalQuestions = BASE_QUESTION_COUNT }) => {
  const telemetry = Array.isArray(answerTelemetry) ? answerTelemetry : [];

  if (!telemetry.length) {
    return {
      averageAnswerTimeMs: 0,
      neutralRate: 0,
      skipRate: 0,
      shortResponseRate: 0,
      isFatigued: false,
      fatigueMode: null,
    };
  }

  const timeValues = telemetry
    .map((item) => Number(item?.responseTimeMs || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  const averageAnswerTimeMs = timeValues.length
    ? Math.round(timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length)
    : 0;

  const neutralRate =
    telemetry.filter((item) => Boolean(item?.isNeutral)).length / Math.max(telemetry.length, 1);
  const skipRate =
    telemetry.filter((item) => Boolean(item?.isSkipped)).length / Math.max(Number(totalQuestions || 1), 1);
  const shortResponseRate =
    timeValues.filter((value) => value < 2600).length / Math.max(timeValues.length, 1);

  const isFatigued = telemetry.length >= 5 && (shortResponseRate >= 0.72 || averageAnswerTimeMs < 2400);

  return {
    averageAnswerTimeMs,
    neutralRate: Number(clamp(neutralRate, 0, 1).toFixed(4)),
    skipRate: Number(clamp(skipRate, 0, 1).toFixed(4)),
    shortResponseRate: Number(clamp(shortResponseRate, 0, 1).toFixed(4)),
    isFatigued,
    fatigueMode: isFatigued ? 'quick_choice' : null,
  };
};

const adaptUpcomingQuestions = ({ session }) => {
  const plan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];
  return plan;
};

const detectAnswerInconsistency = ({ answers = [], questionPlan = [] }) => {
  const byQuestionId = new Map(
    (Array.isArray(questionPlan) ? questionPlan : []).map((question) => [
      String(question.questionId || question.id || ''),
      question,
    ])
  );

  const byTrait = TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = [];
    return accumulator;
  }, {});

  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    if (String(answer?.type || '').toLowerCase() === 'behavior') {
      return;
    }

    const question = byQuestionId.get(String(answer.questionId || ''));
    const trait = String(question?.traitFocus || question?.trait || 'O').toUpperCase().charAt(0);
    const normalizedTrait = TRAITS.includes(trait) ? trait : 'O';

    byTrait[normalizedTrait].push(toAnswerNormalizedScore({
      answer,
      question,
    }));
  });

  const contradictions = [];
  let aggregateVariance = 0;
  let countedTraits = 0;

  TRAITS.forEach((trait) => {
    const values = byTrait[trait];
    if (!values.length) {
      return;
    }

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;

    aggregateVariance += variance;
    countedTraits += 1;

    if (variance >= 2.2 && values.length >= 2) {
      contradictions.push(`Trait ${trait} shows inconsistent responses across similar intents.`);
    }
  });

  const averageVariance = countedTraits ? aggregateVariance / countedTraits : 0;
  const inconsistencyScore = clamp(averageVariance / 2.5, 0, 1);

  return {
    isInconsistent: inconsistencyScore >= 0.7,
    inconsistencyScore: Number(inconsistencyScore.toFixed(4)),
    contradictions,
  };
};

const evaluateAdaptiveExtensionNeed = ({ session, confidenceThreshold = LOW_CONFIDENCE_EXTENSION_THRESHOLD }) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const questionPlan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];
  const currentCount = questionPlan.length;
  const extensionAlreadyApplied = Boolean(session?.adaptiveMetrics?.confidenceExtensionApplied);

  const confidence = computeAdaptiveConfidence({ answers, questionPlan });
  const inconsistency = detectAnswerInconsistency({ answers, questionPlan });

  if (
    extensionAlreadyApplied ||
    currentCount < BASE_QUESTION_COUNT ||
    answers.length < BASE_QUESTION_COUNT ||
    currentCount >= MAX_QUESTION_COUNT
  ) {
    return {
      extraQuestions: 0,
      reasons: [],
      confidence,
      inconsistency,
      refiningMessage: '',
    };
  }

  const reasons = [];
  if (confidence < confidenceThreshold) {
    reasons.push('low_confidence');
  }
  if (inconsistency.inconsistencyScore >= 0.68) {
    reasons.push('answer_inconsistency');
  }

  if (!reasons.length) {
    return {
      extraQuestions: 0,
      reasons: [],
      confidence,
      inconsistency,
      refiningMessage: '',
    };
  }

  return {
    extraQuestions: clamp(QUESTION_EXTENSION_STEP, 0, MAX_QUESTION_COUNT - currentCount),
    reasons,
    confidence,
    inconsistency,
    refiningMessage: 'Refining your profile for better confidence and trait stability…',
  };
};

const shouldStopAssessmentEarly = ({ session }) => {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const questionPlan = Array.isArray(session?.questionPlan) ? session.questionPlan : [];

  const confidence = computeAdaptiveConfidence({ answers, questionPlan });
  const answeredCount = answers.filter((answer) => String(answer?.type || '').toLowerCase() !== 'behavior').length;
  const shouldStop = answeredCount >= questionPlan.length && confidence >= 0.96;

  return {
    shouldStop,
    confidence,
  };
};

module.exports = {
  buildUserProfileVector,
  generateQuestionPlan,
  generateSupplementalQuestionPlan,
  evaluateAdaptiveExtensionNeed,
  detectAnswerInconsistency,
  adaptUpcomingQuestions,
  computeFatigueMetrics,
  computeAdaptiveConfidence,
  shouldStopAssessmentEarly,
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  INTENT_POOL,
  LIKERT_LABELS,
};
