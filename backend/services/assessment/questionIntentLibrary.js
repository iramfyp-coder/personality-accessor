const OCEAN_TRAIT_FACETS = {
  O: ['creativity', 'curiosity', 'novelty_tolerance', 'abstract_thinking'],
  C: ['planning', 'discipline', 'organization', 'goal_focus'],
  E: ['social_energy', 'leadership', 'assertiveness', 'communication'],
  A: ['cooperation', 'empathy', 'trust', 'team_behavior'],
  N: ['stress_response', 'uncertainty_tolerance', 'emotional_control', 'risk_perception'],
};

const QUESTION_INTENT_LIBRARY = [
  {
    key: 'decision_style',
    label: 'Decision style',
    primaryTrait: 'C',
    facets: ['planning', 'goal_focus', 'organization'],
    category: 'decision_making',
    stage: 'cognitive',
    theme: 'decision',
  },
  {
    key: 'risk_preference',
    label: 'Risk preference',
    primaryTrait: 'N',
    facets: ['risk_perception', 'uncertainty_tolerance'],
    category: 'risk',
    stage: 'career',
    theme: 'stress',
  },
  {
    key: 'team_preference',
    label: 'Team preference',
    primaryTrait: 'A',
    facets: ['team_behavior', 'cooperation', 'trust'],
    category: 'team_style',
    stage: 'personality',
    theme: 'social',
  },
  {
    key: 'leadership_behavior',
    label: 'Leadership behavior',
    primaryTrait: 'E',
    facets: ['leadership', 'assertiveness', 'social_energy'],
    category: 'leadership',
    stage: 'personality',
    theme: 'leadership',
  },
  {
    key: 'creativity_behavior',
    label: 'Creativity behavior',
    primaryTrait: 'O',
    facets: ['creativity', 'curiosity', 'novelty_tolerance'],
    category: 'creativity',
    stage: 'cognitive',
    theme: 'creative',
  },
  {
    key: 'stress_response',
    label: 'Stress response',
    primaryTrait: 'N',
    facets: ['stress_response', 'emotional_control'],
    category: 'risk',
    stage: 'personality',
    theme: 'stress',
  },
  {
    key: 'adaptability',
    label: 'Adaptability',
    primaryTrait: 'O',
    facets: ['novelty_tolerance', 'abstract_thinking'],
    category: 'adaptability',
    stage: 'personality',
    theme: 'workplace',
  },
  {
    key: 'analysis_style',
    label: 'Analysis style',
    primaryTrait: 'C',
    facets: ['discipline', 'organization', 'goal_focus'],
    category: 'analytical',
    stage: 'cognitive',
    theme: 'decision',
  },
  {
    key: 'confidence_behavior',
    label: 'Confidence behavior',
    primaryTrait: 'E',
    facets: ['assertiveness', 'social_energy', 'communication'],
    category: 'personality',
    stage: 'personality',
    theme: 'personal',
  },
  {
    key: 'communication_style',
    label: 'Communication style',
    primaryTrait: 'A',
    facets: ['communication', 'empathy', 'trust'],
    category: 'team_style',
    stage: 'personality',
    theme: 'social',
  },
];

const INTENT_KEYS = QUESTION_INTENT_LIBRARY.map((intent) => intent.key);

const duplicateIntentKeys = INTENT_KEYS.filter((key, index) => INTENT_KEYS.indexOf(key) !== index);
if (duplicateIntentKeys.length > 0) {
  throw new Error(`Duplicate intent keys are not allowed: ${duplicateIntentKeys.join(', ')}`);
}

module.exports = {
  OCEAN_TRAIT_FACETS,
  QUESTION_INTENT_LIBRARY,
  INTENT_KEYS,
};
