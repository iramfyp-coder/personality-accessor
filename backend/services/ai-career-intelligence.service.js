const CAREERS_KB = require('../data/careers.json');
const { config } = require('../config/env');
const { extractOutputText, parseJsonFromText } = require('./assessment/aiJson');
const { getOpenAiClient } = require('./assessment/openaiClient');

const EMBEDDING_MODEL = 'text-embedding-3-small';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toText = (value) => String(value || '').trim();

const toList = (value, limit = 24) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => toText(item))
        .filter(Boolean)
        .slice(0, limit)
    )
  );

const toCatalog = () =>
  Object.entries(CAREERS_KB || {})
    .map(([careerId, payload]) => {
      const title = toText(payload?.title || careerId);
      if (!title) {
        return null;
      }

      const skills = toList(payload?.skills, 24);
      const subjects = toList(payload?.subjects, 16);
      const interests = toList(payload?.interests, 16);
      const personality = payload?.personality || {};

      const description = [
        `Career: ${title}`,
        `Skills: ${skills.join(', ') || 'n/a'}`,
        `Subjects: ${subjects.join(', ') || 'n/a'}`,
        `Interests: ${interests.join(', ') || 'n/a'}`,
        `Behavior profile: O:${Number(personality.O || 50)}, C:${Number(personality.C || 50)}, E:${Number(personality.E || 50)}, A:${Number(personality.A || 50)}, N:${Number(personality.N || 50)}`,
      ].join('\n');

      return {
        careerId,
        title,
        skills,
        subjects,
        interests,
        description,
      };
    })
    .filter(Boolean);

const cosineSimilarity = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || !right.length) {
    return 0;
  }

  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  for (let index = 0; index < size; index += 1) {
    const l = Number(left[index] || 0);
    const r = Number(right[index] || 0);
    dot += l * r;
    leftMag += l * l;
    rightMag += r * r;
  }

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const tokenize = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

const lexicalSimilarity = (left = '', right = '') => {
  const leftSet = new Set(tokenize(left));
  const rightSet = new Set(tokenize(right));

  if (!leftSet.size || !rightSet.size) {
    return 0;
  }

  let matches = 0;
  rightSet.forEach((token) => {
    if (leftSet.has(token)) {
      matches += 1;
    }
  });

  return matches / Math.max(rightSet.size, 1);
};

const embeddingCache = new Map();

const getEmbedding = async (text = '') => {
  const normalized = toText(text);
  if (!normalized) {
    return [];
  }

  if (embeddingCache.has(normalized)) {
    return embeddingCache.get(normalized);
  }

  if (!config.openaiApiKey) {
    embeddingCache.set(normalized, []);
    return [];
  }

  try {
    const response = await getOpenAiClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalized,
    });

    const vector = Array.isArray(response?.data?.[0]?.embedding)
      ? response.data[0].embedding
      : [];

    embeddingCache.set(normalized, vector);
    return vector;
  } catch (error) {
    embeddingCache.set(normalized, []);
    return [];
  }
};

const normalizeAiCareers = (payload = []) =>
  (Array.isArray(payload) ? payload : [])
    .map((item) => {
      const career = toText(item?.career);
      if (!career) {
        return null;
      }

      return {
        career,
        match: clamp(Math.round(Number(item?.match || 0)), 0, 100),
        confidence: clamp(Math.round(Number(item?.confidence || 0)), 0, 100),
        reason: toText(item?.reason),
        skill_gaps: toList(item?.skill_gaps, 8),
        growth_path: toList(item?.growth_path, 8),
      };
    })
    .filter(Boolean)
    .slice(0, 8);

const buildUserProfileText = ({
  aiProfile = {},
  traitVector = {},
  cognitiveVector = {},
  behaviorVector = {},
  skills = [],
  interests = [],
}) =>
  [
    `Domain: ${toText(aiProfile.domain || 'general')}`,
    `Subdomains: ${toList(aiProfile.subdomains, 12).join(', ') || 'n/a'}`,
    `Skills: ${toList(skills.length ? skills : aiProfile.skills, 24).join(', ') || 'n/a'}`,
    `Interests: ${toList(interests.length ? interests : aiProfile.interests, 16).join(', ') || 'n/a'}`,
    `Traits OCEAN: ${JSON.stringify(traitVector || {})}`,
    `Cognitive style: ${JSON.stringify(cognitiveVector || {})}`,
    `Behavior style: ${JSON.stringify(behaviorVector || {})}`,
    `Experience level: ${toText(aiProfile.experience_level || 'entry')}`,
    `Career signals: ${toList(aiProfile.career_signals, 12).join(', ') || 'n/a'}`,
  ].join('\n');

const heuristicCareerCandidates = ({
  catalog = [],
  aiProfile = {},
  traitVector = {},
  skills = [],
  interests = [],
}) => {
  const profileText = buildUserProfileText({
    aiProfile,
    traitVector,
    cognitiveVector: {},
    behaviorVector: {},
    skills,
    interests,
  });

  return catalog
    .map((career) => {
      const sim = lexicalSimilarity(profileText, career.description);
      const match = clamp(Math.round(sim * 100), 0, 100);
      return {
        career: career.title,
        match,
        confidence: clamp(Math.round(match * 0.78 + 12), 0, 100),
        reason: `Profile similarity with ${career.title} signals domain and skill overlap.`,
        skill_gaps: career.skills.filter(
          (skill) =>
            !toList(skills.length ? skills : aiProfile.skills, 32)
              .map((item) => item.toLowerCase())
              .includes(String(skill).toLowerCase())
        ).slice(0, 4),
        growth_path: [
          `Build practical depth in ${career.skills.slice(0, 2).join(' and ') || 'core capabilities'}.`,
          'Ship measurable outcomes and document impact across projects.',
          'Expand ownership from scoped tasks to cross-functional initiatives.',
        ],
      };
    })
    .sort((a, b) => b.match - a.match)
    .slice(0, 8);
};

const requestAiCareerCandidates = async ({
  aiProfile = {},
  traitVector = {},
  cognitiveVector = {},
  behaviorVector = {},
  skills = [],
  interests = [],
  catalog = [],
}) => {
  if (!config.openaiApiKey) {
    return [];
  }

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.2,
      max_output_tokens: 1600,
      input: [
        {
          role: 'system',
          content:
            'You are a career intelligence engine. Recommend careers grounded in provided profile. Return strict JSON array only.',
        },
        {
          role: 'user',
          content: `Analyze this profile.\n\nRecommend best careers.\n\nConsider:\n\nskills\ntraits\ncognitive style\ninterests\ndomain\nbehavior\n\nReturn:\n\n[\n  {\n    "career":"",\n    "match":0,\n    "confidence":0,\n    "reason":"",\n    "skill_gaps":[],\n    "growth_path":[]\n  }\n]\n\nReturn top 8.\n\nProfile:\n${buildUserProfileText({
            aiProfile,
            traitVector,
            cognitiveVector,
            behaviorVector,
            skills,
            interests,
          })}\n\nAvailable career titles:\n${catalog.map((item) => item.title).join(', ')}`,
        },
      ],
    });

    const parsed = parseJsonFromText(extractOutputText(response), 'Career intelligence output invalid');
    return normalizeAiCareers(parsed);
  } catch (error) {
    return [];
  }
};

const rankWithEmbeddings = async ({ userProfileText = '', candidates = [], catalog = [] }) => {
  const userEmbedding = await getEmbedding(userProfileText);

  const byTitle = new Map(catalog.map((item) => [item.title.toLowerCase(), item]));

  const rows = [];
  for (const candidate of candidates) {
    const catalogCareer = byTitle.get(String(candidate.career || '').toLowerCase()) || null;
    const careerText = catalogCareer?.description || `Career: ${candidate.career}\nReason: ${candidate.reason}`;
    const embedding = await getEmbedding(careerText);

    const embeddingSimilarity =
      userEmbedding.length && embedding.length
        ? cosineSimilarity(userEmbedding, embedding)
        : lexicalSimilarity(userProfileText, careerText);

    const finalScore = clamp(
      Math.round(Number(candidate.match || 0) * 0.62 + clamp(embeddingSimilarity, 0, 1) * 100 * 0.38),
      0,
      100
    );

    rows.push({
      ...candidate,
      match: finalScore,
      confidence: clamp(Math.round(Number(candidate.confidence || 0) * 0.55 + finalScore * 0.45), 0, 100),
      embedding_similarity: Number(clamp(embeddingSimilarity, 0, 1).toFixed(4)),
      career_id: catalogCareer?.careerId || String(candidate.career || '').toLowerCase().replace(/\s+/g, '_'),
      key_skills_to_build: catalogCareer?.skills || [],
      score: finalScore,
      role_match: finalScore,
      why_fit: candidate.reason,
    });
  }

  return rows.sort((a, b) => Number(b.match || 0) - Number(a.match || 0)).slice(0, 8);
};

const recommendCareersWithIntelligence = async ({
  aiProfile = {},
  traitVector = {},
  cognitiveVector = {},
  behaviorVector = {},
  skills = [],
  interests = [],
} = {}) => {
  const catalog = toCatalog();

  const profileText = buildUserProfileText({
    aiProfile,
    traitVector,
    cognitiveVector,
    behaviorVector,
    skills,
    interests,
  });

  const aiCandidates = await requestAiCareerCandidates({
    aiProfile,
    traitVector,
    cognitiveVector,
    behaviorVector,
    skills,
    interests,
    catalog,
  });

  const candidates = aiCandidates.length
    ? aiCandidates
    : heuristicCareerCandidates({
        catalog,
        aiProfile,
        traitVector,
        skills,
        interests,
      });

  const ranked = await rankWithEmbeddings({
    userProfileText: profileText,
    candidates,
    catalog,
  });

  return ranked;
};

module.exports = {
  recommendCareersWithIntelligence,
};
