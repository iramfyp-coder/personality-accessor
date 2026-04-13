const PROMPT_VERSION = '1.0.0';

const BIG_FIVE_GUIDE = {
  O: 'Openness: curiosity, imagination, tolerance for novelty, and preference for abstract thinking.',
  C: 'Conscientiousness: planning, reliability, follow-through, impulse control, and quality orientation.',
  E: 'Extraversion: social energy, assertiveness, expressiveness, and stimulation-seeking.',
  A: 'Agreeableness: empathy, cooperation, trust, and conflict style.',
  N: 'Neuroticism: emotional reactivity, stress sensitivity, and vulnerability to negative affect.',
};

const OUTPUT_SCHEMA = {
  summary: 'string',
  strengths: ['string'],
  weaknesses: ['string'],
  communicationStyle: 'string',
  workStyle: 'string',
  growthSuggestions: ['string'],
  careerRecommendations: [
    {
      career: 'string',
      reason: 'string',
      skillsNeeded: ['string'],
    },
  ],
};

const stringifyJson = (value) => JSON.stringify(value, null, 2);

const buildPersonalityReportPrompt = ({
  traits,
  facetScores,
  deterministicInsights,
  staticCareerMatches,
}) => {
  const systemPrompt = [
    'You are a professional psychologist and career advisor.',
    'Given Big Five (OCEAN) scores, produce deep and practical personality analysis.',
    'The writing must be specific, human-sounding, and evidence-based from the provided scores.',
    'Avoid generic advice and avoid repeating obvious labels.',
    'Return ONLY valid JSON that matches the required schema.',
  ].join(' ');

  const userPrompt = [
    'Interpretation guide for Big Five traits:',
    stringifyJson(BIG_FIVE_GUIDE),
    '',
    'Trait scores (0-100):',
    stringifyJson(traits),
    '',
    'Facet scores (0-100):',
    stringifyJson(facetScores || {}),
    '',
    'Deterministic insights from rule engine (use as context, do not copy verbatim):',
    stringifyJson(deterministicInsights),
    '',
    'Static career matches from mapping engine (use as context, then refine with reasoning):',
    stringifyJson(staticCareerMatches),
    '',
    'Output schema:',
    stringifyJson(OUTPUT_SCHEMA),
    '',
    'Constraints:',
    '- All list items must be concrete and actionable.',
    '- Summary should be 5-7 sentences and reference score interplay.',
    '- Include 4-6 strengths and 3-5 weaknesses.',
    '- Include 4-6 growthSuggestions focused on behaviors and habits.',
    '- Include 3-5 careerRecommendations with career, reason, and skillsNeeded.',
    '- Do not use markdown, code fences, or any text outside JSON.',
  ].join('\n');

  return {
    promptVersion: PROMPT_VERSION,
    systemPrompt,
    userPrompt,
  };
};

module.exports = {
  PROMPT_VERSION,
  buildPersonalityReportPrompt,
};
