import React, { useRef } from 'react';
import { FiCheckCircle, FiCircle, FiFileText, FiLoader, FiUploadCloud } from 'react-icons/fi';
import Button from '../../ui/Button';

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return '0 KB';
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const StepCV = ({
  cvFile = null,
  onCvFileChange,
  onBack,
  onAnalyze,
  isAnalyzeDisabled,
  isAnalyzing,
  analysisStatus = 'idle',
  analysisMessages = [],
  analysisIndex = 0,
  errorMessage,
}) => {
  const fileRef = useRef(null);

  return (
    <section className="assessment-step" aria-labelledby="wizard-cv-title">
      <header className="assessment-step__header">
        <p className="assessment-step__eyebrow">Step 2</p>
        <h2 id="wizard-cv-title" className="assessment-step__title">
          Upload CV and analyze profile
        </h2>
        <p className="assessment-step__subtitle">
          We will analyze your CV to detect field, skills, and interests before assessment starts.
        </p>
      </header>

      <div className="wizard-cv-pane">
        <div className="wizard-upload-box">
          <p className="wizard-upload-box__title">Upload CV</p>
          <p className="wizard-upload-box__subtitle">PDF, DOCX, or TXT</p>

          <input
            ref={fileRef}
            type="file"
            className="wizard-upload-box__input"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(event) => onCvFileChange?.(event.target.files?.[0] || null)}
          />

          <Button
            variant="primary"
            onClick={() => fileRef.current?.click()}
            disabled={isAnalyzing}
            data-avatar-action="upload-cv"
            data-avatar-target="start-assessment-cta"
            data-avatar-hint="Upload your CV to detect profile signals."
          >
            <FiUploadCloud /> Upload CV
          </Button>

          {cvFile ? (
            <div className="wizard-file-pill" role="status" aria-live="polite">
              <FiFileText aria-hidden="true" />
              <div>
                <strong>{cvFile.name}</strong>
                <small>{formatBytes(cvFile.size)}</small>
              </div>
            </div>
          ) : null}
        </div>

        {analysisStatus === 'running' || analysisStatus === 'success' ? (
          <div className="wizard-generate-shell">
            <div className="wizard-generate-shell__spinner" aria-hidden="true">
              {analysisStatus === 'success' ? <FiCheckCircle /> : <FiLoader />}
            </div>

            <div className="wizard-generate-shell__timeline" role="status" aria-live="polite">
              {analysisMessages.map((label, index) => {
                const isCompleted = analysisStatus === 'success' || index < analysisIndex;
                const isActive = analysisStatus === 'running' && index === analysisIndex;

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
          </div>
        ) : null}
      </div>

      {errorMessage ? <p className="ui-message ui-message--error">{errorMessage}</p> : null}

      <footer className="assessment-step__actions">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={isAnalyzing}
          data-avatar-action="wizard-back-cv"
          data-avatar-target="start-assessment-cta"
        >
          Back
        </Button>
        <Button
          onClick={onAnalyze}
          disabled={isAnalyzeDisabled || isAnalyzing}
          loading={isAnalyzing}
          data-avatar-action="wizard-analyze-cv"
          data-avatar-target="start-assessment-cta"
          data-avatar-hint="Analyze CV now."
        >
          Analyze CV
        </Button>
      </footer>
    </section>
  );
};

export default StepCV;
