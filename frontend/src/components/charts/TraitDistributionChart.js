import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { traitColors } from '../../theme/colors';
import { normalizeTraits, TRAIT_META, TRAIT_ORDER } from '../../utils/traits';
import { chartTokens } from '../../theme/tokens';

const mapDistributionData = ({ traits, benchmarkTraits }) => {
  const current = normalizeTraits(traits);
  const benchmark = normalizeTraits(benchmarkTraits);

  return TRAIT_ORDER.map((traitKey) => {
    const currentScore = current[traitKey];
    const benchmarkScore = benchmark[traitKey];

    return {
      trait: traitKey,
      label: TRAIT_META[traitKey].short,
      current: currentScore,
      benchmark: benchmarkScore,
      delta: Number((currentScore - benchmarkScore).toFixed(2)),
      color: traitColors[traitKey],
    };
  });
};

const TraitDistributionChart = ({
  traits = {},
  benchmarkTraits = {},
  compact = false,
  height = 320,
}) => {
  const data = useMemo(
    () => mapDistributionData({ traits, benchmarkTraits }),
    [traits, benchmarkTraits]
  );

  return (
    <div className="chart-shell" aria-label="Trait distribution chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap={compact ? '24%' : '18%'}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: chartTokens.axis, fontSize: compact ? 11 : 12, fontWeight: 700 }}
            axisLine={{ stroke: chartTokens.axisLine }}
            tickLine={{ stroke: chartTokens.axisLine }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: chartTokens.mutedAxis, fontSize: 11 }}
            axisLine={{ stroke: chartTokens.axisLine }}
            tickLine={{ stroke: chartTokens.axisLine }}
          />
          <Tooltip
            formatter={(value, name, payload) => {
              const baseLabel = name === 'current' ? 'Latest' : 'Baseline';
              const currentDelta = payload?.payload?.delta;

              if (name === 'current' && Number.isFinite(currentDelta)) {
                return [`${value}% (${currentDelta >= 0 ? '+' : ''}${currentDelta})`, baseLabel];
              }

              return [`${value}%`, baseLabel];
            }}
            contentStyle={{
              borderRadius: 12,
              border: chartTokens.tooltip.border,
              background: chartTokens.tooltip.background,
              color: chartTokens.tooltip.text,
            }}
            labelStyle={{ color: chartTokens.tooltip.text, fontWeight: 700 }}
          />
          {!compact && <Legend wrapperStyle={{ color: chartTokens.axis }} />}
          <Bar
            dataKey="current"
            name="Latest"
            radius={[10, 10, 0, 0]}
            isAnimationActive
            animationDuration={760}
          >
            {data.map((item) => (
              <Cell key={`current-${item.trait}`} fill={item.color} />
            ))}
          </Bar>
          <Bar
            dataKey="benchmark"
            name="Baseline"
            radius={[10, 10, 0, 0]}
            fill="rgba(148, 163, 200, 0.46)"
            isAnimationActive
            animationDuration={860}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(TraitDistributionChart);
