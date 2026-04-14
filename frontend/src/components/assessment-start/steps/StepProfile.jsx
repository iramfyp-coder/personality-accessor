import React from 'react';
import Button from '../../ui/Button';

const StepProfile = ({
  parsedProfile,
  onProfileChange,
  onBack,
  onGenerate,
  isGenerateDisabled,
  isGenerating,
  errorMessage,
}) => {
  return (
    <section className="assessment-step" aria-labelledby="wizard-confirm-title">
      <header className="assessment-step__header">
        <p className="assessment-step__eyebrow">Step 3</p>
        <h2 id="wizard-confirm-title" className="assessment-step__title">
          Profile confirmation
        </h2>
        <p className="assessment-step__subtitle">
          Review extracted profile details before generating assessment questions.
        </p>
      </header>

      <div className="wizard-confirm-grid">
        <label>
          <span>Field</span>
          <input
            className="ui-input"
            value={parsedProfile.field}
            onChange={(event) => onProfileChange?.('field', event.target.value)}
            placeholder="Field"
          />
        </label>
        <label>
          <span>Subjects</span>
          <input
            className="ui-input"
            value={parsedProfile.subjects}
            onChange={(event) => onProfileChange?.('subjects', event.target.value)}
            placeholder="Subjects"
          />
        </label>
        <label>
          <span>Skills</span>
          <input
            className="ui-input"
            value={parsedProfile.skills}
            onChange={(event) => onProfileChange?.('skills', event.target.value)}
            placeholder="Skills"
          />
        </label>
        <label>
          <span>Interests</span>
          <input
            className="ui-input"
            value={parsedProfile.interests}
            onChange={(event) => onProfileChange?.('interests', event.target.value)}
            placeholder="Interests"
          />
        </label>
        <label>
          <span>Preferred careers</span>
          <input
            className="ui-input"
            value={parsedProfile.preferredCareers}
            onChange={(event) => onProfileChange?.('preferredCareers', event.target.value)}
            placeholder="Preferred careers"
          />
        </label>
        <label>
          <span>Age</span>
          <input
            className="ui-input"
            type="number"
            min="10"
            max="90"
            value={parsedProfile.age}
            onChange={(event) => onProfileChange?.('age', event.target.value)}
            placeholder="Age"
          />
        </label>
        <label className="wizard-confirm-grid__full">
          <span>Gender</span>
          <input
            className="ui-input"
            value={parsedProfile.gender}
            onChange={(event) => onProfileChange?.('gender', event.target.value)}
            placeholder="Gender"
          />
        </label>
      </div>

      {errorMessage ? <p className="ui-message ui-message--error">{errorMessage}</p> : null}

      <footer className="assessment-step__actions">
        <Button variant="ghost" onClick={onBack} disabled={isGenerating}>
          Back
        </Button>
        <Button onClick={onGenerate} disabled={isGenerateDisabled || isGenerating} loading={isGenerating}>
          Generate Assessment
        </Button>
      </footer>
    </section>
  );
};

export default StepProfile;
