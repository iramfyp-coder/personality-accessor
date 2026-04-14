const test = require('node:test');
const assert = require('node:assert/strict');

const { generateQuestionPlan } = require('../services/assessment/question-engine.service');

const normalize = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cosineSimilarity = (left = '', right = '') => {
  const toVector = (text = '') =>
    normalize(text)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
      .reduce((accumulator, token) => {
        accumulator[token] = Number(accumulator[token] || 0) + 1;
        return accumulator;
      }, {});

  const leftVec = toVector(left);
  const rightVec = toVector(right);
  const leftKeys = Object.keys(leftVec);
  const rightKeys = Object.keys(rightVec);

  if (!leftKeys.length || !rightKeys.length) {
    return 0;
  }

  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  leftKeys.forEach((key) => {
    const value = Number(leftVec[key] || 0);
    leftMag += value * value;
    if (rightVec[key]) {
      dot += value * Number(rightVec[key] || 0);
    }
  });

  rightKeys.forEach((key) => {
    const value = Number(rightVec[key] || 0);
    rightMag += value * value;
  });

  if (!leftMag || !rightMag) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

test('phase 7 question plan enforces psychometric quality constraints', async () => {
  const output = await generateQuestionPlan({
    cvData: {
      skills: [
        { name: 'Node.js', level: 4, category: 'backend' },
        { name: 'React', level: 4, category: 'frontend' },
      ],
      interests: ['product strategy', 'team growth'],
      tools: ['GitHub', 'Docker'],
      projects: ['workflow automation platform'],
      education: ['Bachelor of Computer Science'],
      experience: ['4 years software engineer'],
    },
  });

  const questionPlan = output.questionPlan || [];
  assert.equal(questionPlan.length, 22, 'must generate exactly 22 final questions');
  assert.ok((output.questionPoolBackup || []).length >= 50, 'must generate a 50+ candidate pool');

  const intents = new Set();
  const responseTypeCounts = {};
  const contextCounts = {};
  const difficultyCounts = {};

  questionPlan.forEach((question) => {
    const text = String(question.text || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const responseType = String(question.type || '').toLowerCase();

    assert.ok(words.length >= 13 && words.length <= 22, `question length out of bounds: "${text}"`);
    assert.ok(text.endsWith('?'), `question must end with ?: "${text}"`);
    assert.equal(typeof question.intentTag, 'string');
    assert.ok(question.intentTag.length > 0);
    assert.ok(!intents.has(question.intentTag), `duplicate intent tag: ${question.intentTag}`);
    intents.add(question.intentTag);

    responseTypeCounts[responseType] = Number(responseTypeCounts[responseType] || 0) + 1;

    const context = String(question.contextBucket || '');
    contextCounts[context] = Number(contextCounts[context] || 0) + 1;

    const difficulty = String(question.difficulty || '');
    difficultyCounts[difficulty] = Number(difficultyCounts[difficulty] || 0) + 1;

    const options = Array.isArray(question.options) ? question.options : [];
    if (responseType === 'mcq') {
      assert.equal(options.length, 4, 'each MCQ must have four options');
      const optionLabels = new Set(options.map((item) => normalize(item.label)));
      assert.equal(optionLabels.size, 4, 'options must be behaviorally distinct');
    } else {
      assert.equal(options.length, 0, `non-mcq question must not include options: ${question.questionId}`);
    }
  });

  assert.deepEqual(responseTypeCounts, {
    likert: 9,
    mcq: 6,
    scale: 4,
    text: 3,
  });
  assert.deepEqual(contextCounts, {
    personality_general: 15,
    cognitive_scenario: 4,
    cv_specific: 3,
  });
  assert.deepEqual(difficultyCounts, {
    easy: 5,
    medium: 7,
    advanced: 10,
  });

  for (let i = 0; i < questionPlan.length; i += 1) {
    for (let j = i + 1; j < questionPlan.length; j += 1) {
      const similarity = cosineSimilarity(questionPlan[i].text, questionPlan[j].text);
      assert.ok(similarity <= 0.82, `semantic repetition detected: ${similarity.toFixed(3)}`);
    }
  }
});
