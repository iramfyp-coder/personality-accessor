const mongoose = require('mongoose');

const CV_SCHEMA_VERSION = '1.0.0';
const RESULT_SCHEMA_VERSION = '2.0.0';

const cvSkillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: Number, min: 1, max: 5, default: 3 },
    category: { type: String, default: 'general', trim: true },
  },
  { _id: false }
);

const cvDataSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    skills: { type: [cvSkillSchema], default: [] },
    subjects: { type: [String], default: [] },
    marks: {
      type: [
        {
          subject: { type: String, default: '', trim: true },
          score: { type: Number, default: 0, min: 0, max: 100 },
        },
      ],
      default: [],
    },
    projects: { type: [String], default: [] },
    tools: { type: [String], default: [] },
    education: { type: [String], default: [] },
    experience: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    careerSignals: { type: [String], default: [] },
    subjectVector: { type: mongoose.Schema.Types.Mixed, default: {} },
    skillVector: { type: mongoose.Schema.Types.Mixed, default: {} },
    interestVector: { type: mongoose.Schema.Types.Mixed, default: {} },
    confidenceScore: { type: Number, min: 0, max: 1, default: 0 },
    source: { type: String, enum: ['ai', 'heuristic'], default: 'heuristic' },
    schemaVersion: { type: String, default: CV_SCHEMA_VERSION, trim: true },
  },
  { _id: false }
);

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['likert', 'scale', 'mcq', 'text', 'scenario', 'behavior'],
      required: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    metadata: {
      trait: { type: String, default: '', trim: true },
      difficulty: { type: String, default: '', trim: true },
      category: { type: String, default: '', trim: true },
      plannerCategory: { type: String, default: '', trim: true },
      traitTarget: { type: String, default: '', trim: true },
      intent: { type: String, default: '', trim: true },
      stage: { type: String, default: '', trim: true },
      theme: { type: String, default: '', trim: true },
      answerFormat: { type: String, default: '', trim: true },
      scoringType: { type: String, default: '', trim: true },
      responseTimeMs: { type: Number, default: 0 },
      isNeutral: { type: Boolean, default: false },
      isSkipped: { type: Boolean, default: false },
      normalizedScore: { type: Number, default: 0 },
      scaleMin: { type: Number, default: undefined },
      scaleMax: { type: Number, default: undefined },
      analysis: { type: mongoose.Schema.Types.Mixed, default: undefined },
    },
  },
  { _id: false }
);

const aiReportSchema = new mongoose.Schema(
  {
    summary: { type: String, default: '', trim: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    communicationStyle: { type: String, default: '', trim: true },
    workStyle: { type: String, default: '', trim: true },
    growthSuggestions: { type: [String], default: [] },
    careerRecommendations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    model: { type: String, default: '', trim: true },
    promptVersion: { type: String, default: '', trim: true },
    generatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const assessmentResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentSession',
      required: true,
      unique: true,
      index: true,
    },
    cvData: {
      type: cvDataSchema,
      default: () => ({}),
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    behavior: {
      analysis: { type: mongoose.Schema.Types.Mixed, default: {} },
      signals: { type: mongoose.Schema.Types.Mixed, default: {} },
      vector: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    personality: {
      traits: { type: mongoose.Schema.Types.Mixed, default: {} },
      cognitiveScores: { type: mongoose.Schema.Types.Mixed, default: {} },
      archetypes: { type: mongoose.Schema.Types.Mixed, default: {} },
      consistencyScore: { type: Number, min: 0, max: 1, default: 0 },
      consistencySignals: { type: [String], default: [] },
      narrativeSummary: { type: String, default: '', trim: true },
    },
    career: {
      recommendations: { type: [mongoose.Schema.Types.Mixed], default: [] },
      roadmap: { type: [mongoose.Schema.Types.Mixed], default: [] },
      fitScores: { type: mongoose.Schema.Types.Mixed, default: {} },
      cluster: { type: String, default: '', trim: true },
      clusterLabel: { type: String, default: '', trim: true },
      whyNotCatalog: { type: mongoose.Schema.Types.Mixed, default: {} },
      contrast: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    analytics: {
      trendVector: { type: mongoose.Schema.Types.Mixed, default: {} },
      confidence: { type: Number, min: 0, max: 1, default: 0 },
      confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
      confidenceGap: { type: Number, min: 0, max: 100, default: 0 },
      confidenceBand: { type: String, default: 'low', trim: true },
      stopConfidence: { type: Number, min: 0, max: 1, default: 0 },
      aiReport: { type: aiReportSchema, default: undefined },
    },
    schemaVersion: { type: String, default: RESULT_SCHEMA_VERSION, trim: true },
    legacyAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

assessmentResultSchema.index({ userId: 1, createdAt: -1 });
assessmentResultSchema.index({ userId: 1, completedAt: -1 });

module.exports = mongoose.model('AssessmentResult', assessmentResultSchema);
