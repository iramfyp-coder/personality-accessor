const { config } = require('../../config/env');
const { extractOutputText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const toCareerList = (result, session) => {
  if (Array.isArray(result?.career?.recommendations)) {
    return result.career.recommendations;
  }

  if (Array.isArray(session?.careerRecommendations)) {
    return session.careerRecommendations;
  }

  return [];
};

const toTopEntries = (source = {}, count = 3) =>
  Object.entries(source || {})
    .map(([key, value]) => ({ key, value: Number(value || 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);

const toProfileContext = ({ session, result }) => {
  const cv = result?.cvData || session?.cvData || {};
  const personality = result?.personality || {};
  const behavior = result?.behavior || {};

  const skills = (Array.isArray(cv.skills) ? cv.skills : [])
    .map((entry) => String(entry?.name || entry || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  const interests = (Array.isArray(cv.interests) ? cv.interests : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const careerRecommendations = toCareerList(result, session).slice(0, 8).map((item) => ({
    career: item.career,
    score: Number(item.score || 0),
    skill_alignment: Number(item.skill_alignment || 0),
    subject_match: Number(item.subject_match || 0),
    cognitive_match: Number(item.cognitive_match || 0),
    behavior_match: Number(item.behavior_match || 0),
    why_fit: item.why_fit || '',
    skill_gaps: Array.isArray(item.skill_gaps) ? item.skill_gaps : [],
  }));

  return {
    archetype:
      personality?.archetypes?.personalityType ||
      personality?.archetypes?.interpretation?.label ||
      personality?.personality_type ||
      'Unknown',
    personalityVector: personality?.traits || personality?.trait_scores || {},
    cognitiveVector: personality?.cognitiveScores || {},
    behaviorVector: behavior?.vector || {},
    topTraits: toTopEntries(personality?.traits || personality?.trait_scores || {}, 3),
    topCognitive: toTopEntries(personality?.cognitiveScores || {}, 3),
    topBehavior: toTopEntries(behavior?.vector || {}, 3),
    skills,
    interests,
    careers: careerRecommendations,
  };
};

const careerFromMessage = (message = '', recommendations = []) => {
  const lower = String(message || '').toLowerCase();
  const list = Array.isArray(recommendations) ? recommendations : [];

  const direct = list.find((item) => lower.includes(String(item.career || '').toLowerCase()));
  if (direct) {
    return direct;
  }

  const aliases = {
    'power systems': ['power systems engineer', 'electrical engineer'],
    electrical: ['electrical engineer', 'power systems engineer'],
    control: ['control systems engineer', 'automation engineer'],
    automation: ['automation engineer', 'control systems engineer'],
    embedded: ['embedded engineer'],
    backend: ['backend engineer', 'software engineer'],
    frontend: ['frontend engineer', 'ux designer'],
    business: ['business analyst', 'product manager'],
  };

  const mapped = Object.entries(aliases).find(([token]) => lower.includes(token));
  if (!mapped) {
    return null;
  }

  const candidates = mapped[1];
  return (
    list.find((item) => candidates.some((candidate) => String(item.career || '').toLowerCase() === candidate)) ||
    null
  );
};

const buildSpecificFallback = ({ context, message }) => {
  const recommendations = context.careers || [];
  const topCareer = recommendations[0] || null;
  const askedCareer = careerFromMessage(message, recommendations);

  const topTraits = context.topTraits
    .map((item) => `${item.key} ${Math.round(item.value)}%`)
    .join(', ');
  const topCognitive = context.topCognitive
    .map((item) => `${item.key.replace(/_/g, ' ')} ${Math.round(item.value)}%`)
    .join(', ');
  const topBehavior = context.topBehavior
    .map((item) => `${item.key.replace(/_/g, ' ')} ${Math.round(item.value)}%`)
    .join(', ');

  if (askedCareer) {
    const skillsLine = context.skills.slice(0, 4).join(', ');
    const gaps = (askedCareer.skill_gaps || []).slice(0, 2).join(', ');

    return `${askedCareer.career} currently matches your profile at ${Math.round(
      askedCareer.score || 0
    )}%. Core evidence: traits (${topTraits || 'balanced'}), cognition (${topCognitive || 'balanced'}), and behavior (${topBehavior || 'balanced'}). Your strongest CV signals are ${
      skillsLine || 'general skills'
    }.${gaps ? ` To improve fit further, close gaps in ${gaps}.` : ''}`;
  }

  if (topCareer) {
    const shortlist = recommendations.slice(0, 3).map((item) => item.career).join(', ');
    return `Based on your profile, the strongest direction is ${topCareer.career} (${Math.round(
      topCareer.score || 0
    )}%). Key signals are traits (${topTraits || 'balanced'}), cognitive strengths (${topCognitive || 'balanced'}), and behavior (${topBehavior || 'balanced'}). Current top career set is ${shortlist}.`;
  }

  return `Your strongest current profile signals are traits (${topTraits || 'balanced'}), cognition (${topCognitive || 'balanced'}), and behavior (${topBehavior || 'balanced'}). Ask about a specific role and I will evaluate fit against your profile vectors.`;
};

const generateCareerChatReply = async ({ session, result, message }) => {
  const context = toProfileContext({ session, result });

  if (!config.openaiApiKey) {
    return buildSpecificFallback({ context, message });
  }

  const recentHistory = (session.chatHistory || [])
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.message}`)
    .join('\n');

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.2,
      max_output_tokens: 520,
      input: [
        {
          role: 'system',
          content:
            'You are a profile-grounded career reasoning assistant. Based on this profile, answer the user specifically. Use provided vectors, skills, interests, and career scores. Never give generic advice. Include concrete percentages where relevant.',
        },
        {
          role: 'user',
          content: `Profile context:\n${JSON.stringify(context, null, 2)}\n\nRecent chat:\n${
            recentHistory || 'none'
          }\n\nUser question:\n${message}\n\nInstruction: If user asks about a career, explain fit/mismatch using personality vector + cognitive vector + behavior vector + skills + top recommendations.`,
        },
      ],
    });

    const text = String(extractOutputText(response) || '').replace(/\s+/g, ' ').trim();
    if (text) {
      return text;
    }

    return buildSpecificFallback({ context, message });
  } catch (error) {
    return buildSpecificFallback({ context, message });
  }
};

module.exports = {
  generateCareerChatReply,
};
