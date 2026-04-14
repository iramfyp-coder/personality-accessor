import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiBarChart2, FiCircle } from 'react-icons/fi';
import { gsap } from 'gsap';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Loader from '../../components/ui/Loader';
import LoaderOverlay from '../../components/ui/LoaderOverlay';
import QuestionRenderer from '../../components/assessment/QuestionRenderer';
import QuestionVisualPanel from '../../components/assessment/QuestionVisualPanel';
import TraitRadarChart from '../../components/charts/TraitRadarChart';
import { useAuth } from '../../hooks/useAuth';
import {
  useAdaptiveQuestionQuery,
  usePreviousAdaptiveQuestionMutation,
  useSubmitAdaptiveAnswerMutation,
} from '../../hooks/useAssessmentFlow';
import {
  readAssessmentFlowState,
  saveAssessmentFlowState,
} from '../../utils/assessmentFlowStorage';

const STAGE_LABELS = {
  personality: 'PERSONALITY ANALYSIS',
  cognitive: 'COGNITIVE ANALYSIS',
  behavior: 'BEHAVIOR ANALYSIS',
  career: 'CAREER ALIGNMENT',
};

const TRAIT_LABELS = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeStage = (value) => {
  const normalized = String(value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(STAGE_LABELS, normalized)
    ? normalized
    : 'personality';
};

const toTraitToken = (raw = '') => {
  const token = String(raw || '').trim().toUpperCase();
  const first = token.charAt(0);

  if (TRAIT_LABELS[first]) {
    return first;
  }

  const normalized = token.toLowerCase();

  if (/leader|social|energy|extro/.test(normalized)) return 'E';
  if (/agree|team|conflict|empath/.test(normalized)) return 'A';
  if (/stress|risk|neuro/.test(normalized)) return 'N';
  if (/plan|analytic|conscient|system/.test(normalized)) return 'C';
  return 'O';
};

const toTraitLabel = (question = {}) => {
  const token = toTraitToken(question.traitFocus || question.traitTarget || question.trait || '');
  if (TRAIT_LABELS[token]) {
    return TRAIT_LABELS[token];
  }

  return String(question.trait || 'Trait').replace(/_/g, ' ');
};

const normalizeAnswerScore = (answer = {}) => {
  const type = String(answer.type || '').toLowerCase();
  const value = answer.value;

  if (typeof value === 'number') {
    if (type === 'scale') {
      const min = Number(answer.metadata?.scaleMin || 1);
      const max = Number(answer.metadata?.scaleMax || 10);
      if (max > min) {
        return clamp(((value - min) / (max - min)) * 100, 0, 100);
      }
    }

    return clamp(value * 20, 0, 100);
  }

  const normalizedScore = Number(value?.normalizedScore || answer.metadata?.normalizedScore || 0);
  if (Number.isFinite(normalizedScore) && normalizedScore > 0) {
    return clamp(normalizedScore * 20, 0, 100);
  }

  return 50;
};

const inferCurrentScore = ({ question, likertValue, scaleValue, optionId, textValue }) => {
  if (!question) {
    return 50;
  }

  if (question.type === 'likert') {
    return clamp(Number(likertValue || 3) * 20, 0, 100);
  }

  if (question.type === 'scale') {
    const min = Number(question.scaleMin || 1);
    const max = Number(question.scaleMax || 10);
    if (max > min) {
      return clamp(((Number(scaleValue || min) - min) / (max - min)) * 100, 0, 100);
    }
  }

  if (question.type === 'mcq' || question.type === 'scenario') {
    const selected = (question.options || []).find((item) => String(item.id) === String(optionId));
    if (selected) {
      return clamp(Number(selected.weight || 3) * 20, 0, 100);
    }
  }

  if (question.type === 'text') {
    return clamp((String(textValue || '').trim().length / 160) * 100, 0, 100);
  }

  return 50;
};

const AdaptiveAssessmentTestPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const auth = useAuth();

  const localState = useMemo(() => readAssessmentFlowState(auth.userId) || {}, [auth.userId]);
  const sessionFromQuery = searchParams.get('session') || '';
  const sessionFromStorage = localState?.sessionId || '';
  const sessionId = sessionFromQuery || sessionFromStorage;

  const questionQuery = useAdaptiveQuestionQuery(sessionId, Boolean(sessionId));
  const answerMutation = useSubmitAdaptiveAnswerMutation();
  const previousMutation = usePreviousAdaptiveQuestionMutation();

  const [likertValue, setLikertValue] = useState(0);
  const [scaleValue, setScaleValue] = useState(0);
  const [optionId, setOptionId] = useState('');
  const [textValue, setTextValue] = useState('');
  const [exampleValue, setExampleValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [questionStartAt, setQuestionStartAt] = useState(Date.now());

  const progressBarRef = useRef(null);
  const questionCardRef = useRef(null);
  const sidePanelRef = useRef(null);
  const questionRef = useRef(null);
  const radarTweenRef = useRef(null);
  const radarStateRef = useRef({
    O: 50,
    C: 50,
    E: 50,
    A: 50,
    N: 50,
  });
  const [animatedTraitPreview, setAnimatedTraitPreview] = useState(radarStateRef.current);

  const stage = questionQuery.data?.session?.stage || 'questionnaire';
  const question = questionQuery.data?.question || null;

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    if (!sessionId) {
      navigate('/assessment/start', { replace: true });
      return;
    }

    if (stage === 'behavior') {
      navigate(`/assessment/behavior?session=${sessionId}`, { replace: true });
      return;
    }

    if (stage === 'result') {
      navigate(`/assessment/result?session=${sessionId}`, { replace: true });
    }
  }, [stage, sessionId, navigate]);

  useEffect(() => {
    if (!sessionId || !questionQuery.data?.session?.stage) {
      return;
    }

    saveAssessmentFlowState(auth.userId, {
      sessionId,
      stage: questionQuery.data.session.stage,
      userRole: questionQuery.data?.session?.userRole || localState.userRole,
      userProfile: questionQuery.data?.session?.userProfile || localState.userProfile,
      inputMode: localState.inputMode || 'cv',
    });
  }, [auth.userId, localState.inputMode, localState.userProfile, localState.userRole, questionQuery.data, sessionId]);

  useEffect(() => {
    setLikertValue(0);
    setScaleValue(0);
    setOptionId('');
    setTextValue('');
    setExampleValue('');
    setFeedback('');
    setQuestionStartAt(Date.now());

    if (!questionCardRef.current || prefersReducedMotion) {
      return;
    }

    const timeline = gsap.timeline();
    timeline.fromTo(
      questionCardRef.current,
      { autoAlpha: 0, y: 30, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.48, ease: 'power3.out' }
    );
    if (sidePanelRef.current) {
      timeline.fromTo(
        sidePanelRef.current,
        { autoAlpha: 0, y: 22, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.44, ease: 'power3.out' },
        0.05
      );
    }

    return () => timeline.kill();
  }, [question?.questionId, question?.id, question?.sequence, question?.scaleMin, prefersReducedMotion]);

  const progress = useMemo(() => {
    if (!question) {
      return 0;
    }

    return Math.round(((question.index + 1) / Math.max(question.total, 1)) * 100);
  }, [question]);

  useEffect(() => {
    if (!progressBarRef.current) {
      return;
    }

    gsap.to(progressBarRef.current, {
      width: `${progress}%`,
      duration: prefersReducedMotion ? 0 : 0.58,
      ease: 'power2.out',
    });
  }, [progress, prefersReducedMotion]);

  const canSubmit = useMemo(() => {
    if (!question) {
      return false;
    }

    if (question.type === 'likert') {
      return likertValue >= 1 && likertValue <= 5;
    }

    if (question.type === 'scale') {
      const min = Number(question.scaleMin || 1);
      const max = Number(question.scaleMax || 10);
      return scaleValue >= min && scaleValue <= max;
    }

    if (question.type === 'mcq') {
      return Boolean(optionId);
    }

    if (question.type === 'text') {
      if (textValue.trim().length < 4) {
        return false;
      }

      if (question.expectsExample && exampleValue.trim().length < 4) {
        return false;
      }

      return true;
    }

    if (question.type === 'scenario') {
      return Boolean(optionId || textValue.trim().length >= 4);
    }

    return false;
  }, [question, likertValue, scaleValue, optionId, textValue, exampleValue]);

  const elapsedTimeMs = useCallback(() => Math.max(300, Date.now() - questionStartAt), [questionStartAt]);

  const buildPayload = useCallback(
    () => {
      const activeQuestion = questionRef.current;

      if (!activeQuestion) {
        return null;
      }

      const normalizedQuestionId =
        String(activeQuestion.id || activeQuestion.questionId || '').trim();
      const sequence = Number(activeQuestion.sequence || activeQuestion.index + 1 || 1);
      const selectedOption = (activeQuestion.options || []).find(
        (item) => String(item.id || '') === String(optionId)
      );

      const basePayload = {
        sessionId,
        questionId: normalizedQuestionId,
        questionSequence: sequence,
        currentQuestion: {
          id: normalizedQuestionId,
          questionId: normalizedQuestionId,
          sequence,
        },
        prompt: String(activeQuestion.text || '').trim(),
        type: String(activeQuestion.type || '').toLowerCase(),
        trait:
          activeQuestion.trait || activeQuestion.traitTarget || activeQuestion.traitFocus || '',
        category: activeQuestion.category || '',
        plannerCategory: activeQuestion.plannerCategory || activeQuestion.category || '',
        stage: activeQuestion.stage || '',
        answerTimeMs: elapsedTimeMs(),
      };

      if (activeQuestion.type === 'likert') {
        return {
          ...basePayload,
          value: likertValue,
          answer: {
            value: likertValue,
            normalizedScore: likertValue,
          },
        };
      }

      if (activeQuestion.type === 'scale') {
        return {
          ...basePayload,
          value: scaleValue,
          answer: {
            value: scaleValue,
          },
        };
      }

      if (activeQuestion.type === 'mcq') {
        return {
          ...basePayload,
          optionId,
          optionLabel: selectedOption?.label || '',
          answer: {
            optionId,
            optionLabel: selectedOption?.label || '',
            normalizedScore: Number(selectedOption?.weight || 3),
          },
        };
      }

      if (activeQuestion.type === 'text') {
        return {
          ...basePayload,
          text: textValue.trim(),
          example: exampleValue.trim(),
          answer: {
            text: textValue.trim(),
            example: exampleValue.trim(),
          },
        };
      }

      if (activeQuestion.type === 'scenario') {
        return {
          ...basePayload,
          optionId,
          optionLabel: selectedOption?.label || '',
          text: textValue.trim(),
          example: exampleValue.trim(),
          answer: {
            optionId,
            optionLabel: selectedOption?.label || '',
            text: textValue.trim(),
            example: exampleValue.trim(),
            normalizedScore: Number(selectedOption?.weight || 3),
          },
        };
      }

      return null;
    },
    [elapsedTimeMs, exampleValue, likertValue, optionId, scaleValue, sessionId, textValue]
  );

  const submitAnswer = useCallback(
    async () => {
      if (!questionRef.current) {
        return;
      }

      if (!canSubmit) {
        setFeedback('Complete the required response fields before continuing.');
        return;
      }

      setFeedback('');
      setStatusNote('');

      try {
        const submissionPayload = buildPayload();
        if (!submissionPayload) {
          return;
        }

        const payload = await answerMutation.mutateAsync({
          sessionId,
          payload: submissionPayload,
        });

        if (payload.completedAssessment) {
          saveAssessmentFlowState(auth.userId, {
            sessionId,
            stage: 'result',
          });
          navigate(`/assessment/result?session=${sessionId}`);
          return;
        }

        if (payload.completedQuestionnaire) {
          if (payload.session?.stage === 'behavior') {
            navigate(`/assessment/behavior?session=${sessionId}`);
            return;
          }

          navigate(`/assessment/result?session=${sessionId}`);
          return;
        }

        if (payload.refiningProfile && payload.refiningMessage) {
          setStatusNote(payload.refiningMessage);
          return;
        }
      } catch (error) {
        setFeedback(error.message || 'Unable to save answer. Please retry.');
      }
    },
    [auth.userId, answerMutation, buildPayload, canSubmit, navigate, sessionId]
  );

  const goToPrevious = useCallback(async () => {
    if (!sessionId || previousMutation.isPending) {
      return;
    }

    setFeedback('');
    setStatusNote('');

    try {
      await previousMutation.mutateAsync(sessionId);
    } catch (error) {
      setFeedback(error.message || 'Unable to load previous question.');
    }
  }, [previousMutation, sessionId]);

  const liveTraitPreview = useMemo(() => {
    const traits = {
      O: 50,
      C: 50,
      E: 50,
      A: 50,
      N: 50,
    };

    const counters = {
      O: 1,
      C: 1,
      E: 1,
      A: 1,
      N: 1,
    };

    const answers = Array.isArray(questionQuery.data?.session?.answers)
      ? questionQuery.data.session.answers
      : [];

    answers.forEach((entry) => {
      const token = toTraitToken(entry?.metadata?.traitTarget || entry?.metadata?.trait || 'O');
      traits[token] += normalizeAnswerScore(entry);
      counters[token] += 1;
    });

    if (question) {
      const currentToken = toTraitToken(question.traitTarget || question.traitFocus || question.trait || 'O');
      const currentScore = inferCurrentScore({
        question,
        likertValue,
        scaleValue,
        optionId,
        textValue,
      });
      traits[currentToken] += currentScore;
      counters[currentToken] += 1;
    }

    return Object.fromEntries(
      Object.keys(traits).map((token) => [token, Math.round(traits[token] / counters[token])])
    );
  }, [likertValue, optionId, question, questionQuery.data?.session?.answers, scaleValue, textValue]);

  useEffect(() => {
    radarTweenRef.current?.kill();

    const tweenState = {
      ...radarStateRef.current,
    };

    radarTweenRef.current = gsap.to(tweenState, {
      O: liveTraitPreview.O,
      C: liveTraitPreview.C,
      E: liveTraitPreview.E,
      A: liveTraitPreview.A,
      N: liveTraitPreview.N,
      duration: prefersReducedMotion ? 0 : 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        const next = {
          O: Math.round(tweenState.O),
          C: Math.round(tweenState.C),
          E: Math.round(tweenState.E),
          A: Math.round(tweenState.A),
          N: Math.round(tweenState.N),
        };
        radarStateRef.current = next;
        setAnimatedTraitPreview(next);
      },
    });

    return () => radarTweenRef.current?.kill();
  }, [liveTraitPreview, prefersReducedMotion]);

  const isResultGenerationPending =
    answerMutation.isPending &&
    Boolean(question) &&
    Number(question.sequence || question.index + 1 || 1) >= Number(question.total || 1);

  if (questionQuery.isPending) {
    return (
      <main className="app-page assessment-page phase4-question-page">
        <div className="page-shell assessment-shell">
          <Card title="Loading adaptive interview" subtitle="AI is preparing your next question frame.">
            <Loader label="AI is mapping your next adaptive question..." variant="question" />
            <Skeleton height="24px" />
            <Skeleton height="78px" />
            <Skeleton height="42px" count={2} />
          </Card>
        </div>
      </main>
    );
  }

  if (!question || questionQuery.isError) {
    return (
      <main className="app-page assessment-page phase4-question-page">
        <div className="page-shell assessment-shell">
          <Card title="Unable to load question">
            <p className="ui-message ui-message--error">
              {questionQuery.error?.message || 'Question session is unavailable.'}
            </p>
            <Button onClick={() => navigate('/assessment/start')}>Back to Start</Button>
          </Card>
        </div>
      </main>
    );
  }

  const normalizedStage = normalizeStage(question.stage || 'personality');

  return (
    <main className="app-page assessment-page phase4-question-page">
      <LoaderOverlay
        visible={isResultGenerationPending}
        message="Building your personality profile..."
      />
      <div className="page-shell assessment-shell phase4-question-shell">
        <header className="page-header phase3-question-header">
          <div>
            <p className="page-header__eyebrow">{STAGE_LABELS[normalizedStage]}</p>
            <h1 className="page-header__title">{question.stageHeader || STAGE_LABELS[normalizedStage]}</h1>
            <p className="page-header__subtitle">
              Question {question.sequence || question.index + 1} of {question.total}
            </p>
          </div>
          <div className="assessment-header-actions">
            <Button variant="ghost" onClick={() => navigate('/assessment/start')}>
              Exit
            </Button>
          </div>
        </header>

        <div className="assessment-progress-wrap">
          <div className="assessment-progress phase3-progress" aria-label="Question progress">
            <div className="assessment-progress__bar" ref={progressBarRef} />
            <div className="assessment-progress__glow" />
          </div>
          <p className="assessment-progress__text">
            {progress}% complete {questionQuery.data?.session?.adaptiveMetrics?.fatigueDetected ? '· Quick mode on' : ''}
          </p>
        </div>

        <div className="phase4-question-layout">
          <div className="question-card-motion" ref={questionCardRef} data-scroll-reveal>
            <Card
              animated={false}
              className="question-card phase3-question-card phase4-question-card"
              title={STAGE_LABELS[normalizedStage]}
              subtitle={question.uiHint || 'Respond based on real behavior in realistic work contexts.'}
            >
              <div className="phase3-question-badges">
                <span className="phase3-badge">
                  <FiBarChart2 /> {String(question.category || 'general').replace(/_/g, ' ')}
                </span>
                <span className="phase3-badge">
                  <FiCircle /> {toTraitLabel(question)}
                </span>
                <span className="phase3-badge">
                  <FiArrowRight /> {String(question.difficulty || 'medium').toUpperCase()}
                </span>
              </div>

              <h3 className="question-card__text phase3-question-text">{question.text}</h3>

              <QuestionRenderer
                question={question}
                likertValue={likertValue}
                onLikertChange={setLikertValue}
                optionId={optionId}
                onOptionChange={setOptionId}
                scaleValue={scaleValue}
                onScaleChange={setScaleValue}
                textValue={textValue}
                onTextChange={setTextValue}
                exampleValue={exampleValue}
                onExampleChange={setExampleValue}
              />

              {statusNote ? <p className="ui-message">{statusNote}</p> : null}
              {feedback ? <p className="ui-message ui-message--error">{feedback}</p> : null}

              <div className="question-card__actions phase3-question-actions">
                <Button
                  variant="ghost"
                  onClick={goToPrevious}
                  loading={previousMutation.isPending}
                  disabled={
                    previousMutation.isPending ||
                    answerMutation.isPending ||
                    Number(question.sequence || 1) <= 1
                  }
                >
                  <FiArrowLeft /> Previous
                </Button>
                <Button onClick={submitAnswer} loading={answerMutation.isPending} disabled={!canSubmit}>
                  Next <FiArrowRight />
                </Button>
              </div>
            </Card>
          </div>

          <div className="phase4-question-side" data-scroll-reveal ref={sidePanelRef}>
            <QuestionVisualPanel question={question} />
            <Card
              animated={false}
              className="phase4-live-radar-card"
              title="Live Trait Preview"
              subtitle="Your trait radar updates while you answer."
            >
              <TraitRadarChart traits={animatedTraitPreview} compact height={220} />
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AdaptiveAssessmentTestPage;
