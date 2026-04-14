import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { traitColors } from '../../theme/colors';
import { TRAIT_META, TRAIT_ORDER } from '../../utils/traits';
import { sanitizeChartValue } from '../../utils/chartSafety';
import Skeleton from '../ui/Skeleton';

const FACET_LABELS = {
  O1: 'Imagination',
  O2: 'Aesthetic Interest',
  O3: 'Emotional Openness',
  O4: 'Adventurousness',
  O5: 'Intellect',
  O6: 'Liberalism',
  C1: 'Self-Efficacy',
  C2: 'Orderliness',
  C3: 'Dutifulness',
  C4: 'Achievement-Striving',
  C5: 'Self-Discipline',
  C6: 'Cautiousness',
  E1: 'Friendliness',
  E2: 'Gregariousness',
  E3: 'Assertiveness',
  E4: 'Activity Level',
  E5: 'Excitement-Seeking',
  E6: 'Cheerfulness',
  A1: 'Trust',
  A2: 'Morality',
  A3: 'Altruism',
  A4: 'Cooperation',
  A5: 'Modesty',
  A6: 'Sympathy',
  N1: 'Anxiety',
  N2: 'Anger',
  N3: 'Depression',
  N4: 'Self-Consciousness',
  N5: 'Immoderation',
  N6: 'Vulnerability',
};

const toRgb = (hex) => {
  const clean = hex.replace('#', '');
  const base = clean.length === 3
    ? clean
        .split('')
        .map((segment) => segment + segment)
        .join('')
    : clean;

  const value = Number.parseInt(base, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const toRgba = (hex, alpha) => {
  const rgb = toRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const toFacetScoreObject = (input = {}) => {
  if (Array.isArray(input)) {
    return input.reduce((accumulator, entry) => {
      const trait = String(entry?.trait || '').toUpperCase();
      const value = sanitizeChartValue(entry?.value || 0);

      if (!trait) {
        return accumulator;
      }

      for (let index = 1; index <= 6; index += 1) {
        accumulator[`${trait}${index}`] = sanitizeChartValue(value + index - 3);
      }

      return accumulator;
    }, {});
  }

  return input && typeof input === 'object' ? input : {};
};

const mapFacetEntries = (facetScores = {}) =>
  Object.entries(toFacetScoreObject(facetScores))
    .map(([code, score]) => {
      const trait = code.charAt(0);
      const index = Number.parseInt(code.slice(1), 10) || 0;

      return {
        code,
        score: sanitizeChartValue(score || 0),
        trait,
        index,
        label: FACET_LABELS[code] || `${TRAIT_META[trait]?.label || 'Trait'} Facet ${index}`,
      };
    })
    .sort((left, right) => {
      const traitOrderDiff = TRAIT_ORDER.indexOf(left.trait) - TRAIT_ORDER.indexOf(right.trait);
      if (traitOrderDiff !== 0) {
        return traitOrderDiff;
      }

      return left.index - right.index;
    });

const summarizeForCompact = (entries = []) =>
  TRAIT_ORDER.map((trait) => {
    const traitEntries = entries.filter((entry) => entry.trait === trait);
    const score = traitEntries.length
      ? Math.round(
          traitEntries.reduce((sum, entry) => sum + entry.score, 0) / traitEntries.length
        )
      : 0;

    return {
      code: trait,
      score,
      trait,
      label: `${TRAIT_META[trait].label} Overview`,
      index: 0,
    };
  });

const getCellStyles = ({ trait, score }) => {
  const tone = traitColors[trait] || '#3B82F6';
  const intensity = Math.max(0.16, Math.min(0.78, score / 100));

  return {
    '--cell-tone': tone,
    '--cell-bg': `linear-gradient(145deg, ${toRgba(tone, intensity)}, ${toRgba('#0E1629', 0.92)})`,
    '--cell-border': toRgba(tone, 0.4 + intensity * 0.25),
    '--cell-glow': toRgba(tone, 0.28 + intensity * 0.32),
  };
};

const InsightHeatmapChart = ({ facetScores = {}, compact = false }) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeFacet, setActiveFacet] = useState(null);

  const entries = useMemo(() => mapFacetEntries(facetScores), [facetScores]);
  const visibleEntries = useMemo(
    () => (compact ? summarizeForCompact(entries) : entries),
    [compact, entries]
  );

  if (!visibleEntries.length) {
    return (
      <div className="heatmap-shell">
        <div className="skeleton-stack">
          <Skeleton height="180px" />
          <Skeleton height="14px" />
        </div>
      </div>
    );
  }

  return (
    <div className={`heatmap-shell ${compact ? 'is-compact' : ''}`}>
      <div className="heatmap-grid" role="list" aria-label="Facet intensity heatmap">
        {visibleEntries.map((entry, index) => (
          <motion.button
            key={entry.code}
            type="button"
            className="heatmap-cell"
            style={getCellStyles(entry)}
            onMouseEnter={() => setActiveFacet(entry)}
            onFocus={() => setActiveFacet(entry)}
            onBlur={() => setActiveFacet(null)}
            onMouseLeave={() => setActiveFacet(null)}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
            animate={prefersReducedMotion ? false : { opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.32,
              delay: prefersReducedMotion ? 0 : index * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="heatmap-cell__code">{entry.code}</span>
            <strong className="heatmap-cell__score">{entry.score}%</strong>
          </motion.button>
        ))}
      </div>

      <div className="heatmap-footnote">
        <span>Low</span>
        <div className="heatmap-footnote__bar" />
        <span>High</span>
      </div>

      {activeFacet && (
        <div className="heatmap-tooltip" role="status" aria-live="polite">
          <p>{activeFacet.label}</p>
          <strong>{activeFacet.score}% intensity</strong>
        </div>
      )}
    </div>
  );
};

export default React.memo(InsightHeatmapChart);
