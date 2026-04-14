import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiActivity, FiCompass, FiGrid, FiHeart, FiZap } from 'react-icons/fi';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import FadeIn from '../../components/motion/FadeIn';
import SlideUp from '../../components/motion/SlideUp';
import ScaleIn from '../../components/motion/ScaleIn';
import QuestionGuideCharacter from '../../components/assistant/QuestionGuideCharacter';
import {
  useActiveSessionQuery,
  useQuestionsQuery,
  useSaveAssessmentMutation,
  useStartSessionMutation,
  useSyncSessionMutation,
  toAnswerMap,
  toAnswerPayload,
} from '../../hooks/useAssessment';
import { useAuth } from '../../hooks/useAuth';
import {
  clearAssessmentDraft,
  persistAssessmentDraft,
  readAssessmentDraft,
} from '../../utils/assessmentSessionStorage';

const SCALE_OPTIONS = [
  { label: 'Strongly Disagree', value: 1 },
  { label: 'Disagree', value: 2 },
  { label: 'Neutral', value: 3 },
  { label: 'Agree', value: 4 },
  { label: 'Strongly Agree', value: 5 },
];

const QUESTION_TRAIT_META = {
  O: {
    key: 'O',
    name: 'Openness',
    icon: FiCompass,
    prompt: 'Curiosity and imagination focus',
  },
  C: {
    key: 'C',
    name: 'Conscientiousness',
    icon: FiGrid,
    prompt: 'Planning and discipline focus',
  },
  E: {
    key: 'E',
    name: 'Extraversion',
    icon: FiZap,
    prompt: 'Energy and social expression focus',
  },
  A: {
    key: 'A',
    name: 'Agreeableness',
    icon: FiHeart,
    prompt: 'Empathy and cooperation focus',
  },
  N: {
    key: 'N',
    name: 'Neuroticism',
    icon: FiActivity,
    prompt: 'Stress-response and stability focus',
  },
};

const findTraitKey = (question) => {
  const candidate = `${question?.domain || ''} ${question?.facetName || ''}`.toUpperCase();

  if (candidate.includes('OPEN') || /\bO\b/.test(candidate)) {
    return 'O';
  }

  if (candidate.includes('CONSC') || /\bC\b/.test(candidate)) {
    return 'C';
  }

  if (candidate.includes('EXTRAV') || /\bE\b/.test(candidate)) {
    return 'E';
  }

  if (candidate.includes('AGREE') || /\bA\b/.test(candidate)) {
    return 'A';
  }

  if (candidate.includes('NEURO') || /\bN\b/.test(candidate)) {
    return 'N';
  }

  return 'O';
};

const AssessmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'new';
  const prefersReducedMotion = useReducedMotion();

  const auth = useAuth();
  const questionsQuery = useQuestionsQuery();
  const startSessionMutation = useStartSessionMutation();
  const syncSessionMutation = useSyncSessionMutation();
  const saveMutation = useSaveAssessmentMutation();
  const activeSessionQuery = useActiveSessionQuery(
    auth.userId,
    mode === 'resume' && Boolean(auth.userId)
  );

  const [sessionId, setSessionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [initError, setInitError] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [selectionSignal, setSelectionSignal] = useState(0);

  const autoAdvanceTimeoutRef = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!questionsQuery.data?.length || !auth.userId || isInitialized.current) {
      return;
    }

    if (mode === 'resume' && activeSessionQuery.isPending) {
      return;
    }

    const initializeSession = async () => {
      isInitialized.current = true;
      setInitError('');

      const localDraft = readAssessmentDraft(auth.userId);

      if (mode === 'resume') {
        const serverSession = activeSessionQuery.data;

        if (serverSession?.sessionId) {
          const serverAnswers = toAnswerMap(serverSession.answers || []);
          const resumedIndex = Number(
            serverSession.currentQuestionIndex || Object.keys(serverAnswers).length || 0
          );

          setSessionId(serverSession.sessionId);
          setAnswers(serverAnswers);
          setCurrentIndex(resumedIndex);
          setStartedAt(serverSession.startedAt || new Date().toISOString());
          setFeedback('Resumed active server session.');

          persistAssessmentDraft(auth.userId, {
            sessionId: serverSession.sessionId,
            answers: serverAnswers,
            currentIndex: resumedIndex,
            startedAt: serverSession.startedAt || new Date().toISOString(),
          });

          return;
        }

        if (localDraft?.sessionId || Object.keys(localDraft?.answers || {}).length > 0) {
          setSessionId(localDraft.sessionId || null);
          setAnswers(localDraft.answers || {});
          setCurrentIndex(Number(localDraft.currentIndex || 0));
          setStartedAt(localDraft.startedAt || new Date().toISOString());
          setFeedback('No server session found. Resumed local draft.');
          return;
        }
      }

      if (mode !== 'resume' && localDraft) {
        clearAssessmentDraft(auth.userId);
      }

      try {
        const session = await startSessionMutation.mutateAsync();
        const nextStartedAt = session.startedAt || new Date().toISOString();

        setSessionId(session.sessionId || null);
        setStartedAt(nextStartedAt);
        setAnswers({});
        setCurrentIndex(0);
        setFeedback(
          mode === 'resume' ? 'No draft found. Started a new assessment.' : ''
        );

        persistAssessmentDraft(auth.userId, {
          sessionId: session.sessionId || null,
          answers: {},
          currentIndex: 0,
          startedAt: nextStartedAt,
        });
      } catch (error) {
        setInitError(error.message || 'Unable to start assessment session.');
      }
    };

    initializeSession();
  }, [
    auth.userId,
    mode,
    questionsQuery.data,
    startSessionMutation,
    activeSessionQuery.data,
    activeSessionQuery.isPending,
  ]);

  useEffect(() => {
    if (!auth.userId || !isInitialized.current || !questionsQuery.data?.length) {
      return;
    }

    persistAssessmentDraft(auth.userId, {
      sessionId,
      answers,
      currentIndex,
      startedAt,
    });
  }, [answers, auth.userId, currentIndex, questionsQuery.data, sessionId, startedAt]);

  useEffect(() => {
    if (!sessionId || !isInitialized.current) {
      return;
    }

    const syncTimeout = setTimeout(() => {
      syncSessionMutation.mutate({
        sessionId,
        answers: toAnswerPayload(answers),
      });
    }, 400);

    return () => {
      clearTimeout(syncTimeout);
    };
  }, [answers, sessionId, syncSessionMutation]);

  const totalQuestions = questionsQuery.data?.length || 0;
  const currentQuestion = questionsQuery.data?.[currentIndex];
  const isCompleted = currentIndex >= totalQuestions && totalQuestions > 0;
  const answeredCount = Math.min(Object.keys(answers).length, totalQuestions);
  const progress = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;

  const canSubmit = useMemo(
    () => Object.keys(answers).length === totalQuestions,
    [answers, totalQuestions]
  );

  const currentTraitKey = useMemo(
    () => findTraitKey(currentQuestion),
    [currentQuestion]
  );

  const traitMeta = QUESTION_TRAIT_META[currentTraitKey] || QUESTION_TRAIT_META.O;
  const TraitIcon = traitMeta.icon;

  const currentAnswer = currentQuestion ? answers[currentQuestion._id] : null;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions));
  }, [totalQuestions]);

  const handleSelectAnswer = useCallback(
    (value) => {
      if (!currentQuestion) {
        return;
      }

      setFeedback('');
      setSelectionSignal(Date.now());

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion._id]: value,
      }));

      if (!autoAdvance) {
        return;
      }

      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }

      autoAdvanceTimeoutRef.current = setTimeout(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions));
      }, prefersReducedMotion ? 0 : 210);
    },
    [autoAdvance, currentQuestion, prefersReducedMotion, totalQuestions]
  );

  const handleBack = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSaveAndExit = async () => {
    try {
      if (sessionId) {
        await syncSessionMutation.mutateAsync({
          sessionId,
          answers: toAnswerPayload(answers),
        });
      }
      navigate('/dashboard');
    } catch (error) {
      setFeedback(error.message || 'Unable to sync session. Please try again.');
    }
  };

  const handleSubmit = async () => {
    setFeedback('');

    if (!canSubmit) {
      setFeedback('Please answer all questions before submitting.');
      return;
    }

    try {
      const payload = await saveMutation.mutateAsync({
        answers: toAnswerPayload(answers),
        sessionId,
      });

      clearAssessmentDraft(auth.userId);
      navigate(`/result/${payload.assessmentId}`, {
        state: {
          result: payload.result,
        },
      });
    } catch (error) {
      setFeedback(error.message || 'Failed to submit assessment.');
    }
  };

  useEffect(() => {
    if (!currentQuestion || isCompleted) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      const targetTag = String(event.target?.tagName || '').toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        handleSelectAnswer(Number(event.key));
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleBack();
        return;
      }

      if ((event.key === 'ArrowRight' || event.key === 'Enter') && !autoAdvance && currentAnswer) {
        event.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [autoAdvance, currentAnswer, currentQuestion, handleBack, handleNext, handleSelectAnswer, isCompleted]);

  if (
    questionsQuery.isPending ||
    (mode === 'resume' && activeSessionQuery.isPending) ||
    (!isInitialized.current && !initError)
  ) {
    return (
      <main className="app-page assessment-page">
        <div className="page-shell">
          <Card title="Loading assessment" subtitle="Preparing your immersive session">
            <Skeleton width="40%" />
            <Skeleton height="120px" />
            <Skeleton height="52px" count={2} />
          </Card>
        </div>
      </main>
    );
  }

  if (questionsQuery.isError || initError) {
    return (
      <main className="app-page assessment-page">
        <div className="page-shell">
          <Card title="Unable to load assessment">
            <p className="ui-message ui-message--error">
              {questionsQuery.error?.message || initError}
            </p>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page assessment-page">
      <div className="page-shell assessment-shell">
        <FadeIn as="header" className="page-header">
          <div>
            <p className="page-header__eyebrow">Assessment Session</p>
            <h1 className="page-header__title">Big Five Personality Experience</h1>
            <p className="page-header__subtitle">
              Answer each prompt honestly. Your profile updates in real time as you progress.
            </p>
          </div>
          <div className="assessment-header-actions">
            <Button variant="ghost" onClick={handleSaveAndExit}>
              Save & Exit
            </Button>
          </div>
        </FadeIn>

        <ScaleIn className="assessment-progress-wrap">
          <div className="assessment-progress" aria-label="Assessment progress">
            <motion.div
              className="assessment-progress__bar"
              animate={{ width: `${progress}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 130, damping: 22 }
              }
            />
            <motion.div
              className="assessment-progress__glow"
              animate={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      x: ['-20%', '110%'],
                      opacity: [0, 0.85, 0],
                    }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: 2.7,
                      repeat: Infinity,
                      ease: 'linear',
                    }
              }
            />
          </div>
          <p className="assessment-progress__text">{answeredCount} / {totalQuestions} answered</p>
        </ScaleIn>

        <SlideUp className="assessment-toolbar" delay={0.05}>
          <label className="assessment-toggle" htmlFor="auto-advance-toggle">
            <input
              id="auto-advance-toggle"
              type="checkbox"
              checked={autoAdvance}
              onChange={(event) => setAutoAdvance(event.target.checked)}
            />
            <span>Auto-advance after selection</span>
          </label>

          <p className="assessment-shortcuts-inline">
            Keyboard: <kbd>1-5</kbd> answer, <kbd>←</kbd> previous,
            {!autoAdvance && (
              <>
                {' '}
                <kbd>→</kbd> / <kbd>Enter</kbd> next
              </>
            )}
          </p>
        </SlideUp>

        {feedback && (
          <p className={canSubmit ? 'ui-message ui-message--success' : 'ui-message ui-message--neutral'}>
            {feedback}
          </p>
        )}

        <div className="assessment-experience">
          <div className="assessment-experience__main">
            <AnimatePresence mode="wait" initial={false}>
              {!isCompleted && currentQuestion && (
                <motion.div
                  key={currentQuestion._id || currentIndex}
                  className={`question-card-motion trait-theme--${currentTraitKey.toLowerCase()}`}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 56, scale: 0.97 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -56, scale: 0.98 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.45,
                          ease: [0.16, 1, 0.3, 1],
                        }
                  }
                >
                  <Card
                    animated={false}
                    title={`Question ${currentIndex + 1}`}
                    subtitle={`Domain: ${currentQuestion.domain} · Facet: ${currentQuestion.facetName}`}
                    className={`question-card question-card--${currentTraitKey.toLowerCase()}`}
                  >
                    <div className="question-card__hero">
                      <div className="question-card__trait-meta">
                        <span className="question-card__trait-icon" aria-hidden="true">
                          <TraitIcon />
                        </span>
                        <div>
                          <p className="question-card__trait-title">{traitMeta.name}</p>
                          <p className="question-card__trait-prompt">{traitMeta.prompt}</p>
                        </div>
                      </div>

                    </div>

                    <p className="question-card__text">{currentQuestion.text}</p>

                    <div className="scale-options" role="radiogroup" aria-label="Answer scale">
                      {SCALE_OPTIONS.map((option) => {
                        const isSelected = answers[currentQuestion._id] === option.value;

                        return (
                          <motion.button
                            key={option.value}
                            className={`scale-option ${isSelected ? 'scale-option--active' : ''}`}
                            type="button"
                            onClick={() => handleSelectAnswer(option.value)}
                            whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -3 }}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                            animate={
                              isSelected && !prefersReducedMotion
                                ? {
                                    boxShadow: [
                                      '0 0 0 rgba(34, 211, 238, 0)',
                                      '0 0 22px rgba(34, 211, 238, 0.4)',
                                      '0 0 0 rgba(34, 211, 238, 0)',
                                    ],
                                  }
                                : undefined
                            }
                            transition={{ duration: 0.48 }}
                            aria-checked={isSelected}
                            role="radio"
                          >
                            <span className="scale-option__value">{option.value}</span>
                            <span className="scale-option__label">{option.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="question-card__actions">
                      <Button variant="ghost" onClick={handleBack} disabled={currentIndex === 0}>
                        Previous
                      </Button>

                      {!autoAdvance && (
                        <Button onClick={handleNext} disabled={!currentAnswer}>
                          {currentIndex === totalQuestions - 1 ? 'Finish' : 'Next'}
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )}

              {isCompleted && (
                <motion.div
                  key="completed"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.98 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -20, scale: 0.98 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.38 }}
                >
                  <Card
                    animated={false}
                    title="Ready to submit"
                    subtitle="All questions are complete"
                    className="question-card question-card--complete"
                  >
                    <p className="ui-message ui-message--success">
                      Your answers are complete and ready for report generation.
                    </p>
                    <div className="question-card__actions">
                      <Button variant="secondary" onClick={handleBack}>
                        Review Last Question
                      </Button>
                      <Button onClick={handleSubmit} loading={saveMutation.isPending}>
                        Submit Assessment
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="assessment-experience__side">
            <QuestionGuideCharacter
              trait={currentTraitKey}
              questionIndex={currentIndex}
              hasSelection={Boolean(currentAnswer)}
              selectionSignal={selectionSignal}
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default AssessmentPage;
