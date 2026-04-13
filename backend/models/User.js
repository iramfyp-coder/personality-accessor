const mongoose = require("mongoose");

const askedQuestionSchema = new mongoose.Schema(
  {
    signature: { type: String, required: true, trim: true },
    text: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },
    intent: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String, sparse: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  askedQuestions: { type: [askedQuestionSchema], default: [] },
  preferredCareerLens: {
    type: String,
    enum: ['', 'people', 'data', 'creativity', 'business'],
    default: '',
  },
});
// Custom validation: require EITHER password OR googleId
userSchema.pre('save', function(next) {
  if (!this.password && !this.googleId) {
    return next(new Error('Either password or googleId is required'));
  }
  next();
});
module.exports = mongoose.model("User", userSchema);
