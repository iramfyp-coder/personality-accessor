import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const Loader = ({ label = 'Loading...', variant = 'default' }) => {
  const dotsRef = useRef([]);

  useEffect(() => {
    const targets = dotsRef.current.filter(Boolean);
    if (!targets.length) {
      return () => {};
    }

    const tween = gsap.to(targets, {
      y: -5,
      opacity: 1,
      stagger: 0.12,
      repeat: -1,
      yoyo: true,
      duration: 0.42,
      ease: 'power2.inOut',
    });

    return () => tween.kill();
  }, []);

  return (
    <div className={`ui-loader ui-loader--${variant}`} role="status" aria-live="polite">
      <span className="ui-loader__bar" aria-hidden="true">
        <span
          className="ui-loader__dot"
          ref={(node) => {
            dotsRef.current[0] = node;
          }}
        />
        <span
          className="ui-loader__dot"
          ref={(node) => {
            dotsRef.current[1] = node;
          }}
        />
        <span
          className="ui-loader__dot"
          ref={(node) => {
            dotsRef.current[2] = node;
          }}
        />
      </span>
      <span>{label}</span>
    </div>
  );
};

export default Loader;
