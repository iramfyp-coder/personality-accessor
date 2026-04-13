const OpenAI = require('openai');
const { config } = require('../config/env');
const { createHttpError } = require('../utils/httpError');
const {
  buildPersonalityReportPrompt,
} = require('../prompts/personalityReport.prompt');
const { normalizeTraits, generateInsightSnapshot } = require('./insightService');
const {
  buildCareerContext,
  mergeCareerRecommendations,
} = require('./careerEngine');

let openaiClient;

const MAX_LIST_ITEMS = {
  strengths: 6,
  weaknesses: 5,
  growthSuggestions: 6,
  careerRecommendations: 5,
};

const toStringList = (value, max) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, max);

const toCareerRecommendations = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const career = String(item.career || '').trim();
      if (!career) {
        return null;
      }

      return {
        career,
        reason: String(item.reason || '').trim(),
        skillsNeeded: toStringList(item.skillsNeeded, 8),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS.careerRecommendations);
};

const ensureText = (value, fieldName) => {
  const text = String(value || '').trim();

  if (!text) {
    throw createHttpError(502, `AI response missing required field: ${fieldName}`);
  }

  return text;
};

const extractOutputText = (response) => {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks = [];

  if (!Array.isArray(response?.output)) {
    return '';
  }

  response.output.forEach((entry) => {
    if (!entry || !Array.isArray(entry.content)) {
      return;
    }

    entry.content.forEach((contentItem) => {
      if (!contentItem) {
        return;
      }

      if (typeof contentItem.text === 'string') {
        chunks.push(contentItem.text);
        return;
      }

      if (typeof contentItem?.text?.value === 'string') {
        chunks.push(contentItem.text.value);
        return;
      }

      if (typeof contentItem.value === 'string') {
        chunks.push(contentItem.value);
      }
    });
  });

  return chunks.join('\n').trim();
};

const parseJsonFromText = (text) => {
  const normalized = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!normalized) {
    throw createHttpError(502, 'AI returned an empty report payload');
  }

  try {
    return JSON.parse(normalized);
  } catch (initialError) {
    const startIndex = normalized.indexOf('{');
    const endIndex = normalized.lastIndexOf('}');

    if (startIndex < 0 || endIndex <= startIndex) {
      throw createHttpError(502, 'AI report format was not valid JSON');
    }

    const jsonSlice = normalized.slice(startIndex, endIndex + 1);

    try {
      return JSON.parse(jsonSlice);
    } catch (fallbackError) {
      throw createHttpError(502, 'AI report could not be parsed as JSON');
    }
  }
};

const normalizeReport = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw createHttpError(502, 'AI report payload was malformed');
  }

  return {
    summary: ensureText(payload.summary, 'summary'),
    strengths: toStringList(payload.strengths, MAX_LIST_ITEMS.strengths),
    weaknesses: toStringList(payload.weaknesses, MAX_LIST_ITEMS.weaknesses),
    communicationStyle: ensureText(payload.communicationStyle, 'communicationStyle'),
    workStyle: ensureText(payload.workStyle, 'workStyle'),
    growthSuggestions: toStringList(
      payload.growthSuggestions,
      MAX_LIST_ITEMS.growthSuggestions
    ),
    careerRecommendations: toCareerRecommendations(payload.careerRecommendations),
  };
};

const getOpenAiClient = () => {
  if (!config.openaiApiKey) {
    throw createHttpError(503, 'AI report is unavailable: OPENAI_API_KEY is not configured');
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }

  return openaiClient;
};

const generatePersonalityReport = async (traits = {}, facetScores = {}) => {
  const normalizedTraits = normalizeTraits(traits);
  const deterministicInsights = generateInsightSnapshot(normalizedTraits);
  const staticCareerMatches = buildCareerContext(normalizedTraits, 5);

  const { promptVersion, systemPrompt, userPrompt } = buildPersonalityReportPrompt({
    traits: normalizedTraits,
    facetScores,
    deterministicInsights,
    staticCareerMatches,
  });

  const response = await getOpenAiClient().responses.create({
    model: config.openaiModel,
    input: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.35,
    max_output_tokens: 1800,
  });

  const outputText = extractOutputText(response);
  const parsedPayload = parseJsonFromText(outputText);
  const normalizedReport = normalizeReport(parsedPayload);

  const mergedCareerRecommendations = mergeCareerRecommendations({
    aiRecommendations: normalizedReport.careerRecommendations,
    staticRecommendations: staticCareerMatches,
    limit: MAX_LIST_ITEMS.careerRecommendations,
  });

  return {
    ...normalizedReport,
    careerRecommendations: mergedCareerRecommendations,
    metadata: {
      model: response.model || config.openaiModel,
      promptVersion,
      usage: response.usage || null,
      generatedAt: new Date().toISOString(),
    },
    deterministicInsights,
    staticCareerMatches,
  };
};

module.exports = {
  generatePersonalityReport,
};
