import { TRAIT_ORDER, normalizeTraits } from './traits';
import { sanitizeChartValue } from './chartSafety';

const clampScore = (score) => sanitizeChartValue(score);

export const traitsToCoordinates = (traits = {}) => {
  const normalized = normalizeTraits(traits);

  return TRAIT_ORDER.map((trait, index) => {
    const score = clampScore(normalized[trait]);
    const angle = (Math.PI * 2 * index) / TRAIT_ORDER.length;
    const radius = score / 100;

    return {
      trait,
      x: Number((Math.cos(angle) * radius).toFixed(4)),
      y: Number((Math.sin(angle) * radius).toFixed(4)),
      z: Number((((score - 50) / 50) * 0.6).toFixed(4)),
    };
  });
};

const mapTraitPayload = (traits = {}) => {
  const normalized = normalizeTraits(traits);

  return {
    O: clampScore(normalized.O),
    C: clampScore(normalized.C),
    E: clampScore(normalized.E),
    A: clampScore(normalized.A),
    N: clampScore(normalized.N),
  };
};

export const mapTraitsTo3DData = (traits = {}) => {
  const normalizedTraits = mapTraitPayload(traits);

  return {
    traits: normalizedTraits,
    coordinates: traitsToCoordinates(normalizedTraits),
  };
};

export default mapTraitsTo3DData;
