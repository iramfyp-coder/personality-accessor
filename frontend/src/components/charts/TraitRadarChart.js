import React, { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { toTraitArray } from '../../utils/traits';

const TraitRadarChart = ({ traits = {}, compact = false, height = 320 }) => {
  const data = useMemo(
    () =>
      toTraitArray(traits).map((item) => ({
        trait: item.trait,
        label: item.label,
        score: item.score,
      })),
    [traits]
  );

  return (
    <div className="chart-shell" aria-label="Trait radar chart">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} outerRadius={compact ? '64%' : '74%'}>
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.42} />
              <stop offset="55%" stopColor="#3B82F6" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#A855F7" stopOpacity={0.36} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="rgba(164, 185, 233, 0.2)" />
          <PolarAngleAxis
            dataKey="trait"
            tick={{ fill: '#C9D6F3', fontSize: compact ? 11 : 12, fontWeight: 700 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tickCount={6}
            tick={{ fill: '#7F94BE', fontSize: compact ? 10 : 11 }}
          />
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
          <Radar
            name="Trait score"
            dataKey="score"
            fill="url(#radarFill)"
            stroke="#38BDF8"
            strokeWidth={2.4}
            dot={{
              r: compact ? 2.8 : 3.6,
              strokeWidth: 1.4,
              stroke: '#b9f2ff',
              fill: '#0ea5e9',
            }}
            isAnimationActive
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(TraitRadarChart);
