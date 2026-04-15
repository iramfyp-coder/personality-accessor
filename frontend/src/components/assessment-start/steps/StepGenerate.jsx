import React, { useEffect } from 'react';
import { FiCheckCircle, FiCircle, FiLoader } from 'react-icons/fi';
import Button from '../../ui/Button';
import { AVATAR_EVENTS, useAvatarEvents } from '../../avatar/AvatarEvents';

const StepGenerate = ({
  generationStatus,
  generationMessages,
  generationIndex,
  generationError,
  onBack,
  onRetry,
}) => {
  const isRunning = generationStatus === 'running';
  const isSuccess = generationStatus === 'success';
  const isError = generationStatus === 'error';
  const { emit } = useAvatarEvents();

  useEffect(() => {
    if (isRunning) {
      emit(AVATAR_EVENTS.AI_LOADING, {
        long: true,
        targetKey: 'start-assessment-cta',
      });
      return;
    }

    if (isSuccess) {
      emit(AVATAR_EVENTS.ASSESSMENT_COMPLETE, {
        targetKey: 'start-assessment-cta',
      });
    }
  }, [emit, isRunning, isSuccess]);

  return (
    <section className="assessment-step" aria-labelledby="wizard-generate-title">
      <header className="assessment-step__header">
        <p className="assessment-step__eyebrow">Step 4</p>
        <h2 id="wizard-generate-title" className="assessment-step__title">
          Generating assessment
        </h2>
        <p className="assessment-step__subtitle">
          We are preparing your adaptive questions. You will be redirected automatically.
        </p>
      </header>

      <div className="wizard-generate-shell">
        <div className="wizard-generate-shell__spinner" aria-hidden="true">
          <FiLoader />
        </div>

        <div className="wizard-generate-shell__timeline" role="status" aria-live="polite">
          {generationMessages.map((label, index) => {
            const isCompleted = isSuccess || index < generationIndex;
            const isActive = !isSuccess && !isError && index === generationIndex;

            return (
              <div
                key={label}
                className={`wizard-generate-shell__line ${
                  isCompleted ? 'is-complete' : isActive ? 'is-active' : ''
                }`}
              >
                <span className="wizard-generate-shell__line-icon" aria-hidden="true">
                  {isCompleted ? <FiCheckCircle /> : isActive ? <FiLoader /> : <FiCircle />}
                </span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {isRunning ? <p className="wizard-generate-shell__hint">Building your personalized assessment...</p> : null}
        {isSuccess ? <p className="wizard-generate-shell__hint">Assessment ready. Starting now...</p> : null}
      </div>

      {isError ? (
        <div className="wizard-generate-error">
          <p className="ui-message ui-message--error">{generationError}</p>
          <footer className="assessment-step__actions">
            <Button
              variant="ghost"
              onClick={onBack}
              data-avatar-action="wizard-back-generate"
              data-avatar-target="start-assessment-cta"
            >
              Back
            </Button>
            <Button
              onClick={onRetry}
              data-avatar-action="wizard-retry-generate"
              data-avatar-target="start-assessment-cta"
              data-avatar-hint="Retry generation when your connection is stable."
            >
              Try Again
            </Button>
          </footer>
        </div>
      ) : null}
    </section>
  );
};

export default StepGenerate;
