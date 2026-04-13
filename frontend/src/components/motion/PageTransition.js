import React, { useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const toNamespace = (pathname = '') => {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/assessment/test')) return 'assessment';
  if (pathname.startsWith('/assessment/behavior')) return 'assessment';
  if (pathname.startsWith('/assessment/start')) return 'assessment';
  if (pathname.startsWith('/assessment/result')) return 'result';
  if (pathname.startsWith('/assessment/chat')) return 'chat';
  if (pathname.startsWith('/result/')) return 'result';
  return 'default';
};

const toTransitionMode = ({ from, to }) => {
  if (to === 'result' || to === 'chat') {
    return 'blur';
  }

  if (from === 'dashboard' && to === 'assessment') {
    return 'slide';
  }

  if (from === 'assessment' && to === 'dashboard') {
    return 'slideBack';
  }

  return 'fade';
};

const MODE_VARIANTS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 36, scale: 0.988 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -30, scale: 0.994 },
  },
  slideBack: {
    initial: { opacity: 0, x: -36, scale: 0.988 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 30, scale: 0.994 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(12px)', scale: 0.985, y: 14 },
    animate: { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 },
    exit: { opacity: 0, filter: 'blur(10px)', scale: 0.99, y: -10 },
  },
};

const PageTransition = ({ children, className = '' }) => {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const previousNamespaceRef = useRef(toNamespace(location.pathname));

  const currentNamespace = useMemo(() => toNamespace(location.pathname), [location.pathname]);
  const transitionMode = useMemo(
    () =>
      toTransitionMode({
        from: previousNamespaceRef.current,
        to: currentNamespace,
      }),
    [currentNamespace]
  );

  previousNamespaceRef.current = currentNamespace;

  const variants = prefersReducedMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      }
    : MODE_VARIANTS[transitionMode] || MODE_VARIANTS.fade;

  return (
    <motion.div
      className={`${className} barba-container`.trim()}
      data-barba="container"
      data-barba-namespace={currentNamespace}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
