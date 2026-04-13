import { sanitizeChartValue } from './chartSafety';

export const TRAIT_ORDER = ['O', 'C', 'E', 'A', 'N'];

export const TRAIT_META = {
  O: { label: 'Openness', short: 'O' },
  C: { label: 'Conscientiousness', short: 'C' },
  E: { label: 'Extraversion', short: 'E' },
  A: { label: 'Agreeableness', short: 'A' },
  N: { label: 'Neuroticism', short: 'N' },
};

export const EMPTY_TRAITS = {
  O: 0,
  C: 0,
  E: 0,
  A: 0,
  N: 0,
};

export const normalizeTraits = (traits = {}) => ({
  O: sanitizeChartValue(traits.O || 0),
  C: sanitizeChartValue(traits.C || 0),
  E: sanitizeChartValue(traits.E || 0),
  A: sanitizeChartValue(traits.A || 0),
  N: sanitizeChartValue(traits.N || 0),
});

export const getDominantTrait = (traits = EMPTY_TRAITS) => {
  const normalized = normalizeTraits(traits);

  return TRAIT_ORDER.reduce((best, trait) =>
    normalized[trait] > normalized[best] ? trait : best
  , TRAIT_ORDER[0]);
};

export const toTraitArray = (traits = EMPTY_TRAITS) => {
  const normalized = normalizeTraits(traits);

  return TRAIT_ORDER.map((trait) => ({
    trait,
    label: TRAIT_META[trait].label,
    score: normalized[trait],
  }));
};
