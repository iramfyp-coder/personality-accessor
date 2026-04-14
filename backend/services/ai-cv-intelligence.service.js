const { config } = require('../config/env');
const { extractOutputText, parseJsonFromText } = require('./assessment/aiJson');
const { getOpenAiClient } = require('./assessment/openaiClient');

const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior'];
const BEHAVIOR_KEYS = ['leadership', 'analysis', 'creativity', 'risk', 'collaboration', 'execution'];

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

const normalizeBehaviorSignals = (value = {}) =>
  BEHAVIOR_KEYS.reduce((accumulator, key) => {
    const numeric = Number(value?.[key]);
    accumulator[key] = Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : 50;
    return accumulator;
  }, {});

const normalizeExperienceLevel = (value) => {
  const normalized = toText(value).toLowerCase();
  if (EXPERIENCE_LEVELS.includes(normalized)) {
    return normalized;
  }
  return 'entry';
};

const inferExperienceLevel = (experience = []) => {
  const lines = Array.isArray(experience) ? experience : [];
  const detectedYears = lines.reduce((max, line) => {
    const match = String(line || '').match(/(\d+)\+?\s*(?:years|yrs|year)/i);
    if (!match) {
      return max;
    }
    return Math.max(max, Number(match[1] || 0));
  }, 0);

  if (detectedYears >= 8) return 'senior';
  if (detectedYears >= 3) return 'mid';
  return 'entry';
};

const inferFallbackDomain = (cvData = {}) => {
  const explicit = toText(cvData.source_domain || cvData.domain || cvData.sourceDomain);
  if (explicit) {
    return explicit.toLowerCase();
  }

  const categories = (Array.isArray(cvData.skills) ? cvData.skills : []).reduce((acc, skill) => {
    const category = toText(skill?.category || '').toLowerCase();
    if (!category) {
      return acc;
    }
    acc[category] = Number(acc[category] || 0) + Number(skill?.level || 1);
    return acc;
  }, {});

  const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  if (!top) {
    return 'general';
  }

  if (top.includes('frontend') || top.includes('backend') || top.includes('cloud') || top.includes('devops')) {
    return 'technology';
  }

  return top;
};

const DEFAULT_AI_PROFILE = Object.freeze({
  domain: 'general',
  subdomains: [],
  skills: [],
  subjects: [],
  tools: [],
  interests: [],
  behavior_signals: {
    leadership: 50,
    analysis: 50,
    creativity: 50,
    risk: 50,
    collaboration: 50,
    execution: 50,
  },
  work_style: [],
  career_signals: [],
  experience_level: 'entry',
  confidence: 0.5,
});

const normalizeAiProfile = (payload = {}) => {
  const domain = toText(payload.domain || DEFAULT_AI_PROFILE.domain).toLowerCase() || 'general';

  return {
    domain,
    subdomains: toList(payload.subdomains, 16),
    skills: toList(payload.skills, 48),
    subjects: toList(payload.subjects, 32),
    tools: toList(payload.tools, 32),
    interests: toList(payload.interests, 24),
    behavior_signals: normalizeBehaviorSignals(payload.behavior_signals),
    work_style: toList(payload.work_style, 16),
    career_signals: toList(payload.career_signals, 20),
    experience_level: normalizeExperienceLevel(payload.experience_level),
    confidence: clamp(Number(payload.confidence || 0.5), 0, 1),
  };
};

const buildFallbackProfile = ({ cvData = {} } = {}) => {
  const skills = toList((cvData.skills || []).map((skill) => skill?.name || skill), 48);
  const subjects = toList(cvData.subjects, 32);
  const tools = toList(cvData.tools, 32);
  const interests = toList(cvData.interests, 24);
  const projects = toList(cvData.projects, 16);
  const careerSignals = toList(cvData.careerSignals || cvData.career_signals, 20);

  const technicalSignal = skills.filter((item) =>
    /(api|node|react|python|ml|cloud|docker|sql|engineering|system|algorithm|data)/i.test(item)
  ).length;
  const collaborationSignal = skills.filter((item) => /(team|communication|stakeholder|lead)/i.test(item)).length;
  const creativitySignal = skills.filter((item) => /(design|creative|prototype|innovation|ux)/i.test(item)).length;

  return normalizeAiProfile({
    domain: inferFallbackDomain(cvData),
    subdomains: [
      ...subjects.slice(0, 2),
      ...projects.slice(0, 2),
    ],
    skills,
    subjects,
    tools,
    interests,
    behavior_signals: {
      leadership: clamp(40 + collaborationSignal * 8, 0, 100),
      analysis: clamp(45 + technicalSignal * 7, 0, 100),
      creativity: clamp(40 + creativitySignal * 9, 0, 100),
      risk: 52,
      collaboration: clamp(42 + collaborationSignal * 10, 0, 100),
      execution: clamp(45 + Math.min(skills.length, 10) * 4, 0, 100),
    },
    work_style: ['structured', 'goal-oriented'],
    career_signals: careerSignals,
    experience_level: inferExperienceLevel(cvData.experience || []),
    confidence: clamp(Number(cvData.confidenceScore || 0.62), 0, 1),
  });
};

const toCvSummary = ({ cvData = {}, cvRawText = '' }) => {
  const skills = toList((cvData.skills || []).map((skill) => skill?.name || skill), 20).join(', ') || 'n/a';
  const subjects = toList(cvData.subjects, 16).join(', ') || 'n/a';
  const tools = toList(cvData.tools, 16).join(', ') || 'n/a';
  const interests = toList(cvData.interests, 16).join(', ') || 'n/a';
  const education = toList(cvData.education, 12).join(' | ') || 'n/a';
  const experience = toList(cvData.experience, 12).join(' | ') || 'n/a';
  const projects = toList(cvData.projects, 12).join(' | ') || 'n/a';
  const raw = toText(cvRawText).slice(0, 10000);

  return `CV Structured Data:\n- Domain hint: ${toText(cvData.source_domain || cvData.domain || 'n/a')}\n- Skills: ${skills}\n- Subjects: ${subjects}\n- Tools: ${tools}\n- Interests: ${interests}\n- Education: ${education}\n- Experience: ${experience}\n- Projects: ${projects}\n\nCV Raw Text:\n${raw || 'n/a'}`;
};

const extractAiCvIntelligence = async ({ cvData = {}, cvRawText = '', existingProfile } = {}) => {
  if (existingProfile && typeof existingProfile === 'object' && Object.keys(existingProfile).length > 0) {
    return normalizeAiProfile(existingProfile);
  }

  const fallback = buildFallbackProfile({ cvData });

  if (!config.openaiApiKey) {
    return fallback;
  }

  try {
    const response = await getOpenAiClient().responses.create({
      model: config.openaiModel,
      temperature: 0.15,
      max_output_tokens: 1200,
      input: [
        {
          role: 'system',
          content:
            'Analyze CV content and return psychometric intelligence as strict JSON only. No markdown, no commentary.',
        },
        {
          role: 'user',
          content: `Analyze this CV deeply.\n\nExtract:\n\ndomain\nsubdomains\nskills\nsubjects\ntools\ninterests\nbehavior signals\nwork style signals\ncareer signals\nexperience level\n\nReturn JSON only using this schema:\n{\n  "domain": "",\n  "subdomains": [""],\n  "skills": [""],\n  "subjects": [""],\n  "tools": [""],\n  "interests": [""],\n  "behavior_signals": {\n    "leadership": 0,\n    "analysis": 0,\n    "creativity": 0,\n    "risk": 0,\n    "collaboration": 0,\n    "execution": 0\n  },\n  "work_style": [""],\n  "career_signals": [""],\n  "experience_level": "entry|mid|senior",\n  "confidence": 0\n}\n\n${toCvSummary({ cvData, cvRawText })}`,
        },
      ],
    });

    const parsed = parseJsonFromText(extractOutputText(response), 'AI CV intelligence output invalid');
    return normalizeAiProfile(parsed);
  } catch (error) {
    return fallback;
  }
};

module.exports = {
  DEFAULT_AI_PROFILE,
  normalizeAiProfile,
  extractAiCvIntelligence,
};
