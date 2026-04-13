import React from 'react';

const TextAnswer = ({
  value = '',
  onChange,
  exampleValue = '',
  onExampleChange,
  expectsExample = false,
  minLength = 16,
}) => {
  const charCount = value.trim().length;
  const placeholder =
    minLength >= 140
      ? 'Provide context, your decision, and measurable outcome'
      : 'Write a concise real-world response';

  return (
    <div className="adaptive-text-wrap">
      <textarea
        className={`ui-input adaptive-textarea ${minLength >= 140 ? 'adaptive-textarea--long' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />

      <p className="adaptive-text-count">
        {charCount} characters{charCount < minLength ? ` (min ${minLength})` : ''}
      </p>

      {expectsExample ? (
        <textarea
          className="ui-input adaptive-textarea adaptive-textarea--example"
          value={exampleValue}
          onChange={(event) => onExampleChange(event.target.value)}
          placeholder="Add one concrete example"
        />
      ) : null}
    </div>
  );
};

export default TextAnswer;
