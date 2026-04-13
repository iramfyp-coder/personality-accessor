const { config } = require('../../config/env');
const { extractOutputText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const FALLBACK_RESPONSES = {
  default:
    'Your profile shows strongest alignment where your core skills and behavioral style overlap. Focus on the top recommendations and close the top 2 skill gaps first.',
  skills:
    'Based on your report, improve one execution skill and one communication skill in parallel. This combination usually increases role readiness fastest.',
  frontend:
    'Frontend can be a strong fit if you enjoy rapid visual feedback, user empathy, and iterative problem solving. Prioritize React, TypeScript, and performance fundamentals.',
  backend:
    'Backend fits profiles that enjoy structured problem solving and system reliability. Focus on APIs, data modeling, and observability practices.',
  refinement:
    'If these suggestions feel off, choose your dominant preference: people, data, creativity, or business.',
};

const toCareerList = (result, session) => {
  if (Array.isArray(result?.career?.recommendations)) {
    return result.career.recommendations;
  }

  if (Array.isArray(session?.careerRecommendations)) {
    return session.careerRecommendations;
  }

  return [];
};

const UNSATISFIED_TOKENS = [
  'not satisfied',
  'not happy',
  'not good',
  'dont like',
  "don't like",
  'not accurate',
  'wrong',
  'unsatisfied',
];

const PREFERENCE_TOKENS = {
  people: ['people', 'team', 'clients', 'leadership', 'communication'],
  data: ['data', 'analytics', 'ai', 'ml', 'machine learning', 'numbers'],
  creativity: ['creative', 'creativity', 'design', 'ux', 'innovation'],
  business: ['business', 'strategy', 'operations', 'market', 'growth'],
};

const detectPreference = (message = '') => {
  const lower = String(message || '').toLowerCase();

  return Object.keys(PREFERENCE_TOKENS).find((key) =>
    PREFERENCE_TOKENS[key].some((token) => lower.includes(token))
  );
};

const isUnsatisfied = (message = '') => {
  const lower = String(message || '').toLowerCase();
  return UNSATISFIED_TOKENS.some((token) => lower.includes(token));
};

const scoreCareerByPreference = ({ career = {}, preference = '' }) => {
  const lower = `${career.career || ''} ${career.why_fit || ''} ${(career.key_skills_to_build || []).join(' ')}`.toLowerCase();
  const tokens = PREFERENCE_TOKENS[preference] || [];
  const hitCount = tokens.reduce((sum, token) => sum + (lower.includes(token) ? 1 : 0), 0);
  return hitCount;
};

const recalculateByPreference = ({ recommendations = [], preference = '' }) =>
  (Array.isArray(recommendations) ? recommendations : [])
    .map((item) => ({
      ...item,
      _prefScore: scoreCareerByPreference({ career: item, preference }),
    }))
    .sort((a, b) => {
      const bonusDiff = Number(b._prefScore || 0) - Number(a._prefScore || 0);
      if (bonusDiff !== 0) {
        return bonusDiff;
      }

      return Number(b.score || 0) - Number(a.score || 0);
    })
    .slice(0, 3);

const fallbackCareerChat = ({ message = '', session, result }) => {
  const text = String(message || '').toLowerCase();
  const recommendations = toCareerList(result, session);
  const top = recommendations[0];
  const preference = detectPreference(text);

  if (isUnsatisfied(text) && !preference) {
    return `Understood. ${FALLBACK_RESPONSES.refinement}`;
  }

  if (preference) {
    const reranked = recalculateByPreference({ recommendations, preference });
    const summary = reranked.map((item) => item.career).join(', ');

    if (summary) {
      return `Recalculated for ${preference} preference. Stronger paths now: ${summary}.`;
    }

    return `Preference noted: ${preference}. ${FALLBACK_RESPONSES.skills}`;
  }

  if (text.includes('frontend')) {
    return FALLBACK_RESPONSES.frontend;
  }

  if (text.includes('backend')) {
    return FALLBACK_RESPONSES.backend;
  }

  if (text.includes('skill') || text.includes('improve')) {
    const first = top?.key_skills_to_build?.slice(0, 3).join(', ');
    return first
      ? `Top skills to improve next: ${first}. ${FALLBACK_RESPONSES.skills}`
      : FALLBACK_RESPONSES.skills;
  }

  if (text.includes('why') && top) {
    return `${top.career} is currently your strongest fit: ${top.why_fit}`;
  }

  return FALLBACK_RESPONSES.default;
};

const buildAiContext = ({ session, result }) => {
  const cv = result?.cvData || session.cvData || {};
  const personality = result?.personality || session.personalityProfile || {};

  return {
    name: cv.name || 'Candidate',
    topSkills: (cv.skills || []).slice(0, 8).map((skill) => skill.name),
    personalityType:
      personality.archetypes?.personalityType || personality.personality_type || 'Unknown',
    traitScores: personality.traits || personality.trait_scores || {},
    strengths:
      personality.archetypes?.dominantStrengths || personality.dominant_strengths || [],
    weaknesses: personality.archetypes?.weaknesses || personality.weaknesses || [],
    careerRecommendations: toCareerList(result, session),
  };
};

const generateCareerChatReply = async ({ session, result, message }) => {
  const preference = detectPreference(message);
  const recommendations = toCareerList(result, session);

  if (isUnsatisfied(message) && !preference) {
    return `I can refine your recommendations. Do you prefer people, data, creativity, or business?`;
  }

  if (preference) {
    const reranked = recalculateByPreference({ recommendations, preference });
    const topNames = reranked.map((item) => item.career).join(', ');

    if (topNames) {
      return `Based on your ${preference} preference, I recalculated your top paths: ${topNames}.`;
    }
  }

  if (!config.openaiApiKey) {
    return fallbackCareerChat({ message, session, result });
  }

  const context = buildAiContext({ session, result });

  const recentHistory = (session.chatHistory || [])
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.message}`)
    .join('\n');

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.35,
      max_output_tokens: 500,
      input: [
        {
          role: 'system',
          content:
            'You are a career coach chatbot. Use provided assessment context only. Keep answers concise, practical, and specific to the candidate. Avoid generic statements.',
        },
        {
          role: 'user',
          content: `Assessment context:\n${JSON.stringify(context, null, 2)}\n\nRecent chat:\n${
            recentHistory || 'none'
          }\n\nUser question:\n${message}`,
        },
      ],
    });

    const text = extractOutputText(response);
    if (text) {
      return text;
    }

    return fallbackCareerChat({ message, session, result });
  } catch (error) {
    return fallbackCareerChat({ message, session, result });
  }
};

module.exports = {
  generateCareerChatReply,
};
