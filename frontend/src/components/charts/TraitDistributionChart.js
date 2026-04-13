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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#C9D6F3', fontSize: compact ? 11 : 12, fontWeight: 700 }}
            axisLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
            tickLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#7F94BE', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
            tickLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
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
              border: '1px solid rgba(126, 153, 212, 0.5)',
              background: 'rgba(11, 15, 26, 0.94)',
              color: '#dce8ff',
            }}
            labelStyle={{ color: '#dce8ff', fontWeight: 700 }}
          />
          {!compact && <Legend wrapperStyle={{ color: '#dce8ff' }} />}
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
            fill="rgba(143, 170, 223, 0.46)"
            isAnimationActive
            animationDuration={860}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(TraitDistributionChart);
