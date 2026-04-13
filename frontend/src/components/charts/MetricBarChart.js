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

const toData = (metrics = {}, labels = {}) =>
  Object.entries(labels)
    .map(([key, label]) => ({
      key,
      label,
      value: Math.max(0, Math.min(100, Math.round(Number(metrics?.[key] || 0)))),
    }))
    .filter((item) => item.value > 0 || Object.keys(metrics || {}).includes(item.key));

const MetricBarChart = ({ metrics = {}, labels = {}, barColor = '#22D3EE', height = 300 }) => {
  const data = useMemo(() => toData(metrics, labels), [metrics, labels]);

  if (!data.length) {
    return <p className="empty-state">Chart data will appear after assessment scoring completes.</p>;
  }

  return (
    <div className="chart-shell" aria-label="Metric bar chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
          <defs>
            <linearGradient id="metricBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={barColor} stopOpacity={0.48} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis dataKey="label" tick={{ fill: '#C9D6F3', fontSize: 11, fontWeight: 700 }} />
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
          <Bar
            dataKey="value"
            fill="url(#metricBarGradient)"
            radius={[10, 10, 0, 0]}
            isAnimationActive
            animationDuration={960}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(MetricBarChart);
