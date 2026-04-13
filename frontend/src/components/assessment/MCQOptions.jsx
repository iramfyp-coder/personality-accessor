import React, { useEffect, useRef } from 'react';
import { FiCheck } from 'react-icons/fi';
import { gsap } from 'gsap';

const MCQOptions = ({ options = [], selectedOptionId = '', onSelect }) => {
  const optionRefs = useRef({});

  useEffect(() => {
    options.forEach((option, index) => {
      const key = option.id || String(index);
      const element = optionRefs.current[key];

      if (!element) {
        return;
      }

      const isActive = selectedOptionId === key;
      gsap.to(element, {
        duration: 0.28,
        ease: 'power2.out',
        scale: isActive ? 1.02 : 1,
        boxShadow: isActive
          ? '0 0 0 1px rgba(61, 245, 255, 0.5), 0 14px 28px rgba(24, 173, 219, 0.22)'
          : '0 0 0 0 rgba(0,0,0,0)',
      });
    });
  }, [options, selectedOptionId]);

  return (
    <div className="adaptive-options-grid" role="radiogroup" aria-label="Multiple choice options">
      {options.map((option, index) => {
        const optionKey = option.id || String(index);
        const label = option.label || `Option ${index + 1}`;
        const code = option.id || String.fromCharCode(65 + index);
        const isActive = selectedOptionId === optionKey;

        return (
          <button
            key={optionKey}
            type="button"
            ref={(node) => {
              optionRefs.current[optionKey] = node;
            }}
            className={`adaptive-option-card ${isActive ? 'is-active' : ''}`}
            onMouseEnter={() => {
              const node = optionRefs.current[optionKey];
              if (!node || isActive) {
                return;
              }

              gsap.to(node, {
                y: -4,
                duration: 0.22,
                ease: 'power2.out',
              });
            }}
            onMouseLeave={() => {
              const node = optionRefs.current[optionKey];
              if (!node || isActive) {
                return;
              }

              gsap.to(node, {
                y: 0,
                duration: 0.2,
                ease: 'power2.out',
              });
            }}
            onClick={() => onSelect(optionKey)}
          >
            <span className="adaptive-option-card__icon" aria-hidden="true">
              {code}
            </span>
            <span className="adaptive-option-card__label">{label}</span>
            {isActive ? (
              <span className="adaptive-option-card__check" aria-hidden="true">
                <FiCheck />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default MCQOptions;
