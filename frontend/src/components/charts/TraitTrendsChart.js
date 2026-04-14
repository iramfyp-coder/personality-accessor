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
import tokens, { chartTokens } from '../../theme/tokens';

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
          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: chartTokens.axis, fontSize: compact ? 10 : 12, fontWeight: 700 }}
            axisLine={{ stroke: chartTokens.axisLine }}
            tickLine={{ stroke: chartTokens.axisLine }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: chartTokens.mutedAxis, fontSize: 11 }}
            axisLine={{ stroke: chartTokens.axisLine }}
            tickLine={{ stroke: chartTokens.axisLine }}
            width={compact ? 32 : 40}
          />
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
          {!compact && <Legend wrapperStyle={{ color: chartTokens.axis }} />}
          {TRAIT_ORDER.map((traitKey) => (
            <Line
              key={traitKey}
              type="monotone"
              dataKey={traitKey}
              name={TRAIT_META[traitKey].short}
              stroke={TRAIT_COLORS[traitKey]}
              strokeWidth={2}
              dot={compact ? false : { r: 3, fill: TRAIT_COLORS[traitKey], stroke: tokens.background.secondary, strokeWidth: 1 }}
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
