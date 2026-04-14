import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const LoaderOverlay = ({ visible = false, message = 'Loading...' }) => {
  const ringRefs = useRef([]);

  useEffect(() => {
    if (!visible) {
      return () => {};
    }

    const targets = ringRefs.current.filter(Boolean);
    if (!targets.length) {
      return () => {};
    }

    const tween = gsap.to(targets, {
      scale: 1.2,
      opacity: 0.25,
      repeat: -1,
      yoyo: true,
      stagger: 0.15,
      duration: 0.9,
      ease: 'sine.inOut',
    });

    return () => tween.kill();
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="loader-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loader-overlay__inner">
        <div className="loader-overlay__rings" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={`ring-${index}`}
              ref={(node) => {
                ringRefs.current[index] = node;
              }}
              className="loader-overlay__ring"
            />
          ))}
        </div>
        <p className="loader-overlay__message">{message}</p>
      </div>
    </div>
  );
};

export default LoaderOverlay;
