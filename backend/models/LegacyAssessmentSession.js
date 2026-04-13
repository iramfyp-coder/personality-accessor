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

const legacyAssessmentSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
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

legacyAssessmentSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });
legacyAssessmentSessionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model(
  'LegacyAssessmentSession',
  legacyAssessmentSessionSchema,
  'assessmentsessions'
);
