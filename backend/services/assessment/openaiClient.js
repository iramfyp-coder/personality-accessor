const OpenAI = require('openai');
const { config } = require('../../config/env');
const { createHttpError } = require('../../utils/httpError');

let client;

const getOpenAiClient = () => {
  if (!config.openaiApiKey) {
    throw createHttpError(503, 'OPENAI_API_KEY is not configured');
  }

  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  return client;
};

module.exports = {
  getOpenAiClient,
};
