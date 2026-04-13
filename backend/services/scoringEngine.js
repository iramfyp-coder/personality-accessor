const TRAITS = ['O', 'C', 'E', 'A', 'N'];
const SCALE_MIN = 1;
const SCALE_MAX = 5;
const MODEL_VERSION = '1.0.0';

const round = (value) => Math.max(0, Math.min(100, Math.round(value)));

const normalizeToPercent = (total, count) => {
  if (!count) {
    return 0;
  }

  const average = total / count;
  const normalized = ((average - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  return round(normalized);
};

const getAnswerValue = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < SCALE_MIN || parsed > SCALE_MAX) {
    return null;
  }

  return parsed;
};

const isReverseScored = (question) => question.reverse === true || question.keyedDirection === '-';

const calculateScores = ({ answers, questionsById }) => {
  const traitTotals = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  const traitCounts = { O: 0, C: 0, E: 0, A: 0, N: 0 };

  const facetTotals = {};
  const facetCounts = {};

  answers.forEach((answer) => {
    const question = questionsById.get(String(answer.questionId));
    if (!question) {
      return;
    }

    const answerValue = getAnswerValue(answer.value);
    if (answerValue === null) {
      return;
    }

    const effectiveValue = isReverseScored(question)
      ? SCALE_MAX + SCALE_MIN - answerValue
      : answerValue;

    const trait = question.domain;
    if (!TRAITS.includes(trait)) {
      return;
    }

    traitTotals[trait] += effectiveValue;
    traitCounts[trait] += 1;

    if (question.facetCode) {
      if (!facetTotals[question.facetCode]) {
        facetTotals[question.facetCode] = 0;
        facetCounts[question.facetCode] = 0;
      }

      facetTotals[question.facetCode] += effectiveValue;
      facetCounts[question.facetCode] += 1;
    }
  });

  const traits = {};
  TRAITS.forEach((trait) => {
    traits[trait] = normalizeToPercent(traitTotals[trait], traitCounts[trait]);
  });

  const facetScores = {};
  Object.keys(facetTotals).forEach((facetCode) => {
    facetScores[facetCode] = normalizeToPercent(facetTotals[facetCode], facetCounts[facetCode]);
  });

  const dominantTrait = TRAITS.reduce((bestTrait, currentTrait) =>
    traits[currentTrait] > traits[bestTrait] ? currentTrait : bestTrait
  , TRAITS[0]);

  return {
    traits,
    facetScores,
    dominantTrait,
  };
};

module.exports = {
  TRAITS,
  SCALE_MIN,
  SCALE_MAX,
  MODEL_VERSION,
  calculateScores,
};
