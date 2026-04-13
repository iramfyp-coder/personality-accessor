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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis dataKey="label" tick={{ fill: '#C9D6F3', fontSize: 12, fontWeight: 700 }} />
          <YAxis domain={[0, 100]} tick={{ fill: '#7F94BE', fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Aptitude']}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgba(126, 153, 212, 0.5)',
              background: 'rgba(11, 15, 26, 0.94)',
              color: '#dce8ff',
            }}
            labelStyle={{ color: '#dce8ff', fontWeight: 700 }}
          />
          <Bar dataKey="value" fill="#F59E0B" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(AptitudeBarChart);
