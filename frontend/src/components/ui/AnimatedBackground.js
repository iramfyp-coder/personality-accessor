import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const blobAnimation = (duration, x, y) => ({
  x: [0, x, 0],
  y: [0, y, 0],
  transition: {
    duration,
    repeat: Infinity,
    repeatType: 'mirror',
    ease: 'easeInOut',
  },
});

const AnimatedBackground = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="animated-background" aria-hidden="true">
      <div className="animated-background__mesh" />

      <motion.div
        className="animated-background__blob animated-background__blob--one"
        animate={prefersReducedMotion ? undefined : blobAnimation(16, 40, -28)}
      />
      <motion.div
        className="animated-background__blob animated-background__blob--two"
        animate={prefersReducedMotion ? undefined : blobAnimation(20, -34, 42)}
      />
      <motion.div
        className="animated-background__blob animated-background__blob--three"
        animate={prefersReducedMotion ? undefined : blobAnimation(24, 22, 30)}
      />

      <div className="animated-background__vignette" />
    </div>
  );
};

export default AnimatedBackground;
