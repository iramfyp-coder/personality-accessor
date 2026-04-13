const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ensureJsonObjectPayload,
  extractSubmittedSessionId,
  extractSubmittedQuestionId,
  extractSubmittedQuestionSequence,
  assertSessionMatch,
  assertQuestionProvided,
} = require('../utils/assessmentRequestValidation');

const randomPrimitive = () => {
  const generators = [
    () => null,
    () => undefined,
    () => Math.random() * 100,
    () => Math.random().toString(36),
    () => Math.random() > 0.5,
  ];

  return generators[Math.floor(Math.random() * generators.length)]();
};

const randomValue = (depth = 0) => {
  if (depth > 2) {
    return randomPrimitive();
  }

  const pick = Math.floor(Math.random() * 5);

  if (pick === 0) {
    return randomPrimitive();
  }

  if (pick === 1) {
    return [randomValue(depth + 1), randomValue(depth + 1), randomValue(depth + 1)];
  }

  const obj = {};
  const keys = [
    'questionId',
    'sessionId',
    'currentQuestion',
    'value',
    'answer',
    'answerTimeMs',
    'sequence',
    'payload',
  ];

  for (const key of keys) {
    if (Math.random() > 0.5) {
      obj[key] = key === 'currentQuestion'
        ? { id: randomPrimitive(), questionId: randomPrimitive(), sequence: randomPrimitive() }
        : randomValue(depth + 1);
    }
  }

  return obj;
};

test('handles missing payload with explicit error', () => {
  assert.throws(
    () => ensureJsonObjectPayload(undefined),
    /Request payload is required and must be a JSON object/
  );
});

test('handles invalid question with explicit error', () => {
  const payload = ensureJsonObjectPayload({});
  const submittedQuestionId = extractSubmittedQuestionId(payload);

  assert.equal(submittedQuestionId, '');
  assert.throws(() => assertQuestionProvided({ submittedQuestionId }), /questionId is required/);
});

test('handles session mismatch with explicit error', () => {
  assert.throws(
    () =>
      assertSessionMatch({
        submittedSessionId: 'session-a',
        activeSessionId: 'session-b',
      }),
    /sessionId does not match the active session/
  );
});

test('fuzz validation does not crash on random payload shapes', () => {
  for (let i = 0; i < 500; i += 1) {
    const candidate = randomValue();

    try {
      const payload = ensureJsonObjectPayload(candidate);
      extractSubmittedSessionId(payload);
      extractSubmittedQuestionId(payload);
      extractSubmittedQuestionSequence(payload);
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  }
});
