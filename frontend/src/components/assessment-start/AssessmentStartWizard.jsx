import React, { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { FiCheckCircle } from 'react-icons/fi';
import StepRole from './steps/StepRole';
import StepCV from './steps/StepCV';
import StepProfile from './steps/StepProfile';
import StepGenerate from './steps/StepGenerate';
import {
  ROLE_OPTIONS,
  useAssessmentWizard,
  WIZARD_STEPS,
} from '../../hooks/useAssessmentWizard';

const PROGRESS_STEPS = [
  { id: WIZARD_STEPS.role, label: 'Role' },
  { id: WIZARD_STEPS.profileInput, label: 'Profile' },
  { id: WIZARD_STEPS.confirm, label: 'Confirm' },
  { id: WIZARD_STEPS.generate, label: 'Generate' },
];

const AssessmentStartWizard = () => {
  const {
    currentStep,
    userRole,
    setUserRole,
    cvFile,
    setCvFile,
    inputMode,
    setInputMode,
    manualProfile,
    updateManualProfile,
    parsedProfile,
    updateParsedProfile,
    stepError,
    setStepError,
    generationStatus,
    generationError,
    generationMessages,
    generationIndex,
    isBusy,
    isStarting,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    goToPreviousStep,
    goToNextStep,
    retryGeneration,
  } = useAssessmentWizard();

  const stepShellRef = useRef(null);

  useEffect(() => {
    if (!stepShellRef.current) {
      return () => {};
    }

    gsap.fromTo(
      stepShellRef.current,
      { autoAlpha: 0, y: 18, scale: 0.985 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.36, ease: 'power2.out' }
    );

    return () => {};
  }, [currentStep]);

  const progressPercent = useMemo(() => {
    const maxIndex = PROGRESS_STEPS.length - 1;
    const activeIndex = PROGRESS_STEPS.findIndex((step) => step.id === currentStep);

    if (activeIndex <= 0) {
      return 0;
    }

    return Math.round((activeIndex / maxIndex) * 100);
  }, [currentStep]);

  const stepView = useMemo(() => {
    if (currentStep === WIZARD_STEPS.role) {
      return (
        <StepRole
          roleOptions={ROLE_OPTIONS}
          selectedRole={userRole}
          onSelectRole={(role) => {
            setStepError('');
            setUserRole(role);
          }}
          onNext={goToNextStep}
          isNextDisabled={!isStep1Valid || isBusy}
        />
      );
    }

    if (currentStep === WIZARD_STEPS.profileInput) {
      return (
        <StepCV
          inputMode={inputMode}
          cvFile={cvFile}
          onModeChange={(mode) => {
            setStepError('');
            setInputMode(mode);
          }}
          onCvFileChange={(file) => {
            setStepError('');
            setCvFile(file);
          }}
          manualProfile={manualProfile}
          onManualChange={(key, value) => {
            setStepError('');
            updateManualProfile(key, value);
          }}
          onBack={goToPreviousStep}
          onNext={goToNextStep}
          isNextDisabled={!isStep2Valid}
          isBusy={isBusy}
          errorMessage={stepError}
        />
      );
    }

    if (currentStep === WIZARD_STEPS.confirm) {
      return (
        <StepProfile
          parsedProfile={parsedProfile}
          onProfileChange={(key, value) => {
            setStepError('');
            updateParsedProfile(key, value);
          }}
          onBack={goToPreviousStep}
          onGenerate={goToNextStep}
          isGenerateDisabled={!isStep3Valid}
          isGenerating={isStarting}
          errorMessage={stepError}
        />
      );
    }

    return (
      <StepGenerate
        generationStatus={generationStatus}
        generationMessages={generationMessages}
        generationIndex={generationIndex}
        generationError={generationError}
        onBack={goToPreviousStep}
        onRetry={retryGeneration}
      />
    );
  }, [
    currentStep,
    cvFile,
    generationError,
    generationIndex,
    generationMessages,
    generationStatus,
    goToNextStep,
    goToPreviousStep,
    inputMode,
    isBusy,
    isStarting,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    manualProfile,
    parsedProfile,
    retryGeneration,
    setCvFile,
    setInputMode,
    setStepError,
    setUserRole,
    stepError,
    updateManualProfile,
    updateParsedProfile,
    userRole,
  ]);

  return (
    <main className="app-page phase4-start-page assessment-wizard-page">
      <div className="page-shell assessment-wizard-shell">
        <section className="assessment-wizard-progress" aria-label="Assessment wizard progress">
          <div className="assessment-wizard-progress__track" aria-hidden="true">
            <div
              className="assessment-wizard-progress__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="assessment-wizard-progress__steps">
            {PROGRESS_STEPS.map((step, index) => {
              const isCompleted = step.id < currentStep;
              const isActive = step.id === currentStep;

              return (
                <div
                  key={step.id}
                  className={`assessment-wizard-progress__step ${
                    isCompleted ? 'is-complete' : isActive ? 'is-active' : ''
                  }`}
                >
                  <span className="assessment-wizard-progress__bullet" aria-hidden="true">
                    {isCompleted ? <FiCheckCircle /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section ref={stepShellRef} className="ui-card assessment-wizard-card" key={currentStep}>
          {stepView}
        </section>
      </div>
    </main>
  );
};

export default AssessmentStartWizard;
