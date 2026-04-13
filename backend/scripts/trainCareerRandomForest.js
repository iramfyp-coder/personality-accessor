/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const {
  trainCareerRandomForest,
  FEATURE_KEYS,
} = require('../services/assessment/ml-career-predictor.service');

const DATASET_FILE = process.argv[2] || path.resolve(__dirname, 'career-training-dataset.json');
const OUTPUT_FILE = process.argv[3] || path.resolve(__dirname, 'career-rf-model.json');

const run = () => {
  if (!fs.existsSync(DATASET_FILE)) {
    throw new Error(`Dataset file not found: ${DATASET_FILE}`);
  }

  const raw = fs.readFileSync(DATASET_FILE, 'utf8');
  const parsed = JSON.parse(raw);

  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const labels = Array.isArray(parsed?.labels) ? parsed.labels : [];

  const trained = trainCareerRandomForest({
    dataset: rows,
    labels,
  });

  if (!trained.enabled) {
    console.log(trained.message);
    console.log('Install optional dependency with: npm i ml-random-forest');
    process.exit(0);
  }

  const modelJson = trained.model.toJSON();
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        metadata: {
          featureKeys: FEATURE_KEYS,
          generatedAt: new Date().toISOString(),
        },
        model: modelJson,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Model exported to ${OUTPUT_FILE}`);
};

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
