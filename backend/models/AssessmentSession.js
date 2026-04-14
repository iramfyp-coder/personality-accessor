const mongoose = require('mongoose');

const IN_PROGRESS_TTL_DAYS = 7;
const COMPLETED_TTL_DAYS = 120;
const CV_SCHEMA_VERSION = '1.0.0';

const QUESTION_STAGES = ['personality', 'cognitive', 'behavior', 'career'];
const QUESTION_THEMES = [
  'academic',
  'workplace',
  'social',
  'leadership',
  'creative',
  'technical',
  'personal',
  'decision',
  'stress',
];
const QUESTION_ANSWER_FORMATS = [
  'rating',
  'choice',
  'slider',
  'text_short',
  'text_long',
  'scenario_decision',
];
const QUESTION_SCORING_TYPES = [
  'numeric',
  'weighted',
  'ai_analysis',
  'behavior_signal',
  'cognitive_signal',
];

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

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

const unifiedAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['likert', 'scale', 'mcq', 'text', 'scenario', 'behavior'],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    metadata: {
      trait: {
        type: String,
        default: '',
        trim: true,
      },
      difficulty: {
        type: String,
        default: '',
        trim: true,
      },
      category: {
        type: String,
        default: '',
        trim: true,
      },
      plannerCategory: {
        type: String,
        default: '',
        trim: true,
      },
      traitTarget: {
        type: String,
        default: '',
        trim: true,
      },
      intent: {
        type: String,
        default: '',
        trim: true,
      },
      stage: {
        type: String,
        enum: QUESTION_STAGES,
        default: 'personality',
      },
      theme: {
        type: String,
        enum: QUESTION_THEMES,
        default: 'personal',
      },
      answerFormat: {
        type: String,
        enum: QUESTION_ANSWER_FORMATS,
        default: 'choice',
      },
      scoringType: {
        type: String,
        enum: QUESTION_SCORING_TYPES,
        default: 'numeric',
      },
      responseTimeMs: {
        type: Number,
        default: 0,
      },
      isNeutral: {
        type: Boolean,
        default: false,
      },
      isSkipped: {
        type: Boolean,
        default: false,
      },
      normalizedScore: {
        type: Number,
        default: 0,
      },
      scaleMin: {
        type: Number,
        default: undefined,
      },
      scaleMax: {
        type: Number,
        default: undefined,
      },
      analysis: {
        type: mongoose.Schema.Types.Mixed,
        default: undefined,
      },
    },
    answeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

// Deprecated legacy MCQ answer format kept for backward compatibility while data migrates.
const scaleAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'likert',
        'scale',
        'mcq',
        'text',
        'scenario',
        'technical_validation',
        'behavioral_psychology',
        'problem_solving',
        'interest_alignment',
        'decision_simulation',
      ],
      default: 'behavioral_psychology',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'advanced', 'beginner', 'intermediate'],
      default: 'medium',
    },
    traitFocus: {
      type: String,
      enum: ['O', 'C', 'E', 'A', 'N'],
      default: 'O',
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Deprecated legacy behavior answer format kept for backward compatibility while data migrates.
const behaviorAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      default: '',
      trim: true,
    },
    promptId: {
      type: String,
      required: true,
      trim: true,
    },
    prompt: {
      type: String,
      default: '',
      trim: true,
    },
    answer: {
      type: String,
      default: '',
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    trait: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      default: 'behavior',
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const progressEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    stage: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const questionPlanItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: '',
      trim: true,
    },
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      default: 'adaptive_bank',
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'likert',
        'scale',
        'mcq',
        'text',
        'scenario',
        'technical_validation',
        'behavioral_psychology',
        'problem_solving',
        'interest_alignment',
        'decision_simulation',
      ],
      required: true,
    },
    rawAnswerType: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'personality',
      required: true,
      trim: true,
    },
    plannerCategory: {
      type: String,
      default: 'personality',
      trim: true,
    },
    intent: {
      type: String,
      default: '',
      trim: true,
    },
    intentTag: {
      type: String,
      default: '',
      trim: true,
    },
    trait: {
      type: String,
      default: '',
      trim: true,
    },
    traitFocus: {
      type: String,
      enum: ['O', 'C', 'E', 'A', 'N'],
      default: 'O',
    },
    traitTarget: {
      type: String,
      default: 'O',
      trim: true,
    },
    facet: {
      type: String,
      default: '',
      trim: true,
    },
    expectsExample: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [
        {
          id: { type: String, required: true, trim: true },
          label: { type: String, required: true, trim: true },
          weight: { type: Number, default: 3, min: 1, max: 5 },
          icon: { type: String, default: '', trim: true },
        },
      ],
      default: [],
    },
    scaleMin: {
      type: Number,
      default: null,
      min: 1,
      max: 10,
    },
    scaleMax: {
      type: Number,
      default: null,
      min: 1,
      max: 10,
    },
    expectedAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'advanced', 'beginner', 'intermediate'],
      default: 'medium',
    },
    scenario: {
      type: String,
      default: '',
      trim: true,
    },
    theme: {
      type: String,
      enum: QUESTION_THEMES,
      default: 'personal',
      trim: true,
    },
    stage: {
      type: String,
      enum: QUESTION_STAGES,
      default: 'personality',
      trim: true,
    },
    answerFormat: {
      type: String,
      enum: QUESTION_ANSWER_FORMATS,
      default: 'choice',
      trim: true,
    },
    scoringType: {
      type: String,
      enum: QUESTION_SCORING_TYPES,
      default: 'numeric',
      trim: true,
    },
    uiHint: {
      type: String,
      default: '',
      trim: true,
    },
    expectedLength: {
      type: Number,
      default: 0,
      min: 0,
      max: 2000,
    },
    memorySignature: {
      type: String,
      default: '',
      trim: true,
    },
    promptByLevel: {
      beginner: { type: String, default: '' },
      intermediate: { type: String, default: '' },
      advanced: { type: String, default: '' },
    },
    activeDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'advanced', 'beginner', 'intermediate'],
      default: 'medium',
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    domainTags: {
      type: [String],
      default: [],
    },
    skillTags: {
      type: [String],
      default: [],
    },
    cvRelevance: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    reasoningWeight: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    aiMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  { _id: false }
);

const assessmentSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: ['cv_upload', 'questionnaire', 'behavior', 'result'],
      default: 'cv_upload',
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      enum: ['', 'student', 'graduate', 'professional'],
      default: '',
      trim: true,
    },
    userProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    cvData: {
      type: cvDataSchema,
      default: () => ({}),
    },
    cvRawText: {
      type: String,
      default: '',
      trim: true,
    },
    aiProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    profileVector: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    smartIntro: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    questionPlan: {
      type: [questionPlanItemSchema],
      default: [],
    },
    questionPoolBackup: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    askedQuestions: {
      type: [String],
      default: [],
    },
    usedIntents: {
      type: [String],
      default: [],
    },
    adaptiveMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    answers: {
      type: [unifiedAnswerSchema],
      default: [],
    },
    answersJson: {
      type: [scaleAnswerSchema],
      default: [],
    },
    behaviorPrompts: {
      type: [
        {
          promptId: { type: String, required: true, trim: true },
          prompt: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },
    currentBehaviorIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    behaviorAnswers: {
      type: [behaviorAnswerSchema],
      default: [],
    },
    // Deprecated denormalized result fields retained for read compatibility.
    behaviorAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    personalityProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    careerRecommendations: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    careerRoadmap: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    resultSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentResult',
      default: null,
      index: true,
    },
    chatHistory: {
      type: [chatMessageSchema],
      default: [],
    },
    progressEvents: {
      type: [progressEventSchema],
      default: [],
    },
    lastEventId: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
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
    expiresAt: {
      type: Date,
      required: true,
      default: () => addDays(new Date(), IN_PROGRESS_TTL_DAYS),
    },
  },
  {
    timestamps: true,
  }
);

assessmentSessionSchema.pre('validate', function onValidate(next) {
  const baseDate = this.lastActiveAt || this.updatedAt || new Date();
  const ttlDays = this.status === 'completed' ? COMPLETED_TTL_DAYS : IN_PROGRESS_TTL_DAYS;
  this.expiresAt = addDays(baseDate, ttlDays);

  if (Array.isArray(this.behaviorAnswers)) {
    this.behaviorAnswers = this.behaviorAnswers.map((answer = {}) => {
      const normalizedText = String(answer.text || answer.answer || '').trim();
      const normalizedPrompt = String(answer.prompt || '').trim();
      const normalizedPromptId = String(answer.promptId || answer.questionId || '').trim();

      return {
        ...answer,
        questionId: String(answer.questionId || answer.promptId || '').trim(),
        promptId: normalizedPromptId,
        prompt: normalizedPrompt,
        answer: normalizedText,
        text: normalizedText,
        trait: String(answer.trait || '').trim(),
        type: String(answer.type || 'behavior').trim(),
        category: String(answer.category || '').trim(),
      };
    });
  }

  next();
});

assessmentSessionSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'in_progress' },
  }
);
assessmentSessionSchema.index({ userId: 1, status: 1, updatedAt: -1 });
assessmentSessionSchema.index({ status: 1, stage: 1, updatedAt: -1 });
assessmentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AssessmentSession', assessmentSessionSchema, 'assessmentflowsessions');
