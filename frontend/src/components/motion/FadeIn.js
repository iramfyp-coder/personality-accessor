import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const FadeIn = ({
  children,
  className = '',
  delay = 0,
  duration = 0.45,
  once = true,
  amount = 0.25,
  as = 'div',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as] || motion.div;

  return (
    <Component
      className={className}
      initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once, amount }}
      transition={{ duration: prefersReducedMotion ? 0 : duration, delay }}
    >
      {children}
    </Component>
  );
};

export default FadeIn;
