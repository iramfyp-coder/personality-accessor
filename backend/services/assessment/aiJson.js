const { createHttpError } = require('../../utils/httpError');

const extractOutputText = (response) => {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) {
    return '';
  }

  const chunks = [];

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

const parseJsonFromText = (text, errorMessage = 'AI response could not be parsed') => {
  const normalized = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!normalized) {
    throw createHttpError(502, `${errorMessage}: empty response`);
  }

  try {
    return JSON.parse(normalized);
  } catch (initialError) {
    const startIndex = normalized.indexOf('{');
    const endIndex = normalized.lastIndexOf('}');

    if (startIndex < 0 || endIndex <= startIndex) {
      const arrayStart = normalized.indexOf('[');
      const arrayEnd = normalized.lastIndexOf(']');

      if (arrayStart < 0 || arrayEnd <= arrayStart) {
        throw createHttpError(502, `${errorMessage}: not valid JSON`);
      }

      const arraySlice = normalized.slice(arrayStart, arrayEnd + 1);
      try {
        return JSON.parse(arraySlice);
      } catch (arrayError) {
        throw createHttpError(502, `${errorMessage}: invalid JSON array payload`);
      }
    }

    const objectSlice = normalized.slice(startIndex, endIndex + 1);

    try {
      return JSON.parse(objectSlice);
    } catch (objectError) {
      throw createHttpError(502, `${errorMessage}: invalid JSON object payload`);
    }
  }
};

module.exports = {
  extractOutputText,
  parseJsonFromText,
};
