const STAGES = ['cv_upload', 'questionnaire', 'behavior', 'result'];

const CV_SCHEMA_VERSION = '1.0.0';
const RESULT_SCHEMA_VERSION = '2.0.0';
const ANSWER_TYPES = ['likert', 'scale', 'mcq', 'text', 'scenario', 'behavior'];
const OCEAN_TRAITS = ['O', 'C', 'E', 'A', 'N'];

const toString = (value) => String(value || '').trim();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toStringList = (value, limit = 32) =>
  (Array.isArray(value) ? value : [])
    .map((item) => toString(item))
    .filter(Boolean)
    .slice(0, limit);

const normalizeCvSkill = (skill = {}) => {
  if (!skill || typeof skill !== 'object') {
    return null;
  }

  const name = toString(skill.name);
  if (!name) {
    return null;
  }

  const level = clamp(Math.round(Number(skill.level) || 3), 1, 5);
  const category = toString(skill.category || 'general') || 'general';

  return {
    name,
    level,
    category,
  };
};

const normalizeCvMark = (mark = {}) => {
  if (!mark || typeof mark !== 'object') {
    return null;
  }

  const subject = toString(mark.subject || mark.name);
  if (!subject) {
    return null;
  }

  const numeric = Number(mark.score ?? mark.marks ?? mark.percentage);
  const score = Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : 0;

  return {
    subject,
    score,
  };
};

const inferCvSource = (input = {}) => {
  const candidate = toString(input.source).toLowerCase();

  if (candidate === 'ai' || candidate === 'heuristic') {
    return candidate;
  }

  if (toString(input.source_domain) || toString(input.sourceDomain)) {
    return 'heuristic';
  }

  return 'heuristic';
};

const normalizeCvData = (input = {}) => {
  const source = inferCvSource(input);

  const rawConfidence = Number(
    input.confidenceScore ?? input.confidence_score ?? (source === 'ai' ? 0.86 : 0.62)
  );

  const confidenceScore = Number.isFinite(rawConfidence)
    ? clamp(rawConfidence, 0, 1)
    : source === 'ai'
    ? 0.86
    : 0.62;

  return {
    name: toString(input.name),
    skills: (Array.isArray(input.skills) ? input.skills : [])
      .map(normalizeCvSkill)
      .filter(Boolean)
      .slice(0, 48),
    subjects: toStringList(input.subjects, 32),
    marks: (Array.isArray(input.marks) ? input.marks : [])
      .map(normalizeCvMark)
      .filter(Boolean)
      .slice(0, 32),
    projects: toStringList(input.projects, 48),
    tools: toStringList(input.tools, 48),
    education: toStringList(input.education, 24),
    experience: toStringList(input.experience, 36),
    interests: toStringList(input.interests, 24),
    careerSignals: toStringList(input.careerSignals || input.career_signals, 24),
    subjectVector:
      input.subjectVector && typeof input.subjectVector === 'object'
        ? input.subjectVector
        : {},
    skillVector:
      input.skillVector && typeof input.skillVector === 'object'
        ? input.skillVector
        : {},
    interestVector:
      input.interestVector && typeof input.interestVector === 'object'
        ? input.interestVector
        : {},
    confidenceScore,
    source,
    schemaVersion: toString(input.schemaVersion || input.schema_version || CV_SCHEMA_VERSION) || CV_SCHEMA_VERSION,
  };
};

const normalizeAnswerType = (value) => {
  const type = toString(value).toLowerCase();

  if (ANSWER_TYPES.includes(type)) {
    return type;
  }

  return 'likert';
};

const normalizeScoreLike = (value, fallback = 3) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 1, 5) : fallback;
};

const normalizeScaleLikeValue = (value) => normalizeScoreLike(value, 3);
const normalizeSliderValue = (value, fallback = 5) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, 1, 10) : fallback;
};

const normalizeStructuredAnswerValue = (value = {}, type) => {
  const payload = value && typeof value === 'object' ? value : {};

  const text = toString(payload.text || payload.answer || payload.response);
  const example = toString(payload.example);
  const optionId = toString(payload.optionId || payload.option_id);
  const optionLabel = toString(payload.optionLabel || payload.option_label || payload.label);

  const normalizedScore = normalizeScoreLike(
    payload.normalizedScore ?? payload.normalized_score ?? payload.score ?? payload.weight,
    type === 'text' ? 3 : 2.5
  );

  return {
    text,
    example,
    optionId,
    optionLabel,
    normalizedScore,
  };
};

const normalizeAnswerValue = ({ type, value }) => {
  if (type === 'behavior') {
    return toString(value);
  }

  if (type === 'likert') {
    return normalizeScaleLikeValue(value);
  }

  if (type === 'scale') {
    return normalizeSliderValue(value);
  }

  if (type === 'mcq') {
    if (value && typeof value === 'object') {
      const normalized = normalizeStructuredAnswerValue(value, type);
      return {
        optionId: normalized.optionId,
        optionLabel: normalized.optionLabel,
        normalizedScore: normalized.normalizedScore,
      };
    }

    return normalizeScaleLikeValue(value);
  }

  if (type === 'text' || type === 'scenario') {
    const normalized = normalizeStructuredAnswerValue(value, type);

    return {
      text: normalized.text,
      example: normalized.example,
      optionId: normalized.optionId,
      optionLabel: normalized.optionLabel,
      normalizedScore: normalized.normalizedScore,
    };
  }

  return normalizeScaleLikeValue(value);
};

const toUnifiedAnswer = ({
  questionId,
  type,
  value,
  metadata,
  answeredAt,
}) => {
  const normalizedType = normalizeAnswerType(type);

  return {
    questionId: toString(questionId),
    type: normalizedType,
    value: normalizeAnswerValue({ type: normalizedType, value }),
    metadata: {
      trait: toString(metadata?.trait),
      difficulty: toString(metadata?.difficulty),
      category: toString(metadata?.category),
      plannerCategory: toString(metadata?.plannerCategory || metadata?.planner_category),
      traitTarget: toString(metadata?.traitTarget || metadata?.trait_target),
      intent: toString(metadata?.intent),
      stage: toString(metadata?.stage),
      theme: toString(metadata?.theme),
      answerFormat: toString(metadata?.answerFormat || metadata?.answer_format),
      scoringType: toString(metadata?.scoringType || metadata?.scoring_type),
      responseTimeMs: clamp(Number(metadata?.responseTimeMs || metadata?.response_time_ms || 0) || 0, 0, 240000),
      isNeutral: Boolean(metadata?.isNeutral || metadata?.is_neutral),
      isSkipped: Boolean(metadata?.isSkipped || metadata?.is_skipped),
      normalizedScore: clamp(Number(metadata?.normalizedScore || metadata?.normalized_score || 0) || 0, 0, 5),
      scaleMin: Number.isFinite(Number(metadata?.scaleMin)) ? Number(metadata.scaleMin) : undefined,
      scaleMax: Number.isFinite(Number(metadata?.scaleMax)) ? Number(metadata.scaleMax) : undefined,
      analysis: metadata?.analysis && typeof metadata.analysis === 'object' ? metadata.analysis : undefined,
    },
    answeredAt: answeredAt ? new Date(answeredAt) : new Date(),
  };
};

const answerIdentityKey = (answer) => `${toString(answer.questionId)}::${normalizeAnswerType(answer.type)}`;

const upsertUnifiedAnswer = ({ answers = [], answer }) => {
  const nextAnswer = toUnifiedAnswer(answer);
  const key = answerIdentityKey(nextAnswer);

  const next = [];
  let replaced = false;

  for (const existing of Array.isArray(answers) ? answers : []) {
    const normalizedExisting = toUnifiedAnswer(existing);

    if (answerIdentityKey(normalizedExisting) === key) {
      next.push(nextAnswer);
      replaced = true;
      continue;
    }

    next.push(normalizedExisting);
  }

  if (!replaced) {
    next.push(nextAnswer);
  }

  return {
    answers: next,
    inserted: !replaced,
  };
};

const normalizeUnifiedAnswers = (answers = []) =>
  (Array.isArray(answers) ? answers : [])
    .map((answer) => toUnifiedAnswer(answer))
    .filter((answer) => answer.questionId);

const migrateLegacyAnswersToUnified = ({ answersJson = [], behaviorAnswers = [] }) => {
  const mcq = (Array.isArray(answersJson) ? answersJson : []).map((answer) =>
    toUnifiedAnswer({
      questionId: answer.questionId,
      type: 'mcq',
      value: answer.value,
      metadata: {
        trait: answer.traitFocus,
        difficulty: answer.difficulty,
      },
      answeredAt: answer.answeredAt,
    })
  );

  const behavior = (Array.isArray(behaviorAnswers) ? behaviorAnswers : []).map((answer) =>
    toUnifiedAnswer({
      questionId: answer.promptId,
      type: 'behavior',
      value: answer.text,
      metadata: {
        trait: '',
        difficulty: '',
      },
      answeredAt: answer.answeredAt,
    })
  );

  return normalizeUnifiedAnswers([...mcq, ...behavior]);
};

const getSessionUnifiedAnswers = (session = {}) => {
  const nativeAnswers = normalizeUnifiedAnswers(session.answers || []);

  if (nativeAnswers.length > 0) {
    return nativeAnswers;
  }

  return migrateLegacyAnswersToUnified({
    answersJson: session.answersJson || [],
    behaviorAnswers: session.behaviorAnswers || [],
  });
};

const toLegacyScaleAnswers = ({ answers = [], questionPlan = [] }) => {
  const byQuestionId = new Map(
    (Array.isArray(questionPlan) ? questionPlan : []).map((question) => [
      toString(question.questionId),
      question,
    ])
  );

  const toLegacyTrait = (question = {}, answer = {}) => {
    const candidate = toString(
      answer.metadata?.trait ||
        answer.metadata?.traitTarget ||
        question?.traitFocus ||
        question?.traitTarget ||
        question?.trait
    )
      .toUpperCase()
      .charAt(0);

    if (OCEAN_TRAITS.includes(candidate)) {
      return candidate;
    }

    const traitToken = toString(question?.traitTarget || question?.trait).toLowerCase();

    if (traitToken.includes('social') || traitToken.includes('leader')) {
      return 'E';
    }

    if (traitToken.includes('stress') || traitToken.includes('risk')) {
      return 'N';
    }

    if (traitToken.includes('plan') || traitToken.includes('system') || traitToken.includes('analytic')) {
      return 'C';
    }

    if (traitToken.includes('team') || traitToken.includes('conflict')) {
      return 'A';
    }

    return 'O';
  };

  const toFivePointScore = ({ value, question }) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 3;
    }

    const type = toString(question?.type).toLowerCase();
    if (type === 'scale') {
      const min = Number(question?.scaleMin || 1);
      const max = Number(question?.scaleMax || 10);

      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        const normalized = ((numeric - min) / (max - min)) * 4 + 1;
        return clamp(normalized, 1, 5);
      }
    }

    return clamp(numeric, 1, 5);
  };

  return normalizeUnifiedAnswers(answers)
    .filter((answer) =>
      ['likert', 'scale', 'mcq', 'scenario', 'text'].includes(answer.type)
    )
    .map((answer) => {
      const question = byQuestionId.get(toString(answer.questionId));
      const answerValue =
        typeof answer.value === 'number'
          ? answer.value
          : Number(answer.value?.normalizedScore || answer.metadata?.normalizedScore || 3);

      const numericValue = Number.isFinite(answerValue)
        ? toFivePointScore({ value: answerValue, question })
        : 3;

      return {
        questionId: answer.questionId,
        questionText: toString(question?.text),
        type: toString(question?.type) || 'likert',
        category: toString(question?.category) || toString(answer.metadata?.category),
        plannerCategory:
          toString(question?.plannerCategory) ||
          toString(answer.metadata?.plannerCategory || answer.metadata?.planner_category),
        stage: toString(question?.stage || answer.metadata?.stage),
        theme: toString(question?.theme || answer.metadata?.theme),
        answerFormat:
          toString(question?.answerFormat || answer.metadata?.answerFormat || answer.metadata?.answer_format),
        scoringType:
          toString(question?.scoringType || answer.metadata?.scoringType || answer.metadata?.scoring_type),
        difficulty:
          toString(answer.metadata?.difficulty) ||
          toString(question?.activeDifficulty) ||
          'medium',
        traitFocus: toLegacyTrait(question, answer),
        traitTarget:
          toString(answer.metadata?.traitTarget) ||
          toString(question?.traitTarget || question?.traitFocus || question?.trait) ||
          'O',
        value: numericValue,
        answeredAt: answer.answeredAt || new Date(),
      };
    });
};

const toLegacyBehaviorAnswers = ({ answers = [], behaviorPrompts = [], questionPlan = [] }) => {
  const byPromptId = new Map(
    (Array.isArray(behaviorPrompts) ? behaviorPrompts : []).map((prompt) => [
      toString(prompt.promptId),
      prompt,
    ])
  );
  const byQuestionId = new Map(
    (Array.isArray(questionPlan) ? questionPlan : []).map((question) => [
      toString(question.questionId || question.id),
      question,
    ])
  );

  return normalizeUnifiedAnswers(answers)
    .filter((answer) => ['behavior', 'text', 'scenario'].includes(answer.type))
    .map((answer) => {
      const valueText =
        answer.type === 'behavior'
          ? toString(answer.value)
          : toString(answer.value?.text || answer.value?.example);

      const question = byQuestionId.get(toString(answer.questionId));
      const prompt =
        toString(byPromptId.get(answer.questionId)?.prompt) ||
        toString(question?.text) ||
        'Adaptive assessment question';

      const trait =
        toString(answer.metadata?.traitTarget || answer.metadata?.trait) ||
        toString(question?.traitTarget || question?.trait) ||
        '';

      const category =
        toString(answer.metadata?.category) || toString(question?.category) || '';

      return {
        questionId: answer.questionId,
        promptId: answer.questionId,
        prompt,
        answer: valueText,
        text: valueText,
        trait,
        type: answer.type,
        category,
        answeredAt: answer.answeredAt || new Date(),
      };
    })
    .filter((answer) => answer.text.length > 0);
};

const countByAnswerType = ({ answers = [], type }) =>
  normalizeUnifiedAnswers(answers).filter((answer) => answer.type === type).length;

const mapResultToLegacySummary = (result = {}) => ({
  personality_type:
    toString(result.personality?.archetypes?.personalityType) ||
    toString(result.personality?.archetypes?.dominantArchetype) ||
    'Analytical',
  personality_type_label:
    toString(result.personality?.archetypes?.interpretation?.label) ||
    toString(result.personality?.archetypes?.personalityType) ||
    'Analytical',
  dominant_trait: toString(result.personality?.archetypes?.dominantTrait) || 'O',
  trait_scores: result.personality?.traits || {},
  ocean_scores: result.personality?.oceanNormalized || {},
  introversion_score: Number(result.personality?.archetypes?.introversionScore || 0),
  hybrid_trait_scores: result.personality?.archetypes?.hybridTraitScores || {},
  dominant_strengths: result.personality?.archetypes?.dominantStrengths || [],
  weaknesses: result.personality?.archetypes?.weaknesses || [],
  interpretation: result.personality?.archetypes?.interpretation || {},
  behavioral_summary: toString(result.personality?.archetypes?.behavioralSummary),
  narrative_summary: toString(result.personality?.narrativeSummary || result.personality?.archetypes?.behavioralSummary),
  consistency_score: Number(result.personality?.consistencyScore || 0),
  consistency_signals: result.personality?.consistencySignals || [],
  behavior_analysis: result.behavior?.analysis || {},
  behavior_vector: result.behavior?.vector || {},
  cognitive_scores: result.personality?.cognitiveScores || {},
  career_recommendations: result.career?.recommendations || [],
  career_cluster: toString(result.career?.clusterLabel || result.career?.cluster || ''),
  career_contrast: result.career?.contrast || {},
  career_roadmap: result.career?.roadmap || [],
  aptitude_signals: result.career?.aptitudeSignals || {},
  why_not_catalog: result.career?.whyNotCatalog || {},
  confidence_score: Number(result.analytics?.confidenceScore || 0),
  confidence_band: toString(result.analytics?.confidenceBand || ''),
  confidence_gap: Number(result.analytics?.confidenceGap || 0),
  stop_confidence: Number(result.analytics?.stopConfidence || 0),
  insightHeatmap: Array.isArray(result.analytics?.insightHeatmap) ? result.analytics.insightHeatmap : [],
  insight_heatmap: Array.isArray(result.analytics?.insightHeatmap) ? result.analytics.insightHeatmap : [],
  facetScores:
    result.analytics?.facetScores && typeof result.analytics.facetScores === 'object'
      ? result.analytics.facetScores
      : {},
  facet_scores:
    result.analytics?.facetScores && typeof result.analytics.facetScores === 'object'
      ? result.analytics.facetScores
      : {},
  cv_data: result.cvData || {},
  balance: result.analytics?.balance || {
    personalityWeight: 50,
    careerWeight: 50,
    personalityScore: 0,
    careerScore: 0,
  },
  meta: {
    questions_answered: normalizeUnifiedAnswers(result.answers || []).filter((answer) =>
      ['likert', 'scale', 'mcq', 'text', 'scenario'].includes(answer.type)
    ).length,
    behavior_questions_answered: countByAnswerType({ answers: result.answers, type: 'behavior' }),
    generated_at: new Date(result.completedAt || result.updatedAt || Date.now()).toISOString(),
  },
});

const isValidStageTransition = ({ from, to }) => {
  const current = toString(from) || 'cv_upload';
  const next = toString(to) || current;

  if (!STAGES.includes(current) || !STAGES.includes(next)) {
    return false;
  }

  if (current === next) {
    return true;
  }

  if (next === 'cv_upload') {
    return true;
  }

  if (current === 'questionnaire' && next === 'result') {
    return true;
  }

  return STAGES.indexOf(next) === STAGES.indexOf(current) + 1;
};

const normalizeResultSchemaVersion = (version) =>
  toString(version || RESULT_SCHEMA_VERSION) || RESULT_SCHEMA_VERSION;

module.exports = {
  STAGES,
  CV_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION,
  normalizeCvData,
  toUnifiedAnswer,
  upsertUnifiedAnswer,
  normalizeUnifiedAnswers,
  getSessionUnifiedAnswers,
  migrateLegacyAnswersToUnified,
  toLegacyScaleAnswers,
  toLegacyBehaviorAnswers,
  mapResultToLegacySummary,
  isValidStageTransition,
  normalizeResultSchemaVersion,
};
