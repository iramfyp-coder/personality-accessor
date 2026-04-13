import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const SlideUp = ({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
  distance = 20,
  once = true,
  amount = 0.2,
  as = 'div',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as] || motion.div;

  return (
    <Component
      className={className}
      initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: prefersReducedMotion ? 0 : duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
};

export default SlideUp;
