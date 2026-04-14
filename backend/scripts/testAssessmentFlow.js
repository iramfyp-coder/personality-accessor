/* eslint-disable no-console */
const assert = require('assert');
const Question = require('../models/Question');
const { heuristicCvParser } = require('../services/assessment/cvAnalysis.service');
const {
  buildUserProfileVector,
  generateQuestionPlan,
  adaptUpcomingQuestions,
} = require('../services/assessment/question-engine.service');
const { evaluatePersonalityProfile } = require('../services/assessment/personality-engine.service');
const { recommendCareers } = require('../services/assessment/career-recommendation.service');

const createFindMock = (questions = []) => () => ({
  sort: () => ({
    lean: async () => questions,
  }),
});

const sampleCvText = `
  Muzammil Khan
  Full Stack Developer with 3 years experience.
  Built web platforms using React, Node.js, TypeScript, PostgreSQL, Docker, and AWS.
  Education: Bachelor of Computer Science
  Interests: Open source, design systems, mentoring, AI.
`;

const run = async () => {
  const parsedCv = heuristicCvParser(sampleCvText);

  assert(parsedCv.name.toLowerCase().includes('muzammil'), 'Name should be extracted');
  assert(
    parsedCv.skills.some((skill) => /react/i.test(skill.name)),
    'React skill should be detected'
  );
  assert(parsedCv.education.length >= 1, 'Education should be detected');

  const profileVector = buildUserProfileVector(parsedCv);
  assert(profileVector.experienceLevel, 'Experience level should be computed');

  const originalFind = Question.find;
  Question.find = createFindMock([]);

  const planOutput = await generateQuestionPlan({ cvData: parsedCv });
  Question.find = originalFind;

  assert.equal(planOutput.questionPlan.length, 22, 'Question count should be 22');

  const sessionLike = {
    currentQuestionIndex: 0,
    questionPlan: JSON.parse(JSON.stringify(planOutput.questionPlan)),
    profileVector: planOutput.profileVector,
  };

  const beforeDifficulty = sessionLike.questionPlan[1]?.activeDifficulty;
  adaptUpcomingQuestions({
    session: sessionLike,
    answerValue: 5,
  });

  const afterDifficulty = sessionLike.questionPlan[1]?.activeDifficulty;
  assert(afterDifficulty || beforeDifficulty, 'Adaptive branching should keep next difficulty available');

  const answers = planOutput.questionPlan.slice(0, 10).map((question, index) => ({
    questionId: question.questionId,
    value: index % 2 === 0 ? 4 : 3,
  }));

  const behaviorAnalysis = {
    personality_signals: ['Reflective response pattern', 'Calm under uncertainty'],
    emotional_stability: 'stable and reflective',
    decision_style: 'evidence-led',
    confidence_level: 'moderate to high',
    risk_tendency: 'calculated risk taker',
  };

  const personalityA = evaluatePersonalityProfile({
    cvData: parsedCv,
    profileVector,
    traitVectorOutput: {
      oceanVector: { O: 62, C: 70, E: 56, A: 58, N: 42 },
      cognitiveVector: {
        analytical: 66,
        creative: 61,
        strategic: 64,
        systematic: 68,
        practical: 60,
        abstract: 58,
      },
      behaviorVector: {
        leadership: 57,
        analysis: 65,
        creativity: 61,
        risk: 54,
        collaboration: 59,
        execution: 67,
      },
    },
    questionPlan: planOutput.questionPlan,
    answers,
    behaviorAnalysis,
  });

  const personalityB = evaluatePersonalityProfile({
    cvData: parsedCv,
    profileVector,
    traitVectorOutput: {
      oceanVector: { O: 62, C: 70, E: 56, A: 58, N: 42 },
      cognitiveVector: {
        analytical: 66,
        creative: 61,
        strategic: 64,
        systematic: 68,
        practical: 60,
        abstract: 58,
      },
      behaviorVector: {
        leadership: 57,
        analysis: 65,
        creativity: 61,
        risk: 54,
        collaboration: 59,
        execution: 67,
      },
    },
    questionPlan: planOutput.questionPlan,
    answers,
    behaviorAnalysis,
  });

  assert.deepStrictEqual(
    personalityA.trait_scores,
    personalityB.trait_scores,
    'Personality trait scores should be deterministic for same inputs'
  );

  const careerOutput = await recommendCareers({
    cvData: parsedCv,
    aiProfile: planOutput.aiProfile || {},
    personalityProfile: personalityA,
    profileVector,
  });

  assert(
    careerOutput.recommendations.length >= 5 && careerOutput.recommendations.length <= 10,
    'Career recommendation count should be between 5 and 10'
  );

  assert(
    Number.isFinite(careerOutput.recommendations[0].skill_alignment),
    'Career recommendation should include skill alignment'
  );

  console.log('assessment-flow smoke tests passed');
};

run().catch((error) => {
  console.error('assessment-flow smoke tests failed');
  console.error(error);
  process.exit(1);
});
