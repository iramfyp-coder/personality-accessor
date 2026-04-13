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

const toData = (skills = []) =>
  (Array.isArray(skills) ? skills : [])
    .slice(0, 8)
    .map((skill) => ({
      name: String(skill.name || 'Skill'),
      value: Math.max(0, Math.min(100, Math.round((Number(skill.level || 0) / 5) * 100))),
      level: Number(skill.level || 0),
    }));

const SkillBarChart = ({ skills = [], height = 320 }) => {
  const data = useMemo(() => toData(skills), [skills]);

  if (!data.length) {
    return <p className="empty-state">Skill chart will appear after CV analysis is available.</p>;
  }

  return (
    <div className="chart-shell" aria-label="Skill bar chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 10, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: '#7F94BE', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: '#C9D6F3', fontSize: 11, fontWeight: 700 }}
          />
          <Tooltip
            formatter={(value, key, payload) => [
              `${value}% (Level ${payload?.payload?.level || 0}/5)`,
              'Skill Strength',
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgba(126, 153, 212, 0.5)',
              background: 'rgba(11, 15, 26, 0.94)',
              color: '#dce8ff',
            }}
            labelStyle={{ color: '#dce8ff', fontWeight: 700 }}
          />
          <Bar dataKey="value" fill="#22C55E" radius={[8, 8, 8, 8]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(SkillBarChart);
