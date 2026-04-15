import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import {
  useAdaptiveQuestionQuery,
  useSubmitAdaptiveAnswerMutation,
} from '../../hooks/useAssessmentFlow';
import {
  readAssessmentFlowState,
  saveAssessmentFlowState,
} from '../../utils/assessmentFlowStorage';
import { AVATAR_EVENTS, useAvatarEvents } from '../../components/avatar/AvatarEvents';

const MIN_LENGTH = 40;

const BehaviorAssessmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  const sessionId =
    searchParams.get('session') || readAssessmentFlowState(auth.userId)?.sessionId || '';

  const questionQuery = useAdaptiveQuestionQuery(sessionId, Boolean(sessionId));
  const answerMutation = useSubmitAdaptiveAnswerMutation();
  const { emit } = useAvatarEvents();

  const prompt = questionQuery.data?.behaviorPrompt || null;
  const stage = questionQuery.data?.session?.stage || 'behavior';

  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!sessionId) {
      navigate('/assessment/start', { replace: true });
      return;
    }

    if (stage === 'questionnaire') {
      navigate(`/assessment/test?session=${sessionId}`, { replace: true });
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
    });
  }, [auth.userId, questionQuery.data, sessionId]);

  useEffect(() => {
    if (questionQuery.isPending || answerMutation.isPending) {
      emit(AVATAR_EVENTS.AI_LOADING, {
        long: true,
        targetKey: 'behavior-card',
      });
    }
  }, [answerMutation.isPending, emit, questionQuery.isPending]);

  const handleSubmit = async () => {
    if (!prompt) {
      return;
    }

    if (text.trim().length < MIN_LENGTH) {
      setErrorMessage(`Please write at least ${MIN_LENGTH} characters.`);
      return;
    }

    setErrorMessage('');

    try {
      const payload = await answerMutation.mutateAsync({
        sessionId,
        payload: {
          promptId: prompt.promptId,
          text: text.trim(),
        },
      });

      if (payload.completedAssessment) {
        emit(AVATAR_EVENTS.ASSESSMENT_COMPLETE, {
          progress: 100,
          targetKey: 'behavior-card',
        });
        saveAssessmentFlowState(auth.userId, {
          sessionId,
          stage: 'result',
        });
        navigate(`/assessment/result?session=${sessionId}`);
        return;
      }

      setText('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save behavior response.');
    }
  };

  if (questionQuery.isPending) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Loading behavior analysis section">
            <Skeleton height="24px" />
            <Skeleton height="100px" />
            <Skeleton height="160px" />
          </Card>
        </div>
      </main>
    );
  }

  if (!prompt || questionQuery.isError) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Behavior prompt unavailable">
            <p className="ui-message ui-message--error">
              {questionQuery.error?.message || 'No behavior prompt found for this session.'}
            </p>
            <Button onClick={() => navigate('/assessment/start')}>Back to Start</Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page" data-avatar-section="behavior-main">
      <div className="page-shell">
        <Card
          title="Behavioral Paragraph Analysis"
          subtitle={`Prompt ${prompt.index + 1} of ${prompt.total}`}
          className="behavior-card"
        >
          <div data-avatar-target="behavior-card" data-avatar-section="behavior-prompt">
            <p style={{ marginBottom: 12 }}>{prompt.prompt}</p>
          </div>
          <textarea
            className="ui-input"
            style={{ minHeight: 220, width: '100%' }}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              emit(AVATAR_EVENTS.INPUT_TYPING, { targetKey: 'behavior-card' });
            }}
            placeholder="Write a concrete example with context, action, and outcome."
          />
          <p className="ui-message ui-message--neutral">
            {text.trim().length} characters written. Minimum {MIN_LENGTH} required.
          </p>
          {errorMessage ? <p className="ui-message ui-message--error">{errorMessage}</p> : null}

          <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
            <Button
              onClick={handleSubmit}
              loading={answerMutation.isPending}
              data-avatar-action="behavior-submit"
              data-avatar-target="behavior-card"
              data-avatar-hint="Save your behavioral response and continue."
            >
              Save & Continue
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/assessment/start')}
              data-avatar-action="behavior-exit"
              data-avatar-target="behavior-card"
            >
              Exit
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default BehaviorAssessmentPage;
