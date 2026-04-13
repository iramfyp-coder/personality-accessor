let RandomForestClassifier = null;

try {
  // Optional dependency. Install with: npm i ml-random-forest
  // This layer is intentionally optional for environments without ML packages.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  RandomForestClassifier = require('ml-random-forest').RandomForestClassifier;
} catch (error) {
  RandomForestClassifier = null;
}

const FEATURE_KEYS = [
  'O',
  'C',
  'E',
  'A',
  'N',
  'skills_score',
  'subjects_score',
  'aptitude_score',
];

const toFeatureRow = (item = {}) =>
  FEATURE_KEYS.map((key) => {
    const value = Number(item[key] || 0);
    return Number.isFinite(value) ? value : 0;
  });

const heuristicPredictCategory = (features = {}) => {
  const o = Number(features.O || 50);
  const c = Number(features.C || 50);
  const e = Number(features.E || 50);
  const skills = Number(features.skills_score || 50);
  const aptitude = Number(features.aptitude_score || 50);

  if (aptitude >= 70 && skills >= 70 && o >= 62) {
    return 'engineering_data';
  }

  if (e >= 65 && c >= 60) {
    return 'leadership_business';
  }

  if (o >= 72 && e >= 56) {
    return 'creative_product';
  }

  return 'generalist_technology';
};

const trainCareerRandomForest = ({ dataset = [], labels = [], options = {} }) => {
  if (!RandomForestClassifier) {
    return {
      model: null,
      enabled: false,
      message: 'ml-random-forest dependency is not installed.',
    };
  }

  const featureRows = (Array.isArray(dataset) ? dataset : []).map(toFeatureRow);
  const outputLabels = Array.isArray(labels) ? labels : [];

  if (!featureRows.length || featureRows.length !== outputLabels.length) {
    throw new Error('Dataset and labels must be non-empty and have matching lengths.');
  }

  const classifier = new RandomForestClassifier({
    nEstimators: options.nEstimators || 60,
    maxFeatures: options.maxFeatures || 0.8,
    replacement: true,
    seed: options.seed || 42,
  });

  classifier.train(featureRows, outputLabels);

  return {
    model: classifier,
    enabled: true,
    message: 'Random Forest model trained successfully.',
  };
};

const predictCareerCategory = ({ features = {}, model = null }) => {
  if (!model || typeof model.predict !== 'function') {
    return {
      category: heuristicPredictCategory(features),
      source: 'heuristic',
    };
  }

  const prediction = model.predict([toFeatureRow(features)]);
  return {
    category: Array.isArray(prediction) && prediction[0] ? prediction[0] : heuristicPredictCategory(features),
    source: 'random_forest',
  };
};

module.exports = {
  FEATURE_KEYS,
  trainCareerRandomForest,
  predictCareerCategory,
};
