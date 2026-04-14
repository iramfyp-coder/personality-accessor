const COGNITIVE_STYLES = ['analytical', 'creative', 'strategic', 'systematic', 'practical', 'abstract'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const INTENT_STYLE_WEIGHTS = {
  analytical: { analytical: 0.85, systematic: 0.45, strategic: 0.25 },
  conflict: { strategic: 0.5, practical: 0.45, creative: 0.2 },
  leadership: { strategic: 0.7, practical: 0.6, analytical: 0.2 },
  deadline: { systematic: 0.7, practical: 0.45, strategic: 0.2 },
  creativity: { creative: 0.9, abstract: 0.7, strategic: 0.2 },
  risk: { strategic: 0.65, analytical: 0.45, practical: 0.25 },
  learning: { abstract: 0.55, creative: 0.45, analytical: 0.3 },
  teamwork: { practical: 0.55, strategic: 0.35, creative: 0.2 },
  independence: { analytical: 0.5, abstract: 0.35, systematic: 0.25 },
  structure: { systematic: 0.85, analytical: 0.45, practical: 0.2 },
  'social energy': { practical: 0.45, strategic: 0.25, creative: 0.2 },
  planning: { systematic: 0.75, strategic: 0.5, analytical: 0.35 },
};

const toNormalizedAnswerScore = ({ answer = {}, question = {} }) => {
  const type = String(question?.type || answer.type || '').toLowerCase();

  if (type === 'scale') {
    const min = Number(question?.scaleMin || answer?.metadata?.scaleMin || 1);
    const max = Number(question?.scaleMax || answer?.metadata?.scaleMax || 10);
    const numeric = Number(answer.value);

    if (Number.isFinite(numeric) && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return clamp((numeric - min) / (max - min), 0, 1);
    }

    return 0.5;
  }

  const scoreCandidate =
    typeof answer.value === 'number'
      ? answer.value
      : Number(
          answer?.value?.normalizedScore ??
            answer?.metadata?.normalizedScore ??
            answer?.value?.score ??
            answer?.value?.weight
        );

  if (!Number.isFinite(scoreCandidate)) {
    return 0.5;
  }

  return clamp((scoreCandidate - 1) / 4, 0, 1);
};

const toIntent = (question = {}, answer = {}) => {
  const resolveIntent = (value = '') => {
    const token = String(value || '').toLowerCase().trim();
    if (!token) {
      return '';
    }

    if (token.includes('analysis_style') || token.includes('analysis')) return 'analytical';
    if (token.includes('decision_style') || token.includes('decision')) return 'planning';
    if (token.includes('risk_preference') || token.includes('risk')) return 'risk';
    if (token.includes('team_preference') || token.includes('communication_style')) return 'teamwork';
    if (token.includes('leadership_behavior') || token.includes('leadership')) return 'leadership';
    if (token.includes('creativity_behavior') || token.includes('creativity')) return 'creativity';
    if (token.includes('stress_response') || token.includes('deadline')) return 'deadline';
    if (token.includes('adaptability') || token.includes('learning')) return 'learning';
    if (token.includes('confidence_behavior') || token.includes('social energy')) return 'social energy';
    if (token.includes('structure')) return 'structure';
    if (token.includes('conflict')) return 'conflict';

    return token;
  };

  const fromQuestion = resolveIntent(question.intent || '');
  if (fromQuestion) {
    return fromQuestion;
  }

  const fromAnswer = resolveIntent(answer?.metadata?.intent || '');
  if (fromAnswer) {
    return fromAnswer;
  }

  return '';
};

const addProfileBoosts = ({ scores, profileVector = {} }) => {
  const next = { ...scores };
  const categories = profileVector.skillDominance || {};

  const frontendSignal = Number(categories.frontend || 0) + Number(categories.design || 0);
  const backendSignal = Number(categories.backend || 0) + Number(categories.cloud_devops || 0);
  const dataSignal = Number(categories.ai_ml || 0) + Number(categories.data || 0);
  const communicationSignal = Number(categories.soft_skills || 0);

  next.creative += clamp(frontendSignal * 1.6, 0, 12);
  next.abstract += clamp(dataSignal * 1.4, 0, 12);
  next.analytical += clamp((backendSignal + dataSignal) * 1.1, 0, 14);
  next.systematic += clamp(backendSignal * 1.25, 0, 14);
  next.practical += clamp((backendSignal + communicationSignal) * 0.9, 0, 12);
  next.strategic += clamp((communicationSignal + dataSignal) * 0.95, 0, 12);

  return next;
};

const normalizeScores = (scores = {}) =>
  COGNITIVE_STYLES.reduce((accumulator, key) => {
    accumulator[key] = clamp(Math.round(Number(scores[key] || 50)), 0, 100);
    return accumulator;
  }, {});

const computeCognitiveScores = ({ answers = [], questionPlan = [], profileVector = {} }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const base = COGNITIVE_STYLES.reduce((accumulator, key) => {
    accumulator[key] = 48;
    return accumulator;
  }, {});

  const answered = Array.isArray(answers) ? answers : [];

  answered.forEach((answer) => {
    if (String(answer.type || '').toLowerCase() === 'behavior') {
      return;
    }

    const question = byQuestionId.get(answer.questionId) || {};
    const normalizedScore = toNormalizedAnswerScore({ answer, question });
    const centered = (normalizedScore - 0.5) * 2;

    const intent = toIntent(question, answer);
    const weights = INTENT_STYLE_WEIGHTS[intent] || INTENT_STYLE_WEIGHTS.analytical;

    Object.entries(weights).forEach(([style, weight]) => {
      base[style] = Number(base[style] || 48) + centered * 26 * Number(weight || 0);
    });

    if (answer?.metadata?.analysis && typeof answer.metadata.analysis === 'object') {
      const analysis = answer.metadata.analysis;
      base.creative += Number(analysis.creativity || 0) * 0.18;
      base.analytical += Number(analysis.reasoning || 0) * 0.2;
      base.strategic += Number(analysis.leadership || 0) * 0.14;
      base.abstract += Number(analysis.reasoning || 0) * 0.12;
    }
  });

  const withBoosts = addProfileBoosts({
    scores: base,
    profileVector,
  });

  return normalizeScores(withBoosts);
};

module.exports = {
  COGNITIVE_STYLES,
  computeCognitiveScores,
};
