import React, { useMemo } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TRAIT_ORDER, TRAIT_META } from '../../utils/traits';
import { traitColors } from '../../theme/colors';
import { sanitizeChartValue } from '../../utils/chartSafety';

const TRAIT_COLORS = traitColors;

const formatDateLabel = (value) => {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
};

const mapTrendData = (trends = []) =>
  trends.map((entry) => ({
    date: entry.date,
    label: formatDateLabel(entry.date),
    O: sanitizeChartValue(entry.traits?.O || 0),
    C: sanitizeChartValue(entry.traits?.C || 0),
    E: sanitizeChartValue(entry.traits?.E || 0),
    A: sanitizeChartValue(entry.traits?.A || 0),
    N: sanitizeChartValue(entry.traits?.N || 0),
  }));

const TraitTrendsChart = ({ trends = [], compact = false, height = 320 }) => {
  const data = useMemo(() => mapTrendData(trends), [trends]);
  const visibleData = useMemo(
    () => (compact && data.length > 6 ? data.slice(-6) : data),
    [compact, data]
  );

  return (
    <div className="chart-shell" aria-label="Trait trends chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={visibleData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#C9D6F3', fontSize: compact ? 10 : 12, fontWeight: 700 }}
            axisLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
            tickLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#7F94BE', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
            tickLine={{ stroke: 'rgba(164, 185, 233, 0.25)' }}
            width={compact ? 32 : 40}
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
          {!compact && <Legend wrapperStyle={{ color: '#dce8ff' }} />}
          {TRAIT_ORDER.map((traitKey) => (
            <Line
              key={traitKey}
              type="monotone"
              dataKey={traitKey}
              name={TRAIT_META[traitKey].short}
              stroke={TRAIT_COLORS[traitKey]}
              strokeWidth={2}
              dot={compact ? false : { r: 3, fill: TRAIT_COLORS[traitKey], stroke: '#0B0F1A', strokeWidth: 1 }}
              activeDot={{ r: compact ? 4 : 6, fill: TRAIT_COLORS[traitKey] }}
              isAnimationActive
              animationDuration={760}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(TraitTrendsChart);
