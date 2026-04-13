const path = require('path');
const pdfParseModule = require('pdf-parse');
const mammoth = require('mammoth');
const { createHttpError } = require('../../utils/httpError');
const { config } = require('../../config/env');
const { extractOutputText, parseJsonFromText } = require('./aiJson');
const { getOpenAiClient } = require('./openaiClient');
const {
  SKILL_CATALOG,
  INTEREST_KEYWORDS,
  SUBJECT_KEYWORDS,
  TOOL_KEYWORDS,
  PROJECT_KEYWORDS,
  EDUCATION_KEYWORDS,
  EXPERIENCE_KEYWORDS,
  DOMAIN_KEYWORDS,
} = require('./cvTaxonomy');

const MAX_CV_TEXT_LENGTH = 12000;

const parsePdfBuffer = async (buffer) => {
  if (typeof pdfParseModule === 'function') {
    return pdfParseModule(buffer);
  }

  if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
    const parser = new pdfParseModule.PDFParse({ data: buffer });

    try {
      return await parser.getText();
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  }

  throw createHttpError(500, 'PDF parser is misconfigured');
};

const normalizeWhitespace = (value) =>
  String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const truncate = (value, limit = MAX_CV_TEXT_LENGTH) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
};

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc';

const toVector = (values = []) =>
  (Array.isArray(values) ? values : []).reduce((accumulator, value) => {
    const key = slugify(value);
    if (!key) {
      return accumulator;
    }

    accumulator[key] = Number(accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

const toSkillVector = (skills = []) =>
  (Array.isArray(skills) ? skills : []).reduce((accumulator, skill) => {
    if (!skill || typeof skill !== 'object') {
      return accumulator;
    }

    const skillKey = slugify(skill.name);
    const categoryKey = slugify(skill.category || 'general');

    if (skillKey) {
      accumulator[skillKey] = Number(accumulator[skillKey] || 0) + 1;
    }

    if (categoryKey) {
      accumulator[`category:${categoryKey}`] =
        Number(accumulator[`category:${categoryKey}`] || 0) + Number(skill.level || 1);
    }

    return accumulator;
  }, {});

const normalizeSkillEntry = (skill = {}) => {
  const name = String(skill.name || '').trim();
  if (!name) {
    return null;
  }

  const numericLevel = Number(skill.level);
  const level = Number.isFinite(numericLevel)
    ? Math.max(1, Math.min(5, Math.round(numericLevel)))
    : 3;

  const category = slugify(skill.category || 'general');

  return {
    name,
    level,
    category,
  };
};

const normalizeMarkEntry = (entry = {}) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const subject = String(entry.subject || entry.name || '').trim();
  if (!subject) {
    return null;
  }

  const scoreCandidate = Number(entry.score ?? entry.marks ?? entry.percentage);
  const score = Number.isFinite(scoreCandidate)
    ? Math.max(0, Math.min(100, Math.round(scoreCandidate)))
    : 0;

  return {
    subject,
    score,
  };
};

const normalizeCvPayload = (payload = {}) => {
  const name = String(payload.name || '').trim();

  const skills = Array.isArray(payload.skills)
    ? payload.skills.map(normalizeSkillEntry).filter(Boolean)
    : [];

  const education = (Array.isArray(payload.education) ? payload.education : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);

  const experience = (Array.isArray(payload.experience) ? payload.experience : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);

  const interests = (Array.isArray(payload.interests) ? payload.interests : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);

  const subjects = (Array.isArray(payload.subjects) ? payload.subjects : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 24);

  const projects = (Array.isArray(payload.projects) ? payload.projects : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);

  const tools = (Array.isArray(payload.tools) ? payload.tools : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 24);

  const marks = (Array.isArray(payload.marks) ? payload.marks : [])
    .map(normalizeMarkEntry)
    .filter(Boolean)
    .slice(0, 24);

  const careerSignals = (Array.isArray(payload.career_signals)
    ? payload.career_signals
    : Array.isArray(payload.careerSignals)
    ? payload.careerSignals
    : []
  )
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 16);

  const subjectVector =
    payload.subject_vector && typeof payload.subject_vector === 'object'
      ? payload.subject_vector
      : payload.subjectVector && typeof payload.subjectVector === 'object'
      ? payload.subjectVector
      : toVector(subjects);

  const skillVector =
    payload.skill_vector && typeof payload.skill_vector === 'object'
      ? payload.skill_vector
      : payload.skillVector && typeof payload.skillVector === 'object'
      ? payload.skillVector
      : toSkillVector(skills);

  const interestVector =
    payload.interest_vector && typeof payload.interest_vector === 'object'
      ? payload.interest_vector
      : payload.interestVector && typeof payload.interestVector === 'object'
      ? payload.interestVector
      : toVector(interests);

  return {
    name,
    skills,
    subjects,
    marks,
    projects,
    tools,
    education,
    experience,
    interests,
    career_signals: careerSignals,
    subject_vector: subjectVector,
    skill_vector: skillVector,
    interest_vector: interestVector,
  };
};

const inferName = (text) => {
  const firstLines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of firstLines) {
    if (/^([A-Z][a-z]+\s){1,3}[A-Z][a-z]+$/.test(line)) {
      return line;
    }
  }

  return firstLines[0] || 'Candidate';
};

const inferSkills = (text) => {
  const normalized = ` ${String(text || '').toLowerCase()} `;
  const matched = [];

  SKILL_CATALOG.forEach((skill) => {
    const hits = skill.aliases.reduce((count, alias) => {
      const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\b`, 'gi');
      const occurrences = normalized.match(pattern);
      return count + (occurrences ? occurrences.length : 0);
    }, 0);

    if (hits > 0) {
      matched.push({
        name: skill.name,
        level: Math.max(1, Math.min(5, Math.round(Math.log2(hits + 1) + 2))),
        category: skill.category,
        weight: hits,
      });
    }
  });

  return matched
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 24)
    .map(({ name, level, category }) => ({ name, level, category }));
};

const inferSectionLines = (text, keywords, max = 12) => {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });

  return filtered.slice(0, max);
};

const inferKeywordHits = (text, keywords = [], limit = 16) => {
  const lower = String(text || '').toLowerCase();

  return keywords
    .filter((keyword) => lower.includes(String(keyword).toLowerCase()))
    .slice(0, limit);
};

const inferProjects = (text) => {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const projectLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return PROJECT_KEYWORDS.some((keyword) => lower.includes(keyword));
  });

  return projectLines.slice(0, 12);
};

const inferMarks = (text) => {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 220);

  const marks = [];

  lines.forEach((line) => {
    const lower = line.toLowerCase();

    const gpaMatch = lower.match(/(?:cgpa|gpa)\s*[:\-]?\s*(\d(?:\.\d+)?)/i);
    if (gpaMatch) {
      const gpa = Number(gpaMatch[1]);
      if (Number.isFinite(gpa)) {
        marks.push({
          subject: 'GPA',
          score: Math.max(0, Math.min(100, Math.round((gpa / 10) * 100))),
        });
      }
    }

    const percentageMatch = lower.match(/([a-z\s]{2,40})\s*[:\-]?\s*(\d{2,3}(?:\.\d+)?)\s*%/i);
    if (percentageMatch) {
      const subject = String(percentageMatch[1] || 'Subject').trim();
      const score = Number(percentageMatch[2]);

      if (Number.isFinite(score)) {
        marks.push({
          subject: subject.length > 1 ? subject : 'Subject',
          score: Math.max(0, Math.min(100, Math.round(score))),
        });
      }
    }
  });

  const bySubject = new Map();

  marks.forEach((item) => {
    const key = slugify(item.subject);
    if (!key || bySubject.has(key)) {
      return;
    }

    bySubject.set(key, item);
  });

  return Array.from(bySubject.values()).slice(0, 16);
};

const inferInterests = (text) => inferKeywordHits(text, INTEREST_KEYWORDS, 12);

const inferSubjects = (text) => inferKeywordHits(text, SUBJECT_KEYWORDS, 20);

const inferTools = (text) => inferKeywordHits(text, TOOL_KEYWORDS, 20);

const inferCareerSignals = ({ skills = [], interests = [], experience = [], subjects = [] }) => {
  const skillCategories = skills.reduce((accumulator, skill) => {
    const key = skill.category || 'general';
    accumulator[key] = (accumulator[key] || 0) + (Number(skill.level) || 1);
    return accumulator;
  }, {});

  const sortedCategories = Object.entries(skillCategories)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  const signals = [];

  if (sortedCategories[0]) {
    signals.push(`Primary skill cluster: ${sortedCategories[0]}`);
  }

  if (sortedCategories[1]) {
    signals.push(`Secondary strength area: ${sortedCategories[1]}`);
  }

  if (subjects[0]) {
    signals.push(`Strong subject signal: ${subjects.slice(0, 2).join(', ')}`);
  }

  if (experience.length >= 6) {
    signals.push('Demonstrates broad project exposure across multiple responsibilities');
  } else if (experience.length <= 2) {
    signals.push('Early-stage profile with room for focused experience building');
  }

  if (interests.length > 0) {
    signals.push(`Interest alignment: ${interests.slice(0, 3).join(', ')}`);
  }

  return signals.slice(0, 8);
};

const inferDomain = (text) => {
  const lower = String(text || '').toLowerCase();

  const scores = Object.entries(DOMAIN_KEYWORDS).map(([domain, keywords]) => ({
    domain,
    score: keywords.reduce((count, keyword) => (lower.includes(keyword) ? count + 1 : count), 0),
  }));

  scores.sort((a, b) => b.score - a.score);

  return scores[0]?.score > 0 ? scores[0].domain : 'software';
};

const heuristicCvParser = (text) => {
  const skills = inferSkills(text);
  const education = inferSectionLines(text, EDUCATION_KEYWORDS, 10);
  const experience = inferSectionLines(text, EXPERIENCE_KEYWORDS, 16);
  const interests = inferInterests(text);
  const subjects = inferSubjects(text);
  const tools = inferTools(text);
  const projects = inferProjects(text);
  const marks = inferMarks(text);
  const careerSignals = inferCareerSignals({ skills, interests, experience, subjects });

  return {
    name: inferName(text),
    skills,
    subjects,
    marks,
    projects,
    tools,
    education,
    experience,
    interests,
    career_signals: [...careerSignals, `Likely domain focus: ${inferDomain(text)}`].slice(0, 10),
    subject_vector: toVector(subjects),
    skill_vector: toSkillVector(skills),
    interest_vector: toVector(interests),
  };
};

const parsePdf = async (buffer) => {
  const result = await parsePdfBuffer(buffer);
  return normalizeWhitespace(result?.text || '');
};

const parseDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result.value || '');
};

const detectFileType = ({ originalName = '', mimeType = '' }) => {
  const extension = path.extname(String(originalName || '')).toLowerCase();
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (extension === '.pdf' || normalizedMime.includes('pdf')) {
    return 'pdf';
  }

  if (
    extension === '.docx' ||
    normalizedMime.includes('wordprocessingml.document') ||
    normalizedMime.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    return 'docx';
  }

  if (extension === '.txt' || normalizedMime.includes('text/plain')) {
    return 'txt';
  }

  return 'unsupported';
};

const parseCvText = async ({ buffer, originalName, mimeType }) => {
  const fileType = detectFileType({ originalName, mimeType });

  if (fileType === 'pdf') {
    return parsePdf(buffer);
  }

  if (fileType === 'docx') {
    return parseDocx(buffer);
  }

  if (fileType === 'txt') {
    return normalizeWhitespace(buffer.toString('utf8'));
  }

  throw createHttpError(400, 'Unsupported CV format. Please upload PDF or DOCX.');
};

const parseCvWithAi = async (rawText, fallbackPayload) => {
  if (!config.openaiApiKey) {
    return fallbackPayload;
  }

  const inputText = truncate(rawText, MAX_CV_TEXT_LENGTH);

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    temperature: 0.15,
    max_output_tokens: 2000,
    input: [
      {
        role: 'system',
        content:
          'You are an ATS scanner and recruiter intelligence engine. Extract structured candidate intelligence from CV text. Return JSON only, without markdown.',
      },
      {
        role: 'user',
        content: `Extract and infer this schema exactly:\n{\n  "name": "",\n  "skills": [{ "name": "", "level": 1-5, "category": "frontend/backend/data/design/cloud/product/soft_skills" }],\n  "subjects": [""],\n  "marks": [{"subject":"", "score": 0-100}],\n  "projects": [""],\n  "tools": [""],\n  "education": [""],\n  "experience": [""],\n  "interests": [""],\n  "career_signals": [""],\n  "subject_vector": {"": 0},\n  "skill_vector": {"": 0},\n  "interest_vector": {"": 0}\n}\n\nRules:\n- Think like ATS + recruiter.\n- Include inferred subjects and measurable marks when mentioned.\n- Keep each list concise and specific.\n- Ensure skill level is integer 1-5.\n\nCV Text:\n${inputText}`,
      },
    ],
  });

  const parsed = parseJsonFromText(extractOutputText(response), 'AI CV parser output is invalid');
  const normalized = normalizeCvPayload(parsed);

  if (normalized.skills.length === 0 || normalized.name.length === 0) {
    return fallbackPayload;
  }

  return normalized;
};

const analyzeCv = async ({ buffer, originalName, mimeType }) => {
  const rawText = await parseCvText({ buffer, originalName, mimeType });

  if (!rawText || rawText.length < 30) {
    throw createHttpError(400, 'Uploaded CV could not be parsed into readable text');
  }

  const heuristic = normalizeCvPayload(heuristicCvParser(rawText));
  const aiEnhanced = normalizeCvPayload(await parseCvWithAi(rawText, heuristic));
  const source = config.openaiApiKey ? 'ai' : 'heuristic';
  const confidenceScore = source === 'ai' ? 0.86 : 0.62;
  const careerSignals = Array.isArray(aiEnhanced.career_signals) ? aiEnhanced.career_signals : [];

  return {
    rawText,
    parsed: {
      name: aiEnhanced.name,
      skills: aiEnhanced.skills,
      subjects: aiEnhanced.subjects,
      marks: aiEnhanced.marks,
      projects: aiEnhanced.projects,
      tools: aiEnhanced.tools,
      education: aiEnhanced.education,
      experience: aiEnhanced.experience,
      interests: aiEnhanced.interests,
      careerSignals,
      career_signals: careerSignals,
      subjectVector: aiEnhanced.subject_vector || toVector(aiEnhanced.subjects || []),
      skillVector: aiEnhanced.skill_vector || toSkillVector(aiEnhanced.skills || []),
      interestVector: aiEnhanced.interest_vector || toVector(aiEnhanced.interests || []),
      confidenceScore,
      source,
      schemaVersion: '1.0.0',
      source_domain: inferDomain(rawText),
    },
  };
};

module.exports = {
  analyzeCv,
  inferDomain,
  heuristicCvParser,
};
