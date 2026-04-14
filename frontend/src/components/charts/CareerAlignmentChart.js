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
import tokens, { chartTokens } from '../../theme/tokens';

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
              <stop offset="0%" stopColor={tokens.chart.trait1} stopOpacity={0.95} />
              <stop offset="100%" stopColor={tokens.chart.trait1} stopOpacity={0.52} />
            </linearGradient>
            <linearGradient id="careerPersonality" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.chart.trait3} stopOpacity={0.95} />
              <stop offset="100%" stopColor={tokens.chart.trait3} stopOpacity={0.52} />
            </linearGradient>
            <linearGradient id="careerCareer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.chart.trait4} stopOpacity={0.95} />
              <stop offset="100%" stopColor={tokens.chart.trait4} stopOpacity={0.52} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} />
          <XAxis
            dataKey="role"
            tick={{ fill: chartTokens.axis, fontSize: 11, fontWeight: 700 }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={62}
          />
          <YAxis domain={[0, 100]} tick={{ fill: chartTokens.mutedAxis, fontSize: 11 }} />
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
          <Legend wrapperStyle={{ color: chartTokens.axis }} />
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
