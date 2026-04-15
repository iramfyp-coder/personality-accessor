import React, { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { FiCheckCircle } from 'react-icons/fi';
import StepRole from './steps/StepRole';
import StepCV from './steps/StepCV';
import StepProfile from './steps/StepProfile';
import {
  ROLE_OPTIONS,
  useAssessmentWizard,
  WIZARD_STEPS,
} from '../../hooks/useAssessmentWizard';

const PROGRESS_STEPS = [
  { id: WIZARD_STEPS.profileType, label: 'Profile Type' },
  { id: WIZARD_STEPS.cvAnalysis, label: 'Analyze CV' },
  { id: WIZARD_STEPS.startAssessment, label: 'Start' },
];

const AssessmentStartWizard = () => {
  const {
    currentStep,
    userRole,
    setUserRole,
    cvFile,
    setCvFile,
    parsedProfile,
    stepError,
    setStepError,
    analysisStatus,
    analysisMessages,
    analysisIndex,
    isBusy,
    isStarting,
    isUploading,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    goToPreviousStep,
    goToNextStep,
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
    if (currentStep === WIZARD_STEPS.profileType) {
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

    if (currentStep === WIZARD_STEPS.cvAnalysis) {
      return (
        <StepCV
          cvFile={cvFile}
          onCvFileChange={(file) => {
            setStepError('');
            setCvFile(file);
          }}
          onBack={goToPreviousStep}
          onAnalyze={goToNextStep}
          isAnalyzeDisabled={!isStep2Valid}
          isAnalyzing={isUploading}
          analysisStatus={analysisStatus}
          analysisMessages={analysisMessages}
          analysisIndex={analysisIndex}
          errorMessage={stepError}
        />
      );
    }

    return (
      <StepProfile
        parsedProfile={parsedProfile}
        onBack={goToPreviousStep}
        onStartAssessment={goToNextStep}
        isStartDisabled={!isStep3Valid}
        isStarting={isStarting}
        errorMessage={stepError}
      />
    );
  }, [
    currentStep,
    cvFile,
    analysisIndex,
    analysisMessages,
    analysisStatus,
    goToNextStep,
    goToPreviousStep,
    isBusy,
    isStarting,
    isUploading,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    parsedProfile,
    setCvFile,
    setStepError,
    setUserRole,
    stepError,
    userRole,
  ]);

  return (
    <main
      className="app-page phase4-start-page assessment-wizard-page"
      data-avatar-section="start-main"
      data-avatar-label="Assessment Setup"
    >
      <div className="page-shell assessment-wizard-shell">
        <section
          className="assessment-wizard-progress"
          aria-label="Assessment wizard progress"
          data-avatar-section="start-progress"
        >
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

        <section
          ref={stepShellRef}
          className="ui-card assessment-wizard-card"
          key={currentStep}
          data-avatar-section="start-step"
          data-avatar-target="start-assessment-cta"
        >
          {stepView}
        </section>
      </div>
    </main>
  );
};

export default AssessmentStartWizard;
