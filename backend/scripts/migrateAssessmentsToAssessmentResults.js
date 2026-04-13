const mongoose = require('mongoose');
const { config, validateRequiredEnv } = require('../config/env');
const Assessment = require('../models/Assessment');
const AssessmentResult = require('../models/AssessmentResult');
const { normalizeCareerRecommendations } = require('../services/assessmentResultView.service');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toTraits = (traitScores = {}) => ({
  O: Number(traitScores.O || 0),
  C: Number(traitScores.C || 0),
  E: Number(traitScores.E || 0),
  A: Number(traitScores.A || 0),
  N: Number(traitScores.N || 0),
});

const dominantTrait = (traits = {}) =>
  ['O', 'C', 'E', 'A', 'N'].reduce(
    (best, key) => (Number(traits[key] || 0) > Number(traits[best] || 0) ? key : best),
    'O'
  );

const mapLegacyAnswers = (answers = []) =>
  (Array.isArray(answers) ? answers : []).map((answer) => ({
    questionId: String(answer.questionId),
    type: 'mcq',
    value: clamp(Number(answer.value || 3), 1, 5),
    metadata: {
      trait: '',
      difficulty: '',
    },
    answeredAt: new Date(),
  }));

const mapLegacyAiToPersonalityArchetypes = (aiReport, traits) => ({
  personalityType: 'Legacy Big Five',
  dominantTrait: dominantTrait(traits),
  hybridTraitScores: {},
  dominantStrengths: Array.isArray(aiReport?.strengths) ? aiReport.strengths : [],
  weaknesses: Array.isArray(aiReport?.weaknesses) ? aiReport.weaknesses : [],
  behavioralSummary: String(aiReport?.summary || ''),
});

const mapLegacyAiToCareer = (aiReport) =>
  normalizeCareerRecommendations(aiReport?.careerRecommendations || []);

const mapLegacyAiReportCache = (aiReport) => {
  if (!aiReport) {
    return undefined;
  }

  return {
    summary: String(aiReport.summary || ''),
    strengths: Array.isArray(aiReport.strengths) ? aiReport.strengths : [],
    weaknesses: Array.isArray(aiReport.weaknesses) ? aiReport.weaknesses : [],
    communicationStyle: String(aiReport.communicationStyle || ''),
    workStyle: String(aiReport.workStyle || ''),
    growthSuggestions: Array.isArray(aiReport.growthSuggestions)
      ? aiReport.growthSuggestions
      : [],
    careerRecommendations: normalizeCareerRecommendations(aiReport.careerRecommendations || []),
    model: String(aiReport.model || ''),
    promptVersion: String(aiReport.promptVersion || ''),
    generatedAt: aiReport.generatedAt ? new Date(aiReport.generatedAt) : null,
  };
};

const migrate = async () => {
  validateRequiredEnv();

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log('Connected to MongoDB');

  const assessments = await Assessment.find({})
    .sort({ createdAt: 1 })
    .select('_id userId answers traitScores aiReport createdAt updatedAt')
    .lean();

  console.log(`Found ${assessments.length} legacy assessments to migrate`);

  let migrated = 0;

  for (const legacy of assessments) {
    const traits = toTraits(legacy.traitScores || {});
    const careerRecommendations = mapLegacyAiToCareer(legacy.aiReport);

    await AssessmentResult.findOneAndUpdate(
      { legacyAssessmentId: legacy._id },
      {
        $set: {
          userId: legacy.userId,
          sessionId: legacy._id,
          legacyAssessmentId: legacy._id,
          cvData: {
            name: '',
            skills: [],
            education: [],
            experience: [],
            interests: [],
            careerSignals: [],
            confidenceScore: 0.5,
            source: 'heuristic',
            schemaVersion: '1.0.0',
          },
          answers: mapLegacyAnswers(legacy.answers),
          behavior: {
            analysis: {},
            signals: {},
          },
          personality: {
            traits,
            archetypes: mapLegacyAiToPersonalityArchetypes(legacy.aiReport, traits),
            consistencyScore: 0.65,
          },
          career: {
            recommendations: careerRecommendations,
            roadmap: [],
            fitScores: careerRecommendations.reduce((accumulator, item) => {
              accumulator[item.career] = 0;
              return accumulator;
            }, {}),
          },
          analytics: {
            trendVector: {
              ...traits,
              average: Number(
                ((traits.O + traits.C + traits.E + traits.A + traits.N) / 5).toFixed(2)
              ),
            },
            confidence: 0.7,
            aiReport: mapLegacyAiReportCache(legacy.aiReport),
          },
          schemaVersion: '2.0.0',
          completedAt: legacy.updatedAt || legacy.createdAt,
          createdAt: legacy.createdAt,
          updatedAt: legacy.updatedAt,
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).exec();

    migrated += 1;
  }

  console.log(`Migration complete. Migrated ${migrated} documents.`);

  await mongoose.disconnect();
};

migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
