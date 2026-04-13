import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const LIKERT_OPTIONS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

const LikertScale = ({ value = 0, onChange }) => {
  const optionRefs = useRef({});

  useEffect(() => {
    LIKERT_OPTIONS.forEach((item) => {
      const node = optionRefs.current[item.value];
      if (!node) {
        return;
      }

      const isActive = value === item.value;
      gsap.to(node, {
        duration: 0.24,
        ease: 'power2.out',
        scale: isActive ? 1.03 : 1,
        boxShadow: isActive
          ? '0 0 0 1px rgba(83, 245, 255, 0.45), 0 14px 24px rgba(39, 142, 215, 0.25)'
          : '0 0 0 0 rgba(0,0,0,0)',
      });
    });
  }, [value]);

  return (
    <div className="scale-options scale-options--horizontal" role="radiogroup" aria-label="Likert answer">
      {LIKERT_OPTIONS.map((item) => (
        <button
          key={item.value}
          type="button"
          ref={(node) => {
            optionRefs.current[item.value] = node;
          }}
          className={`scale-option ${value === item.value ? 'scale-option--active' : ''}`}
          onMouseEnter={() => {
            if (value === item.value) {
              return;
            }

            const node = optionRefs.current[item.value];
            if (!node) {
              return;
            }

            gsap.to(node, {
              y: -3,
              duration: 0.2,
              ease: 'power2.out',
            });
          }}
          onMouseLeave={() => {
            if (value === item.value) {
              return;
            }

            const node = optionRefs.current[item.value];
            if (!node) {
              return;
            }

            gsap.to(node, {
              y: 0,
              duration: 0.2,
              ease: 'power2.out',
            });
          }}
          onClick={() => onChange(item.value)}
        >
          <span className="scale-option__value">{item.value}</span>
          <span className="scale-option__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default LikertScale;
