const { config } = require('../config/env');
const { extractOutputText, parseJsonFromText } = require('./assessment/aiJson');
const { getOpenAiClient } = require('./assessment/openaiClient');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toText = (value) => String(value || '').trim();

const toList = (value, limit = 8) =>
  (Array.isArray(value) ? value : [])
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, limit);

const topEntries = (source = {}, count = 3) =>
  Object.entries(source || {})
    .map(([key, value]) => [key, Number(value || 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);

const fallbackNarrative = ({
  aiProfile = {},
  traitVector = {},
  careers = [],
  skills = [],
}) => {
  const topTraits = topEntries(traitVector, 3).map(([key, value]) => `${key} ${Math.round(value)}%`);
  const lowestTraits = topEntries(
    Object.fromEntries(
      Object.entries(traitVector || {}).map(([key, value]) => [key, -Number(value || 0)])
    ),
    2
  ).map(([key, value]) => `${key} ${Math.round(Math.abs(value))}%`);

  const topCareers = toList((careers || []).map((item) => item?.career || item?.title), 3);

  return {
    summary: `Your profile is strongest in ${topTraits.join(', ') || 'balanced traits'}, with clear momentum in ${toText(
      aiProfile.domain || 'your current domain'
    )}. Recommended career directions are ${topCareers.join(', ') || 'role paths aligned to your profile'}.`,
    strengths: [
      `Core domain fit: ${toText(aiProfile.domain || 'general')} with signals in ${toList(aiProfile.subdomains, 3).join(', ') || 'cross-functional contexts'}.`,
      `Skill leverage: ${toList(skills.length ? skills : aiProfile.skills, 4).join(', ') || 'foundational transferable skills'}.`,
      `Behavior profile supports execution with focus on ${toList(aiProfile.work_style, 2).join(' and ') || 'structured delivery'}.`,
    ],
    weaknesses: [
      `Lower trait zones currently include ${lowestTraits.join(', ') || 'areas requiring balance'}.`,
      'Decision consistency can improve with tighter post-decision review loops.',
    ],
    growth_path: [
      'Pick one target role and ship two measurable portfolio outcomes this quarter.',
      'Close top two skill gaps from your highest-ranked career path.',
      'Review weekly behavior patterns to stabilize consistency under pressure.',
    ],
  };
};

const normalizeNarrative = (payload = {}, fallback = {}) => ({
  summary: toText(payload.summary || fallback.summary),
  strengths: toList(payload.strengths || fallback.strengths, 6),
  weaknesses: toList(payload.weaknesses || fallback.weaknesses, 6),
  growth_path: toList(payload.growth_path || payload.growthPath || fallback.growth_path, 6),
});

const generateResultNarrative = async ({
  aiProfile = {},
  traitVector = {},
  careers = [],
  skills = [],
  cognitiveVector = {},
  behaviorVector = {},
} = {}) => {
  const fallback = fallbackNarrative({
    aiProfile,
    traitVector,
    careers,
    skills,
  });

  if (!config.openaiApiKey) {
    return fallback;
  }

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.25,
      max_output_tokens: 1200,
      input: [
        {
          role: 'system',
          content:
            'Generate concise psychometric narratives grounded strictly in provided profile evidence. Return JSON only.',
        },
        {
          role: 'user',
          content: `Generate personality summary.\n\nUse:\n\ntop traits\ntop skills\ndomain\ncareers\n\nReturn:\n\nsummary\nstrengths\nweaknesses\ngrowth path\n\nJSON schema:\n{\n  "summary": "",\n  "strengths": [""],\n  "weaknesses": [""],\n  "growth_path": [""]\n}\n\nProfile data:\n${JSON.stringify(
            {
              aiProfile,
              traitVector,
              cognitiveVector,
              behaviorVector,
              careers: (careers || []).slice(0, 5),
              skills: toList(skills.length ? skills : aiProfile.skills, 12),
            },
            null,
            2
          )}`,
        },
      ],
    });

    const parsed = parseJsonFromText(extractOutputText(response), 'AI narrative output invalid');
    return normalizeNarrative(parsed, fallback);
  } catch (error) {
    return fallback;
  }
};

const computeConfidenceScore = ({
  consistency = 0,
  trait_variance = 0,
  coverage = 0,
  career_gap = 0,
  cv_strength = 0,
  response_confidence = 0,
} = {}) => {
  const normalized =
    clamp(Number(consistency || 0), 0, 1) * 0.25 +
    clamp(Number(trait_variance || 0), 0, 1) * 0.2 +
    clamp(Number(coverage || 0), 0, 1) * 0.2 +
    clamp(Number(career_gap || 0), 0, 1) * 0.15 +
    clamp(Number(cv_strength || 0), 0, 1) * 0.1 +
    clamp(Number(response_confidence || 0), 0, 1) * 0.1;

  const confidenceScore = clamp(Math.round(normalized * 100), 0, 100);

  return {
    confidenceScore,
    confidence: Number((confidenceScore / 100).toFixed(4)),
    confidenceBand: confidenceScore < 45 ? 'low' : confidenceScore <= 70 ? 'medium' : 'high',
  };
};

module.exports = {
  generateResultNarrative,
  computeConfidenceScore,
};
