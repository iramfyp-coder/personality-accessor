import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TRAIT_ORDER, TRAIT_META, normalizeTraits } from '../../utils/traits';
import tokens, { chartTokens } from '../../theme/tokens';

const mapChartData = ({ traits, comparisonTraits }) => {
  const current = normalizeTraits(traits);
  const previous = normalizeTraits(comparisonTraits);

  return TRAIT_ORDER.map((trait) => ({
    trait,
    label: TRAIT_META[trait].short,
    current: current[trait],
    previous: previous[trait],
  }));
};

const TraitBarChart = ({
  traits = {},
  comparisonTraits = null,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  compact = false,
  height = 320,
}) => {
  const hasComparison = Boolean(comparisonTraits);
  const data = useMemo(
    () => mapChartData({ traits, comparisonTraits: comparisonTraits || {} }),
    [traits, comparisonTraits]
  );

  return (
    <div className="chart-shell" aria-label="Trait bar chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap={compact ? '26%' : '20%'}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} />
          <XAxis dataKey="label" tick={{ fill: chartTokens.axis, fontSize: compact ? 11 : 12, fontWeight: 700 }} />
          <YAxis domain={[0, 100]} tick={{ fill: chartTokens.mutedAxis, fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Score']}
            contentStyle={{
              borderRadius: 12,
              border: chartTokens.tooltip.border,
              background: chartTokens.tooltip.background,
              color: chartTokens.tooltip.text,
            }}
            labelStyle={{ color: chartTokens.tooltip.text, fontWeight: 700 }}
          />
          {hasComparison && !compact && <Legend wrapperStyle={{ color: chartTokens.axis }} />}
          <Bar
            dataKey="current"
            name={currentLabel}
            fill={tokens.chart.trait2}
            radius={[10, 10, 0, 0]}
            isAnimationActive
            animationDuration={720}
          />
          {hasComparison && (
            <Bar
              dataKey="previous"
              name={previousLabel}
              fill={tokens.chart.trait1}
              radius={[10, 10, 0, 0]}
              isAnimationActive
              animationDuration={860}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(TraitBarChart);
