import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { sanitizeChartValue } from '../../utils/chartSafety';

const mapCareerData = (recommendations = []) =>
  (Array.isArray(recommendations) ? recommendations : [])
    .slice(0, 6)
    .map((item) => ({
      role: String(item.career || 'Role'),
      overall: sanitizeChartValue(item.score || item.role_match || 0),
      personality: sanitizeChartValue(item.personality_score || item.personality_alignment || 0),
      career: sanitizeChartValue(item.career_score || item.skill_alignment || 0),
    }));

const CareerAlignmentChart = ({ recommendations = [], height = 320 }) => {
  const data = useMemo(() => mapCareerData(recommendations), [recommendations]);

  if (!data.length) {
    return <p className="empty-state">Career alignment chart will appear after recommendations are generated.</p>;
  }

  return (
    <div className="chart-shell" aria-label="Career alignment chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 6 }}>
          <defs>
            <linearGradient id="careerOverall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity={0.52} />
            </linearGradient>
            <linearGradient id="careerPersonality" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#A855F7" stopOpacity={0.52} />
            </linearGradient>
            <linearGradient id="careerCareer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0.52} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(164, 185, 233, 0.2)" />
          <XAxis
            dataKey="role"
            tick={{ fill: '#C9D6F3', fontSize: 11, fontWeight: 700 }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={62}
          />
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
          <Legend wrapperStyle={{ color: '#dce8ff' }} />
          <Bar
            dataKey="overall"
            name="Overall Match"
            fill="url(#careerOverall)"
            radius={[8, 8, 0, 0]}
            isAnimationActive
            animationDuration={920}
          />
          <Bar
            dataKey="personality"
            name="Personality Score"
            fill="url(#careerPersonality)"
            radius={[8, 8, 0, 0]}
            isAnimationActive
            animationDuration={980}
          />
          <Bar
            dataKey="career"
            name="Career Score"
            fill="url(#careerCareer)"
            radius={[8, 8, 0, 0]}
            isAnimationActive
            animationDuration={1040}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(CareerAlignmentChart);
