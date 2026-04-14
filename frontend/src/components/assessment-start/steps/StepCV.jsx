import React, { useRef } from 'react';
import { FiFileText, FiUploadCloud } from 'react-icons/fi';
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
  inputMode = 'cv',
  cvFile = null,
  onModeChange,
  onCvFileChange,
  manualProfile,
  onManualChange,
  onBack,
  onNext,
  isNextDisabled,
  isBusy,
  errorMessage,
}) => {
  const fileRef = useRef(null);

  return (
    <section className="assessment-step" aria-labelledby="wizard-cv-title">
      <header className="assessment-step__header">
        <p className="assessment-step__eyebrow">Step 2</p>
        <h2 id="wizard-cv-title" className="assessment-step__title">
          Upload CV or continue manually
        </h2>
        <p className="assessment-step__subtitle">
          Uploading your resume gives better context. You can also continue with manual profile input.
        </p>
      </header>

      <div className="wizard-mode-switch" role="tablist" aria-label="Input mode">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === 'cv'}
          className={`wizard-mode-switch__button ${inputMode === 'cv' ? 'is-active' : ''}`}
          onClick={() => onModeChange?.('cv')}
        >
          CV Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === 'manual'}
          className={`wizard-mode-switch__button ${inputMode === 'manual' ? 'is-active' : ''}`}
          onClick={() => onModeChange?.('manual')}
        >
          Manual Input
        </button>
      </div>

      {inputMode === 'cv' ? (
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
              disabled={isBusy}
            >
              <FiUploadCloud /> Upload Resume
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

          <p className="wizard-upload-divider">or continue manually</p>

          <Button variant="ghost" onClick={() => onModeChange?.('manual')} disabled={isBusy}>
            Switch to Manual Input
          </Button>
        </div>
      ) : (
        <div className="wizard-manual-pane">
          <div className="wizard-manual-grid">
            <label>
              <span>Field</span>
              <input
                className="ui-input"
                value={manualProfile.field}
                onChange={(event) => onManualChange?.('field', event.target.value)}
                placeholder="Computer Science"
              />
            </label>
            <label>
              <span>Subjects</span>
              <input
                className="ui-input"
                value={manualProfile.subjects}
                onChange={(event) => onManualChange?.('subjects', event.target.value)}
                placeholder="Math, Programming"
              />
            </label>
            <label>
              <span>Skills</span>
              <input
                className="ui-input"
                value={manualProfile.skills}
                onChange={(event) => onManualChange?.('skills', event.target.value)}
                placeholder="React, Python, SQL"
              />
            </label>
            <label>
              <span>Interests</span>
              <input
                className="ui-input"
                value={manualProfile.interests}
                onChange={(event) => onManualChange?.('interests', event.target.value)}
                placeholder="AI, Product, Analytics"
              />
            </label>
            <label>
              <span>Preferred careers</span>
              <input
                className="ui-input"
                value={manualProfile.preferredCareers}
                onChange={(event) => onManualChange?.('preferredCareers', event.target.value)}
                placeholder="Software Engineer, Data Analyst"
              />
            </label>
            <label>
              <span>Age</span>
              <input
                className="ui-input"
                type="number"
                min="10"
                max="90"
                value={manualProfile.age}
                onChange={(event) => onManualChange?.('age', event.target.value)}
                placeholder="22"
              />
            </label>
            <label className="wizard-manual-grid__full">
              <span>Gender</span>
              <input
                className="ui-input"
                value={manualProfile.gender}
                onChange={(event) => onManualChange?.('gender', event.target.value)}
                placeholder="female / male / non-binary"
              />
            </label>
          </div>
        </div>
      )}

      {errorMessage ? <p className="ui-message ui-message--error">{errorMessage}</p> : null}

      <footer className="assessment-step__actions">
        <Button variant="ghost" onClick={onBack} disabled={isBusy}>
          Back
        </Button>
        <Button onClick={onNext} disabled={isNextDisabled || isBusy} loading={isBusy}>
          Next
        </Button>
      </footer>
    </section>
  );
};

export default StepCV;
