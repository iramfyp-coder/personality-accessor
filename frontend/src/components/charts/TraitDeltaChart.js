import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TRAIT_ORDER, TRAIT_META } from '../../utils/traits';
import { sanitizeSignedValue } from '../../utils/chartSafety';
import tokens, { chartTokens } from '../../theme/tokens';

const formatDelta = (value) => {
  const number = sanitizeSignedValue(value, -40, 40);
  const sign = number > 0 ? '+' : '';
  return `${sign}${number}%`;
};

const mapDeltaData = (comparison = {}) =>
  TRAIT_ORDER.map((traitKey) => ({
    trait: TRAIT_META[traitKey].short,
    delta: sanitizeSignedValue(comparison?.[traitKey] || 0, -40, 40),
  }));

const TraitDeltaChart = ({ comparison = {} }) => {
  const data = mapDeltaData(comparison);

  return (
    <div className="chart-shell" aria-label="Trait comparison delta chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} />
          <XAxis dataKey="trait" tick={{ fill: chartTokens.axis, fontSize: 12, fontWeight: 700 }} />
          <YAxis domain={[-40, 40]} tick={{ fill: chartTokens.mutedAxis, fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [formatDelta(value), 'Delta']}
            contentStyle={{
              borderRadius: 12,
              border: chartTokens.tooltip.border,
              background: chartTokens.tooltip.background,
              color: chartTokens.tooltip.text,
            }}
            labelStyle={{ color: chartTokens.tooltip.text, fontWeight: 700 }}
          />
          <ReferenceLine y={0} stroke="rgba(148, 163, 200, 0.62)" />
          <Bar
            dataKey="delta"
            radius={[10, 10, 0, 0]}
            fill={tokens.accent.blue}
            minPointSize={2}
            shape={(props) => {
              const { x, y, width, height, value } = props;
              const fill = Number(value) >= 0 ? tokens.state.success : tokens.state.error;
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={fill}
                  rx={10}
                  ry={10}
                />
              );
            }}
            label={{
              position: 'top',
              formatter: (value) => formatDelta(value),
              fill: chartTokens.axis,
              fontSize: 12,
              fontWeight: 700,
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TraitDeltaChart;
