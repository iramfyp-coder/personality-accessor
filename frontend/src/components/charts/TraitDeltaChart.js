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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis dataKey="trait" tick={{ fill: '#C9D6F3', fontSize: 12, fontWeight: 700 }} />
          <YAxis domain={[-40, 40]} tick={{ fill: '#7F94BE', fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [formatDelta(value), 'Delta']}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgba(126, 153, 212, 0.5)',
              background: 'rgba(11, 15, 26, 0.94)',
              color: '#dce8ff',
            }}
            labelStyle={{ color: '#dce8ff', fontWeight: 700 }}
          />
          <ReferenceLine y={0} stroke="rgba(165, 184, 230, 0.62)" />
          <Bar
            dataKey="delta"
            radius={[10, 10, 0, 0]}
            fill="#3B82F6"
            minPointSize={2}
            shape={(props) => {
              const { x, y, width, height, value } = props;
              const fill = Number(value) >= 0 ? '#22C55E' : '#EF4444';
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
              fill: '#CFE0FF',
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
