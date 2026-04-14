const MANIFEST_PATH = '/assessment-images/manifest.json';
const FALLBACK_CATEGORY = 'professional-workplace';

const CATEGORY_RULES = {
  leadership: ['leadership', 'leader', 'executive', 'ownership', 'influence'],
  teamwork: ['teamwork', 'team', 'group', 'peer', 'social', 'cooperation'],
  software: ['software', 'developer', 'programmer', 'coding', 'code', 'application'],
  business: ['business', 'strategy', 'market', 'operations', 'commercial'],
  creativity: ['creativity', 'creative', 'design', 'ideation', 'imagination'],
  analytics: ['analytics', 'analysis', 'data', 'metrics', 'insight'],
  'decision-making': ['decision', 'prioritization', 'judgment', 'tradeoff', 'risk'],
  students: ['student', 'students', 'education', 'learning', 'campus'],
  technology: ['technology', 'digital', 'ai', 'cloud', 'systems'],
  'problem-solving': ['problem', 'troubleshoot', 'solve', 'resolution', 'debug'],
  collaboration: ['collaboration', 'collaborative', 'cross-functional', 'stakeholder'],
  management: ['management', 'manager', 'planning', 'coordination'],
  innovation: ['innovation', 'prototype', 'experimentation', 'new idea'],
  engineering: ['engineering', 'engineer', 'architecture', 'technical'],
  'product-management': ['product', 'roadmap', 'backlog', 'priorities', 'user story'],
  'professional-workplace': ['professional workplace', 'office', 'workplace'],
};

const DIRECT_CATEGORY_MAP = {
  leadership: 'leadership',
  teamwork: 'teamwork',
  'software engineering': 'software',
  software: 'software',
  'business strategy': 'business',
  business: 'business',
  creativity: 'creativity',
  analytics: 'analytics',
  'decision making': 'decision-making',
  decision: 'decision-making',
  students: 'students',
  technology: 'technology',
  'problem solving': 'problem-solving',
  collaboration: 'collaboration',
  management: 'management',
  innovation: 'innovation',
  engineering: 'engineering',
  'product management': 'product-management',
  'professional workplace': 'professional-workplace',
};

const REJECT_TERMS = [
  'animal',
  'animals',
  'dog',
  'cat',
  'puppy',
  'kitten',
  'bird',
  'wildlife',
  'pet',
  'horse',
  'cartoon',
  'illustration',
  'icon',
  'vector',
  'drawing',
  'painting',
  'anime',
  'meme',
  'logo',
  'clipart',
  'avatar',
];

let manifestPromise = null;

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hashString = (value = '') => {
  const text = String(value || '');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const toKeywordArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
};

const collectQuestionSignals = (question = {}) => {
  const rawKeywords = [
    ...toKeywordArray(question?.keywords),
    ...toKeywordArray(question?.tags),
    ...toKeywordArray(question?.metadata?.keywords),
  ];

  const textSignals = [
    question?.category,
    question?.trait,
    question?.traitTarget,
    question?.plannerCategory,
    question?.intent,
    question?.text,
    question?.stage,
    question?.theme,
    question?.subCategory,
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return Array.from(new Set([...rawKeywords, ...textSignals]));
};

const includesRejectTerms = (text) => REJECT_TERMS.some((term) => text.includes(term));

const isStrictPhotoEntry = (entry = {}) => {
  const text = normalizeText(
    [
      entry?.description,
      entry?.categoryLabel,
      entry?.query,
      entry?.filename,
      entry?.local_path,
      entry?.photographer,
    ]
      .filter(Boolean)
      .join(' ')
  );

  return !includesRejectTerms(text);
};

const loadManifest = async () => {
  if (manifestPromise) {
    return manifestPromise;
  }

  manifestPromise = fetch(MANIFEST_PATH)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load image manifest (${response.status})`);
      }

      const payload = await response.json();
      return payload && typeof payload === 'object' ? payload : {};
    })
    .catch(() => ({ categories: {}, images: {} }));

  return manifestPromise;
};

const mapDirectCategory = (question = {}) => {
  const candidates = [
    question?.category,
    question?.trait,
    question?.traitTarget,
    question?.plannerCategory,
    question?.theme,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (DIRECT_CATEGORY_MAP[candidate]) {
      return DIRECT_CATEGORY_MAP[candidate];
    }
  }

  return '';
};

const inferCategory = (question = {}) => {
  const direct = mapDirectCategory(question);
  if (direct) {
    return { category: direct, matched: [direct] };
  }

  const signals = collectQuestionSignals(question).join(' ');
  let bestCategory = '';
  let bestScore = 0;
  let bestMatchedTerms = [];

  for (const [category, terms] of Object.entries(CATEGORY_RULES)) {
    const matchedTerms = terms.filter((term) => signals.includes(normalizeText(term)));
    const score = matchedTerms.length;

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
      bestMatchedTerms = matchedTerms;
    }
  }

  if (!bestCategory) {
    return { category: FALLBACK_CATEGORY, matched: ['professional workplace'] };
  }

  return { category: bestCategory, matched: bestMatchedTerms.length ? bestMatchedTerms : [bestCategory] };
};

const getEntriesForCategory = ({ category, manifest }) => {
  const files = manifest?.categories?.[category]?.files;
  if (!Array.isArray(files) || !files.length) {
    return [];
  }

  return files
    .map((relativePath) => ({
      relativePath,
      entry: manifest?.images?.[relativePath],
    }))
    .filter(({ entry }) => entry && isStrictPhotoEntry(entry));
};

const pickDeterministic = ({ entries, question }) => {
  if (!entries.length) {
    return null;
  }

  const seed = hashString(
    [question?.questionId, question?.id, question?.text, question?.category, question?.trait].join('|')
  );

  return entries[seed % entries.length];
};

export const selectImage = async (question = {}) => {
  const manifest = await loadManifest();
  const inference = inferCategory(question);

  let selectedCategory = inference.category;
  let entries = getEntriesForCategory({ category: selectedCategory, manifest });

  if (!entries.length) {
    selectedCategory = FALLBACK_CATEGORY;
    entries = getEntriesForCategory({ category: selectedCategory, manifest });
  }

  if (!entries.length) {
    const firstCategoryWithImages = Object.keys(manifest?.categories || {}).find((category) =>
      getEntriesForCategory({ category, manifest }).length
    );

    selectedCategory = firstCategoryWithImages || FALLBACK_CATEGORY;
    entries = getEntriesForCategory({ category: selectedCategory, manifest });
  }

  const selected = pickDeterministic({ entries, question });

  if (!selected) {
    return {
      url: '/assessment-images/professional-workplace/professional-workplace-01.webp',
      source: 'fallback',
      category: FALLBACK_CATEGORY,
      keywords: ['professional workplace'],
      strictFilterPassed: false,
    };
  }

  return {
    url: `/assessment-images/${selected.relativePath}`,
    source: 'local-curated',
    category: selectedCategory,
    keywords: inference.matched,
    strictFilterPassed: true,
  };
};

export const QuestionImageEngine = {
  selectImage,
};

export default QuestionImageEngine;
