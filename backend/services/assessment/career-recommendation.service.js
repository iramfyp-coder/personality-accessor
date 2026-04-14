const { recommendCareersWithIntelligence } = require('../ai-career-intelligence.service');

const CAREER_CLUSTERS = ['AI_Similarity'];
const WEIGHTS = {
  ai_match: 0.62,
  embedding_similarity: 0.38,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toText = (value) => String(value || '').trim();

const toList = (value, limit = 24) =>
  (Array.isArray(value) ? value : [])
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, limit);

const inferConfidenceBand = (value = 0) => {
  const score = Number(value || 0);
  if (score < 45) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const buildRoadmap = ({ growthPath = [], keySkills = [] }) => [
  {
    stage: 'Foundation',
    summary:
      growthPath[0] ||
      `Build baseline capability in ${toList(keySkills, 2).join(', ') || 'core role skills'} through targeted projects.`,
  },
  {
    stage: 'Execution',
    summary:
      growthPath[1] ||
      'Deliver measurable outcomes across at least one cross-functional initiative.',
  },
  {
    stage: 'Leadership',
    summary:
      growthPath[2] ||
      'Scale from individual execution to strategic ownership and mentorship.',
  },
];

const recommendCareers = async ({
  cvData = {},
  aiProfile = {},
  personalityProfile = {},
  traitVectorOutput = {},
  cognitiveScores = {},
  behaviorVector = {},
} = {}) => {
  const skills = toList((cvData.skills || []).map((skill) => skill?.name || skill), 32);
  const interests = toList(cvData.interests || [], 24);

  const traitVector =
    traitVectorOutput?.oceanVector && typeof traitVectorOutput.oceanVector === 'object'
      ? traitVectorOutput.oceanVector
      : personalityProfile?.trait_scores || {};

  const cognitiveVector =
    traitVectorOutput?.cognitiveVector && typeof traitVectorOutput.cognitiveVector === 'object'
      ? traitVectorOutput.cognitiveVector
      : cognitiveScores || {};

  const behaviorSource =
    traitVectorOutput?.behaviorVector && typeof traitVectorOutput.behaviorVector === 'object'
      ? traitVectorOutput.behaviorVector
      : behaviorVector || {};

  const behaviorNormalized = {
    leadership: Number(behaviorSource.leadership || 50),
    analysis: Number(behaviorSource.analysis || behaviorSource.analytical || 50),
    creativity: Number(behaviorSource.creativity || 50),
    risk: Number(behaviorSource.risk || behaviorSource.risk_tolerance || 50),
    collaboration: Number(behaviorSource.collaboration || behaviorSource.team_preference || 50),
    execution: Number(behaviorSource.execution || behaviorSource.decision_speed || 50),
  };

  const ranked = await recommendCareersWithIntelligence({
    aiProfile,
    traitVector,
    cognitiveVector,
    behaviorVector: behaviorNormalized,
    skills,
    interests,
  });

  const recommendations = ranked.slice(0, 8).map((item) => {
    const growthPath = toList(item.growth_path || [], 6);
    const keySkills = toList(item.key_skills_to_build || [], 8);
    const roadmap = buildRoadmap({
      growthPath,
      keySkills,
    });

    const skillAlignment = clamp(100 - Number((item.skill_gaps || []).length || 0) * 15, 0, 100);

    return {
      career: item.career,
      career_id: item.career_id || toText(item.career).toLowerCase().replace(/\s+/g, '_'),
      cluster: toText(aiProfile?.domain || 'general') || 'general',
      score: clamp(Math.round(Number(item.match || item.score || 0)), 0, 100),
      role_match: clamp(Math.round(Number(item.match || item.score || 0)), 0, 100),
      personality_score: clamp(Math.round(Number(item.match || item.score || 0)), 0, 100),
      career_score: clamp(Math.round(Number(item.match || item.score || 0)), 0, 100),
      skill_alignment: skillAlignment,
      personality_alignment: clamp(Math.round(Number(item.match || item.score || 0)), 0, 100),
      subject_match: clamp(Math.round(Number(item.match || item.score || 0) * 0.8), 0, 100),
      aptitude_match: clamp(Math.round(Number(item.match || item.score || 0) * 0.75), 0, 100),
      interest_match: clamp(Math.round(Number(item.match || item.score || 0) * 0.82), 0, 100),
      cognitive_match: clamp(Math.round(Number(item.match || item.score || 0) * 0.84), 0, 100),
      behavior_match: clamp(Math.round(Number(item.match || item.score || 0) * 0.8), 0, 100),
      skill_penalty: Number((100 - skillAlignment).toFixed(2)),
      cluster_affinity: clamp(Math.round(Number(item.match || item.score || 0) * 0.9), 0, 100),
      response_alignment: clamp(Math.round(Number(item.match || item.score || 0) * 0.88), 0, 100),
      growth_potential: clamp(Math.round(Number(item.match || item.score || 0) * 0.92), 0, 100),
      why_fit: toText(item.why_fit || item.reason),
      explanation: {
        top_signals: [
          `AI profile fit (${Math.round(Number(item.match || item.score || 0))}%)`,
          `Embedding similarity (${Math.round(Number(item.embedding_similarity || 0) * 100)}%)`,
          `${toText(aiProfile?.domain || 'domain')} alignment`,
        ],
        summary: toText(item.reason || item.why_fit),
      },
      key_skills_to_build: keySkills,
      skill_gaps: toList(item.skill_gaps || [], 8),
      growth_suggestions: growthPath,
      roadmap_timeline: roadmap,
      match_breakdown: {
        weights: WEIGHTS,
        ai_match: clamp(Math.round(Number(item.match || item.score || 0)), 0, 100),
        embedding_similarity: clamp(Math.round(Number(item.embedding_similarity || 0) * 100), 0, 100),
      },
      confidence: clamp(Math.round(Number(item.confidence || 0)), 0, 100),
      confidence_band: inferConfidenceBand(Number(item.confidence || 0)),
      reason: toText(item.reason),
      embedding_similarity: Number(item.embedding_similarity || 0),
    };
  });

  const careerRoadmap = recommendations[0]?.roadmap_timeline || [];

  const personalityScoreAvg = recommendations.length
    ? Math.round(
        recommendations.reduce((sum, item) => sum + Number(item.personality_score || 0), 0) /
          recommendations.length
      )
    : 0;

  const careerScoreAvg = recommendations.length
    ? Math.round(
        recommendations.reduce((sum, item) => sum + Number(item.career_score || 0), 0) /
          recommendations.length
      )
    : 0;

  const whyNotCatalog = recommendations.reduce((accumulator, career) => {
    accumulator[career.career] = {
      cluster: career.cluster,
      score: career.score,
      top_signals: career.explanation?.top_signals || [],
      key_gaps: career.skill_gaps || [],
    };
    return accumulator;
  }, {});

  const topCluster = toText(aiProfile?.domain || 'general') || 'general';

  return {
    recommendations,
    careerRoadmap,
    aptitudeSignals: {
      logical_reasoning: Number(cognitiveVector.analytical || 50),
      numerical_reasoning: Number(cognitiveVector.systematic || 50),
      verbal_reasoning: Number(cognitiveVector.strategic || 50),
    },
    cluster: topCluster,
    clusterLabel: `${topCluster} Domain`,
    userCluster: topCluster,
    whyNotCatalog,
    balance: {
      personalityScore: personalityScoreAvg,
      careerScore: careerScoreAvg,
      weights: WEIGHTS,
    },
  };
};

const explainWhyNotCareer = ({ careerName = '', recommendations = [] }) => {
  const normalizedTarget = toText(careerName).toLowerCase();

  if (!normalizedTarget) {
    return {
      career: '',
      found: false,
      score: 0,
      explanation: 'Career name is required.',
      gaps: [],
    };
  }

  const list = Array.isArray(recommendations) ? recommendations : [];

  const exact = list.find(
    (item) => toText(item?.career).toLowerCase() === normalizedTarget
  );

  if (exact) {
    const score = Number(exact.score || 0);

    return {
      career: exact.career,
      found: true,
      score,
      explanation:
        score >= 70
          ? `${exact.career} is already a strong fit in your ranked recommendations.`
          : `${exact.career} ranks lower because your current profile aligns more strongly with higher-ranked paths.`,
      gaps: Array.isArray(exact.skill_gaps) ? exact.skill_gaps : [],
      comparison: {
        top_signals: exact.explanation?.top_signals || [],
        cluster: exact.cluster || '',
      },
    };
  }

  const top = list.slice(0, 3);
  const score = top.length
    ? clamp(Math.round(top.reduce((sum, item) => sum + Number(item.score || 0), 0) / top.length - 18), 0, 100)
    : 35;

  return {
    career: careerName,
    found: false,
    score,
    explanation:
      top.length > 0
        ? `${careerName} is not currently in the top recommendations. Your highest alignment is with ${top
            .map((item) => item.career)
            .join(', ')} based on AI profile and embedding similarity.`
        : `${careerName} could not be validated against ranked recommendations yet.`,
    gaps: [],
    comparison: {
      nearest_recommendations: top.map((item) => ({
        career: item.career,
        score: item.score,
      })),
    },
  };
};

module.exports = {
  CAREER_CLUSTERS,
  WEIGHTS,
  recommendCareers,
  explainWhyNotCareer,
};
