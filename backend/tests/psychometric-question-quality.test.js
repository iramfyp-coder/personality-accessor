const test = require('node:test');
const assert = require('node:assert/strict');

process.env.OPENAI_API_KEY = '';

const { generateQuestionPlan } = require('../services/assessment/question-engine.service');

const normalize = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

test('phase 7.8 adaptive question plan is AI-driven and CV-aware', async () => {
  const output = await generateQuestionPlan({
    cvData: {
      source_domain: 'technology',
      skills: [
        { name: 'Node.js', level: 4, category: 'backend' },
        { name: 'React', level: 4, category: 'frontend' },
        { name: 'Docker', level: 3, category: 'cloud' },
      ],
      interests: ['product strategy', 'team growth', 'automation'],
      tools: ['GitHub', 'Docker'],
      projects: ['workflow automation platform'],
      education: ['Bachelor of Computer Science'],
      experience: ['4 years software engineer'],
      subjects: ['computer science', 'software engineering'],
    },
    cvRawText:
      'Software engineer with backend and frontend project ownership. Built workflow automation platform and collaborated across product and engineering teams.',
  });

  const questionPlan = output.questionPlan || [];

  assert.equal(questionPlan.length, 22, 'must generate exactly 22 main adaptive questions');
  assert.equal(
    (output.prefetchedSupplementalQuestionPlan || []).length,
    4,
    'must prefetch 4 supplemental adaptive questions'
  );
  assert.ok(output.aiProfile && typeof output.aiProfile === 'object', 'must include AI CV profile');
  assert.ok(output.aiProfile.domain, 'ai profile domain is required');

  const typeCounts = {};
  const signatures = new Set();

  questionPlan.forEach((question) => {
    const text = String(question.text || '').trim();
    const words = text.split(/\s+/).filter(Boolean);

    assert.ok(words.length >= 13 && words.length <= 22, `question length out of bounds: "${text}"`);
    assert.ok(text.endsWith('?'), `question must end with ?: "${text}"`);

    const type = String(question.type || '').toLowerCase();
    assert.ok(['mcq', 'likert', 'scale', 'text'].includes(type), `invalid question type: ${type}`);

    typeCounts[type] = Number(typeCounts[type] || 0) + 1;

    const signature = String(question.memorySignature || '').trim();
    assert.ok(signature.length > 0, 'memory signature required');
    assert.ok(!signatures.has(signature), 'duplicate question signature detected');
    signatures.add(signature);

    assert.ok(['O', 'C', 'E', 'A', 'N'].includes(String(question.traitFocus || '').toUpperCase()));
    assert.ok(['easy', 'medium', 'advanced'].includes(String(question.difficulty || '').toLowerCase()));

    const cvRelevance = Number(question.cvRelevance || question?.aiMeta?.cv_relevance || 0);
    const reasoningWeight = Number(question.reasoningWeight || question?.aiMeta?.reasoning_weight || 0);

    assert.ok(cvRelevance >= 0 && cvRelevance <= 1, 'cv relevance must be normalized 0..1');
    assert.ok(reasoningWeight >= 0 && reasoningWeight <= 1, 'reasoning weight must be normalized 0..1');

    const options = Array.isArray(question.options) ? question.options : [];

    if (type === 'mcq') {
      assert.equal(options.length, 4, 'mcq question must provide four options');
      const normalizedOptions = new Set(options.map((item) => normalize(item.label)));
      assert.equal(normalizedOptions.size, 4, 'mcq options must be behaviorally distinct');
    } else {
      assert.equal(options.length, 0, `non-mcq question must not include options: ${question.questionId}`);
    }
  });

  assert.ok(Object.keys(typeCounts).length >= 3, 'adaptive engine must vary answer types');
  assert.ok((typeCounts.mcq || 0) >= 4, 'adaptive plan should include contextual mcqs');
  assert.ok((typeCounts.text || 0) >= 2, 'adaptive plan should include reasoning text prompts');
});
