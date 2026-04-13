const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNormalizedScore = ({ answer = {}, question = {} }) => {
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

  const raw =
    typeof answer.value === 'number'
      ? answer.value
      : Number(
          answer?.value?.normalizedScore ??
            answer?.metadata?.normalizedScore ??
            answer?.value?.score ??
            answer?.value?.weight
        );

  if (!Number.isFinite(raw)) {
    return 0.5;
  }

  return clamp((raw - 1) / 4, 0, 1);
};

const intentFromQuestion = (question = {}, answer = {}) =>
  String(question.intent || answer?.metadata?.intent || '')
    .toLowerCase()
    .trim();

const labelContains = (value = '', tokens = []) => {
  const lower = String(value || '').toLowerCase();
  return tokens.some((token) => lower.includes(token));
};

const inferBehaviorFromMcqOption = (optionLabel = '') => {
  const leadership = labelContains(optionLabel, ['lead', 'align', 'own', 'assign']) ? 1 : 0;
  const collaboration = labelContains(optionLabel, ['team', 'stakeholder', 'collabor', 'listen']) ? 1 : 0;
  const risk = labelContains(optionLabel, ['pilot', 'experiment', 'risk', 'trade-off']) ? 1 : 0;
  const slow = labelContains(optionLabel, ['delay', 'wait', 'postpone']) ? 1 : 0;

  return {
    leadership,
    collaboration,
    risk,
    speed: slow ? 0.25 : 0.75,
  };
};

const toBehaviorVector = ({ answers = [], questionPlan = [], behaviorAnalysis = {} }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const vector = {
    leadership: 50,
    risk_tolerance: 50,
    decision_speed: 50,
    stress_tolerance: 50,
    team_preference: 50,
  };

  const contributions = {
    leadership: 0,
    risk_tolerance: 0,
    decision_speed: 0,
    stress_tolerance: 0,
    team_preference: 0,
  };

  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    if (String(answer.type || '').toLowerCase() === 'behavior') {
      return;
    }

    const question = byQuestionId.get(answer.questionId) || {};
    const intent = intentFromQuestion(question, answer);
    const score = toNormalizedScore({ answer, question });
    const centered = (score - 0.5) * 2;

    if (intent === 'leadership') {
      vector.leadership += centered * 24;
      vector.decision_speed += centered * 10;
      contributions.leadership += 1;
      contributions.decision_speed += 1;
    }

    if (intent === 'risk') {
      vector.risk_tolerance += centered * 26;
      vector.decision_speed += centered * 8;
      contributions.risk_tolerance += 1;
      contributions.decision_speed += 1;
    }

    if (intent === 'deadline') {
      vector.stress_tolerance += centered * 26;
      contributions.stress_tolerance += 1;
    }

    if (intent === 'teamwork' || intent === 'conflict' || intent === 'social energy') {
      vector.team_preference += centered * 20;
      vector.leadership += centered * 8;
      contributions.team_preference += 1;
      contributions.leadership += 1;
    }

    if (String(answer.type || '').toLowerCase() === 'mcq') {
      const optionLabel = String(answer?.value?.optionLabel || '').trim();
      const inferred = inferBehaviorFromMcqOption(optionLabel);

      vector.leadership += inferred.leadership * 8;
      vector.team_preference += inferred.collaboration * 8;
      vector.risk_tolerance += inferred.risk * 8;
      vector.decision_speed += inferred.speed * 8;

      contributions.leadership += 1;
      contributions.team_preference += 1;
      contributions.risk_tolerance += 1;
      contributions.decision_speed += 1;
    }

    if (answer?.metadata?.analysis && typeof answer.metadata.analysis === 'object') {
      const analysis = answer.metadata.analysis;
      vector.leadership += Number(analysis.leadership || 0) * 0.15;
      vector.decision_speed += Number(analysis.confidence || 0) * 10;
      vector.risk_tolerance += Number(analysis.reasoning || 0) * 0.08;
      contributions.leadership += 1;
      contributions.decision_speed += 1;
      contributions.risk_tolerance += 1;
    }
  });

  const confidenceLabel = String(behaviorAnalysis.confidence_level || '').toLowerCase();
  const riskLabel = String(behaviorAnalysis.risk_tendency || '').toLowerCase();
  const decisionLabel = String(behaviorAnalysis.decision_style || '').toLowerCase();
  const stabilityLabel = String(behaviorAnalysis.emotional_stability || '').toLowerCase();

  if (confidenceLabel.includes('high')) {
    vector.decision_speed += 10;
    vector.leadership += 8;
  } else if (confidenceLabel.includes('moderate')) {
    vector.decision_speed += 4;
  }

  if (riskLabel.includes('calculated')) {
    vector.risk_tolerance += 10;
  }

  if (riskLabel.includes('averse')) {
    vector.risk_tolerance -= 8;
  }

  if (decisionLabel.includes('evidence')) {
    vector.decision_speed += 5;
  }

  if (decisionLabel.includes('collaborative')) {
    vector.team_preference += 8;
  }

  if (stabilityLabel.includes('stable')) {
    vector.stress_tolerance += 10;
  }

  if (stabilityLabel.includes('reactive')) {
    vector.stress_tolerance -= 10;
  }

  return Object.entries(vector).reduce((accumulator, [key, value]) => {
    accumulator[key] = clamp(Math.round(Number(value || 50)), 0, 100);
    return accumulator;
  }, {});
};

module.exports = {
  toBehaviorVector,
};
