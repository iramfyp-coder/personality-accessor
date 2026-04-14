const TRAITS = ['O', 'C', 'E', 'A', 'N'];

const FACET_LIBRARY = {
  O: ['curiosity', 'imagination', 'innovation', 'learning_agility'],
  C: ['discipline', 'organization', 'planning', 'reliability'],
  E: ['assertiveness', 'initiative', 'influence', 'social_energy'],
  A: ['empathy', 'cooperation', 'trust', 'supportiveness'],
  N: ['stress_reactivity', 'worry', 'resilience', 'risk_sensitivity'],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeTrait = (value = '') => {
  const token = String(value || '').toUpperCase().charAt(0);
  if (TRAITS.includes(token)) {
    return token;
  }
  return 'O';
};

const resolveTraitFromQuestion = (question = {}) => {
  const explicit = normalizeTrait(question.traitFocus || question.trait);
  if (explicit) {
    return explicit;
  }
  return normalizeTrait(question.traitTarget || 'O');
};

const difficultyForIndex = ({ questionIndex = 0, targetCount = 22 }) => {
  const ratio = clamp(Number(questionIndex || 0) / Math.max(Number(targetCount || 22), 1), 0, 1);

  if (ratio < 0.34) return 'easy';
  if (ratio < 0.72) return 'medium';
  return 'advanced';
};

const computeQuestionCoverage = ({
  questionPlan = [],
  questionIndex = 0,
  targetCount = 22,
  aiProfile: _aiProfile = {},
} = {}) => {
  const questions = Array.isArray(questionPlan) ? questionPlan : [];

  const traitCoverage = TRAITS.reduce((accumulator, trait) => {
    accumulator[trait] = 0;
    return accumulator;
  }, {});

  const facetCoverage = {};
  let cvRelevanceSum = 0;
  let cvRelevanceCount = 0;

  questions.forEach((question) => {
    const trait = resolveTraitFromQuestion(question);
    traitCoverage[trait] = Number(traitCoverage[trait] || 0) + 1;

    const facet = String(
      question?.facet || question?.traitTarget || question?.metadata?.facet || ''
    )
      .trim()
      .toLowerCase();

    if (facet) {
      facetCoverage[facet] = Number(facetCoverage[facet] || 0) + 1;
    }

    const cvRelevance = Number(
      question?.cvRelevance ?? question?.cv_relevance ?? question?.aiMeta?.cv_relevance
    );

    if (Number.isFinite(cvRelevance)) {
      cvRelevanceSum += clamp(cvRelevance, 0, 1);
      cvRelevanceCount += 1;
    }
  });

  const traitRank = Object.entries(traitCoverage).sort((a, b) => a[1] - b[1]);
  const missingTraits = traitRank.slice(0, 2).map(([trait]) => trait);
  const primaryTrait = missingTraits[0] || 'O';

  const canonicalFacets = FACET_LIBRARY[primaryTrait] || [];
  const missingFacets = canonicalFacets
    .map((facet) => ({ facet, count: Number(facetCoverage[facet] || 0) }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 2)
    .map((entry) => entry.facet);

  const cvCoverage = cvRelevanceCount > 0 ? cvRelevanceSum / cvRelevanceCount : 0;
  const cvFocusNeeded = cvCoverage < 0.72 || questionIndex % 4 === 2;

  const expectedDifficulty = difficultyForIndex({ questionIndex, targetCount });

  return {
    traitCoverage,
    facetCoverage,
    missingTraits,
    missingFacets,
    cvCoverage: Number(cvCoverage.toFixed(4)),
    cvFocusNeeded,
    nextDifficulty: expectedDifficulty,
    difficultyProgression: {
      questionIndex,
      targetCount,
      expectedDifficulty,
    },
  };
};

module.exports = {
  TRAITS,
  FACET_LIBRARY,
  computeQuestionCoverage,
  difficultyForIndex,
};
