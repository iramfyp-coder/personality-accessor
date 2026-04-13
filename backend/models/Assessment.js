const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  { _id: false }
);

const traitScoresSchema = new mongoose.Schema(
  {
    O: { type: Number, required: true, min: 0, max: 100 },
    C: { type: Number, required: true, min: 0, max: 100 },
    E: { type: Number, required: true, min: 0, max: 100 },
    A: { type: Number, required: true, min: 0, max: 100 },
    N: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const aiCareerRecommendationSchema = new mongoose.Schema(
  {
    career: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    skillsNeeded: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      default: 'ai',
      trim: true,
    },
    signal: {
      type: String,
      default: undefined,
      trim: true,
    },
  },
  { _id: false }
);

const aiReportSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    communicationStyle: {
      type: String,
      required: true,
      trim: true,
    },
    workStyle: {
      type: String,
      required: true,
      trim: true,
    },
    growthSuggestions: {
      type: [String],
      default: [],
    },
    careerRecommendations: {
      type: [aiCareerRecommendationSchema],
      default: [],
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    promptVersion: {
      type: String,
      required: true,
      trim: true,
    },
    generatedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    answers: {
      type: [answerSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one answer is required',
      },
    },
    traitScores: {
      type: traitScoresSchema,
      required: true,
    },
    facetScores: {
      type: Map,
      of: Number,
      default: undefined,
    },
    modelVersion: {
      type: String,
      required: true,
      trim: true,
    },
    aiReport: {
      type: aiReportSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

assessmentSchema.index({ userId: 1, createdAt: -1 });
assessmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
