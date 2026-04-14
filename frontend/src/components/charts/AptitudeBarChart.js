import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import tokens, { chartTokens } from '../../theme/tokens';

const LABELS = {
  logical_reasoning: 'Logical',
  numerical_reasoning: 'Numerical',
  verbal_reasoning: 'Verbal',
};

const toData = (aptitudeSignals = {}) =>
  Object.keys(LABELS).map((key) => ({
    key,
    label: LABELS[key],
    value: Math.max(0, Math.min(100, Math.round(Number(aptitudeSignals?.[key] || 0)))),
  }));

const AptitudeBarChart = ({ aptitudeSignals = {}, height = 290 }) => {
  const data = useMemo(() => toData(aptitudeSignals), [aptitudeSignals]);
  const hasData = data.some((item) => item.value > 0);

  if (!hasData) {
    return <p className="empty-state">Aptitude chart will appear after adaptive responses are analyzed.</p>;
  }

  return (
    <div className="chart-shell" aria-label="Aptitude bar chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} />
          <XAxis dataKey="label" tick={{ fill: chartTokens.axis, fontSize: 12, fontWeight: 700 }} />
          <YAxis domain={[0, 100]} tick={{ fill: chartTokens.mutedAxis, fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Aptitude']}
            contentStyle={{
              borderRadius: 12,
              border: chartTokens.tooltip.border,
              background: chartTokens.tooltip.background,
              color: chartTokens.tooltip.text,
            }}
            labelStyle={{ color: chartTokens.tooltip.text, fontWeight: 700 }}
          />
          <Bar dataKey="value" fill={tokens.accent.amber} radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(AptitudeBarChart);
