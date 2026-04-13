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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis dataKey="label" tick={{ fill: '#C9D6F3', fontSize: compact ? 11 : 12, fontWeight: 700 }} />
          <YAxis domain={[0, 100]} tick={{ fill: '#7F94BE', fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Score']}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgba(126, 153, 212, 0.5)',
              background: 'rgba(11, 15, 26, 0.94)',
              color: '#dce8ff',
            }}
            labelStyle={{ color: '#dce8ff', fontWeight: 700 }}
          />
          {hasComparison && !compact && <Legend wrapperStyle={{ color: '#dce8ff' }} />}
          <Bar
            dataKey="current"
            name={currentLabel}
            fill="#3B82F6"
            radius={[10, 10, 0, 0]}
            isAnimationActive
            animationDuration={720}
          />
          {hasComparison && (
            <Bar
              dataKey="previous"
              name={previousLabel}
              fill="#22D3EE"
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
