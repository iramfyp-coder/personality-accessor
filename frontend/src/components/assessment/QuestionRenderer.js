import React from 'react';
import LikertScale from './LikertScale';
import MCQOptions from './MCQOptions';
import SliderInput from './SliderInput';
import TextAnswer from './TextAnswer';

const QuestionRenderer = ({
  question,
  likertValue,
  onLikertChange,
  optionId,
  onOptionChange,
  scaleValue,
  onScaleChange,
  textValue,
  onTextChange,
  exampleValue,
  onExampleChange,
  onInteraction,
}) => {
  if (!question) {
    return null;
  }

  const type = String(question.type || '').toLowerCase();

  if (type === 'likert') {
    return (
      <LikertScale
        value={likertValue}
        onChange={(value) => {
          onLikertChange(value);
          onInteraction?.('likert', value);
        }}
      />
    );
  }

  if (type === 'mcq') {
    return (
      <MCQOptions
        options={question.options || []}
        selectedOptionId={optionId}
        onSelect={(value) => {
          onOptionChange(value);
          onInteraction?.('mcq', value);
        }}
      />
    );
  }

  if (type === 'scale') {
    return (
      <SliderInput
        value={scaleValue || question.scaleMin || 1}
        min={Number(question.scaleMin || 1)}
        max={Number(question.scaleMax || 10)}
        onChange={(value) => {
          onScaleChange(value);
          onInteraction?.('scale', value);
        }}
      />
    );
  }

  if (type === 'text') {
    return (
      <TextAnswer
        value={textValue}
        onChange={(value) => {
          onTextChange(value);
          onInteraction?.('text', value);
        }}
        exampleValue={exampleValue}
        onExampleChange={(value) => {
          onExampleChange(value);
          onInteraction?.('example', value);
        }}
        expectsExample={Boolean(question.expectsExample)}
        minLength={Number(question.expectedLength || 16)}
      />
    );
  }

  if (type === 'scenario') {
    const requiresNarrative = Number(question.expectedLength || 0) > 0;

    return (
      <>
        <MCQOptions
          options={question.options || []}
          selectedOptionId={optionId}
          onSelect={(value) => {
            onOptionChange(value);
            onInteraction?.('scenario_option', value);
          }}
        />
        {requiresNarrative ? (
          <TextAnswer
            value={textValue}
            onChange={(value) => {
              onTextChange(value);
              onInteraction?.('scenario_text', value);
            }}
            exampleValue={exampleValue}
            onExampleChange={(value) => {
              onExampleChange(value);
              onInteraction?.('scenario_example', value);
            }}
            expectsExample={Boolean(question.expectsExample)}
            minLength={Number(question.expectedLength || 16)}
          />
        ) : null}
      </>
    );
  }

  return null;
};

export default QuestionRenderer;
