import React from 'react';

const SliderInput = ({ value = 0, min = 1, max = 10, onChange }) => {
  const numericValue = Number(value || min);

  return (
    <div className="slider-input-shell" role="group" aria-label="Scale slider">
      <div className="slider-input-head">
        <span>{min}</span>
        <strong>{numericValue}</strong>
        <span>{max}</span>
      </div>
      <input
        className="slider-input"
        type="range"
        min={min}
        max={max}
        step={1}
        value={numericValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p className="slider-input-caption">Move the slider from {min} (low) to {max} (high).</p>
    </div>
  );
};

export default SliderInput;
