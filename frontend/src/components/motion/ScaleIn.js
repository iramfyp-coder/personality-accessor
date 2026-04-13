import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const ScaleIn = ({
  children,
  className = '',
  delay = 0,
  duration = 0.45,
  from = 0.94,
  once = true,
  amount = 0.3,
  as = 'div',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as] || motion.div;

  return (
    <Component
      className={className}
      initial={{ opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : from }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once, amount }}
      transition={{ duration: prefersReducedMotion ? 0 : duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
};

export default ScaleIn;
