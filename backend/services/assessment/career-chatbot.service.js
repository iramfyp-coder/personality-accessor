const { config } = require('../../config/env');
const { extractOutputText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');

const toText = (value) => String(value || '').trim();

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
  const aiProfile =
    session?.aiProfile && typeof session.aiProfile === 'object' ? session.aiProfile : {};

  const skills = (Array.isArray(cv.skills) ? cv.skills : [])
    .map((entry) => toText(entry?.name || entry))
    .filter(Boolean)
    .slice(0, 12);

  const interests = (Array.isArray(cv.interests) ? cv.interests : [])
    .map((entry) => toText(entry))
    .filter(Boolean)
    .slice(0, 10);

  const careers = toCareerList(result, session).slice(0, 8).map((item) => ({
    career: item.career,
    score: Number(item.score || 0),
    confidence: Number(item.confidence || 0),
    reason: toText(item.reason || item.why_fit),
    skill_gaps: Array.isArray(item.skill_gaps) ? item.skill_gaps : [],
    growth_suggestions: Array.isArray(item.growth_suggestions)
      ? item.growth_suggestions
      : [],
  }));

  const topSkillGaps = Array.from(
    new Set(
      careers
        .flatMap((item) => (Array.isArray(item.skill_gaps) ? item.skill_gaps : []))
        .map((item) => toText(item))
        .filter(Boolean)
    )
  ).slice(0, 10);

  return {
    aiProfile,
    domain: toText(aiProfile.domain || cv.source_domain || 'general'),
    personalityTraits: personality?.traits || {},
    cognitiveVector: personality?.cognitiveScores || {},
    behaviorVector: behavior?.vector || {},
    topTraits: toTopEntries(personality?.traits || {}, 3),
    topCognitive: toTopEntries(personality?.cognitiveScores || {}, 3),
    topBehavior: toTopEntries(behavior?.vector || {}, 3),
    skills,
    interests,
    careers,
    topSkillGaps,
  };
};

const buildFallback = ({ context, message }) => {
  const topCareer = context.careers?.[0] || null;
  const topTraits = (context.topTraits || [])
    .map((item) => `${item.key} ${Math.round(item.value)}%`)
    .join(', ');

  const topGaps = (context.topSkillGaps || []).slice(0, 3).join(', ');

  if (topCareer) {
    return [
      `Profile-grounded answer for: ${message}`,
      `Top match: ${topCareer.career} (${Math.round(topCareer.score || 0)}%).`,
      `Evidence: traits (${topTraits || 'balanced profile'}) and domain (${context.domain}).`,
      topGaps ? `Primary skill gaps to close: ${topGaps}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return `Using your profile context, I can answer with specific career fit logic. Ask about a target role, growth path, or skill-gap plan.`;
};

const generateCareerChatReply = async ({ session, result, message }) => {
  const context = toProfileContext({ session, result });

  if (!config.openaiApiKey) {
    return buildFallback({ context, message });
  }

  const recentHistory = (session.chatHistory || [])
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.message}`)
    .join('\n');

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.2,
      max_output_tokens: 700,
      input: [
        {
          role: 'system',
          content:
            'You are a profile-grounded career assistant. Always answer using provided profile evidence. Use sections and bullet points with clear reasoning. Avoid generic advice.',
        },
        {
          role: 'user',
          content: `Answer using this profile.\n\nUse:\n\nbullet points\nsections\nclear reasoning\n\nProfile context:\n${JSON.stringify(context, null, 2)}\n\nRecent chat:\n${recentHistory || 'none'}\n\nUser question:\n${message}\n\nOutput style:\n- Start with a short direct answer.\n- Then provide sections: Evidence, Career Fit, Skill Gaps, Next Actions.\n- Reference profile traits, skills, and ranked careers explicitly.`,
        },
      ],
    });

    const text = toText(extractOutputText(response));
    if (text) {
      return text;
    }

    return buildFallback({ context, message });
  } catch (error) {
    return buildFallback({ context, message });
  }
};

module.exports = {
  generateCareerChatReply,
};
