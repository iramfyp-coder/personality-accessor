const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const sharp = require('sharp');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT_DIR, 'backend', '.env') });
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const OUTPUT_DIR = path.join(ROOT_DIR, 'frontend', 'public', 'assessment-images');
const TARGET_PER_CATEGORY = 5;
const MAX_WIDTH = 1600;
const TARGET_HEIGHT = 900;
const WEBP_QUALITY = 80;
const MIN_WIDTH = 1600;
const MIN_HEIGHT = 900;
const MAX_PAGES_PER_QUERY = 4;
const SEARCH_PER_PAGE = 30;

const CATEGORY_DEFINITIONS = {
  leadership: {
    label: 'Leadership',
    queries: [
      'corporate leadership meeting',
      'team leader presentation office',
      'executive discussion boardroom',
    ],
  },
  teamwork: {
    label: 'Teamwork',
    queries: [
      'cross functional team collaboration office',
      'team brainstorming session workplace',
      'colleagues working together conference room',
    ],
  },
  software: {
    label: 'Software Engineering',
    queries: [
      'software developer coding workstation multiple monitors',
      'programmer team pair programming office',
      'engineering team writing code modern workspace',
    ],
  },
  business: {
    label: 'Business Strategy',
    queries: [
      'business strategy planning meeting office',
      'executive team reviewing market analysis',
      'corporate strategy workshop conference room',
    ],
  },
  creativity: {
    label: 'Creativity',
    queries: [
      'creative team ideation workshop office',
      'design thinking session sticky notes meeting room',
      'product design brainstorming modern studio office',
    ],
  },
  analytics: {
    label: 'Analytics',
    queries: [
      'data analytics dashboard office workstation',
      'business intelligence charts team meeting',
      'data analyst reviewing metrics computer screens',
    ],
  },
  'decision-making': {
    label: 'Decision Making',
    queries: [
      'executive decision making meeting boardroom',
      'project prioritization planning session office',
      'leadership team evaluating options conference table',
    ],
  },
  students: {
    label: 'Students',
    queries: [
      'university students working on laptops classroom',
      'student team collaboration computer lab',
      'higher education project group modern campus workspace',
    ],
  },
  technology: {
    label: 'Technology',
    queries: [
      'technology team in modern digital workspace',
      'ai technology operations center office',
      'cloud infrastructure monitoring screens workspace',
    ],
  },
  'problem-solving': {
    label: 'Problem Solving',
    queries: [
      'team solving technical problem whiteboard office',
      'engineers troubleshooting system architecture meeting',
      'collaborative problem solving workshop workplace',
    ],
  },
  collaboration: {
    label: 'Collaboration',
    queries: [
      'professional collaboration session conference room',
      'hybrid team collaboration with laptops office',
      'cross department collaboration planning meeting',
    ],
  },
  management: {
    label: 'Management',
    queries: [
      'project management standup meeting office',
      'operations manager reviewing team progress dashboard',
      'management workshop in corporate office',
    ],
  },
  innovation: {
    label: 'Innovation',
    queries: [
      'innovation workshop startup team office',
      'product innovation lab collaborative team',
      'research and development team meeting technology office',
    ],
  },
  engineering: {
    label: 'Engineering',
    queries: [
      'engineering team technical review meeting',
      'engineers at workstation with hardware setup',
      'software engineering architecture session office',
    ],
  },
  'product-management': {
    label: 'Product Management',
    queries: [
      'product manager roadmap planning meeting',
      'product management workshop with agile board',
      'product team discussing user metrics dashboard',
    ],
  },
  'professional-workplace': {
    label: 'Professional Workplace',
    queries: [
      'professional workplace modern office',
      'corporate office workspace team activity',
      'saas company office collaboration environment',
    ],
  },
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
  'mascot',
  'logo',
  'clipart',
  'render',
  '3d character',
  'avatar',
];

const PROFESSIONAL_SIGNALS = [
  'office',
  'workspace',
  'meeting',
  'team',
  'laptop',
  'computer',
  'dashboard',
  'engineering',
  'developer',
  'business',
  'strategy',
  'manager',
  'startup',
  'conference',
  'project',
  'collaboration',
  'corporate',
  'workstation',
  'boardroom',
  'product',
  'classroom',
  'lab',
];

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureEmptyDir = (targetDir) => {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
};

const toPhotoText = (photo) => {
  const tags = Array.isArray(photo?.tags) ? photo.tags.map((tag) => tag?.title).filter(Boolean) : [];
  const topics = photo?.topic_submissions ? Object.keys(photo.topic_submissions) : [];

  return normalizeText(
    [
      photo?.description,
      photo?.alt_description,
      tags.join(' '),
      topics.join(' '),
      photo?.user?.name,
      photo?.user?.location,
      photo?.user?.bio,
    ]
      .filter(Boolean)
      .join(' ')
  );
};

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const isPhotoAllowed = (photo) => {
  const width = Number(photo?.width || 0);
  const height = Number(photo?.height || 0);

  if (width < MIN_WIDTH || height < MIN_HEIGHT || width < height) {
    return false;
  }

  const text = toPhotoText(photo);

  if (!text) {
    return false;
  }

  if (includesAny(text, REJECT_TERMS)) {
    return false;
  }

  if (!includesAny(text, PROFESSIONAL_SIGNALS)) {
    return false;
  }

  return true;
};

const searchUnsplash = async ({ query, page }) => {
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(SEARCH_PER_PAGE),
    orientation: 'landscape',
  });

  const response = await fetch(`https://unsplash.com/napi/search/photos?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      Referer: 'https://unsplash.com/',
      'User-Agent': 'personality-assessor-image-pipeline/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Unsplash search failed (${response.status}) for query: ${query}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.results) ? payload.results : [];
};

const buildDownloadUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  url.searchParams.set('w', '2200');
  url.searchParams.set('fit', 'max');
  url.searchParams.set('q', '82');
  url.searchParams.set('fm', 'jpg');
  return url.toString();
};

const downloadAndConvertToWebp = async ({ photo, destinationFile }) => {
  const rawUrl = photo?.urls?.raw || photo?.urls?.full || photo?.urls?.regular;
  if (!rawUrl) {
    throw new Error('Missing image URL');
  }

  const response = await fetch(buildDownloadUrl(rawUrl), {
    headers: {
      Referer: 'https://unsplash.com/',
      'User-Agent': 'personality-assessor-image-pipeline/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Image download failed (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const inputMetadata = await sharp(inputBuffer).metadata();
  if (
    Number(inputMetadata?.width || 0) < MIN_WIDTH ||
    Number(inputMetadata?.height || 0) < MIN_HEIGHT ||
    Number(inputMetadata?.width || 0) < Number(inputMetadata?.height || 0)
  ) {
    throw new Error('Downloaded image did not meet landscape HD requirements');
  }

  await sharp(inputBuffer)
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: TARGET_HEIGHT,
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: false,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(destinationFile);

  const outputMetadata = await sharp(destinationFile).metadata();

  return {
    width: Number(outputMetadata?.width || 0),
    height: Number(outputMetadata?.height || 0),
    bytes: fs.statSync(destinationFile).size,
    format: outputMetadata?.format || 'webp',
  };
};

const main = async () => {
  const usedPhotoIds = new Set();
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'unsplash',
    format: 'webp',
    maxWidth: MAX_WIDTH,
    quality: WEBP_QUALITY,
    minimumResolution: `${MIN_WIDTH}x${MIN_HEIGHT}`,
    total: 0,
    categories: {},
    images: {},
  };

  ensureEmptyDir(OUTPUT_DIR);

  for (const [categorySlug, definition] of Object.entries(CATEGORY_DEFINITIONS)) {
    const categoryDir = path.join(OUTPUT_DIR, categorySlug);
    fs.mkdirSync(categoryDir, { recursive: true });

    const selected = [];

    for (const query of definition.queries) {
      if (selected.length >= TARGET_PER_CATEGORY) {
        break;
      }

      for (let page = 1; page <= MAX_PAGES_PER_QUERY; page += 1) {
        if (selected.length >= TARGET_PER_CATEGORY) {
          break;
        }

        const photos = await searchUnsplash({ query, page });
        if (!photos.length) {
          break;
        }

        for (const photo of photos) {
          if (selected.length >= TARGET_PER_CATEGORY) {
            break;
          }

          if (!photo?.id || usedPhotoIds.has(photo.id)) {
            continue;
          }

          if (!isPhotoAllowed(photo)) {
            continue;
          }

          const index = String(selected.length + 1).padStart(2, '0');
          const filename = `${categorySlug}-${index}.webp`;
          const relativePath = `${categorySlug}/${filename}`;
          const destinationFile = path.join(categoryDir, filename);

          try {
            const media = await downloadAndConvertToWebp({
              photo,
              destinationFile,
            });

            usedPhotoIds.add(photo.id);

            const imageEntry = {
              id: photo.id,
              filename,
              category: categorySlug,
              categoryLabel: definition.label,
              query,
              local_path: `/assessment-images/${relativePath}`,
              unsplash_page: photo?.links?.html || '',
              photographer: photo?.user?.name || '',
              photographer_profile: photo?.user?.links?.html || '',
              description: photo?.description || photo?.alt_description || '',
              width: media.width,
              height: media.height,
              bytes: media.bytes,
              format: media.format,
              source: 'unsplash',
              strictFilterPassed: true,
            };

            manifest.images[relativePath] = imageEntry;
            selected.push(relativePath);

            console.log(`saved ${relativePath}`);
          } catch (error) {
            if (fs.existsSync(destinationFile)) {
              fs.rmSync(destinationFile, { force: true });
            }
          }
        }

        await sleep(180);
      }
    }

    manifest.categories[categorySlug] = {
      label: definition.label,
      queries: definition.queries,
      count: selected.length,
      files: selected,
    };

    if (selected.length < TARGET_PER_CATEGORY) {
      throw new Error(
        `Category ${categorySlug} has ${selected.length}/${TARGET_PER_CATEGORY} images. Add more strict queries.`
      );
    }
  }

  manifest.total = Object.keys(manifest.images).length;

  if (manifest.total < 50) {
    throw new Error(`Expected at least 50 images, got ${manifest.total}`);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Done. Downloaded ${manifest.total} curated Unsplash images.`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
