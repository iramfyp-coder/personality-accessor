import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const traitSpec = {
  O: {
    title: 'Creative pattern',
    accent: '#A855F7',
    background: 'linear-gradient(145deg, rgba(168, 85, 247, 0.4), rgba(30, 41, 76, 0.7))',
    renderer: () => (
      <>
        <circle cx="56" cy="56" r="18" fill="none" stroke="currentColor" strokeWidth="5" />
        <circle cx="80" cy="44" r="10" fill="none" stroke="currentColor" strokeOpacity="0.65" strokeWidth="4" />
        <path d="M28 86 C44 70, 62 102, 92 84" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  C: {
    title: 'Structured pattern',
    accent: '#3B82F6',
    background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.4), rgba(12, 33, 74, 0.72))',
    renderer: () => (
      <>
        <rect x="26" y="26" width="24" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="62" y="26" width="24" height="24" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="4" />
        <rect x="26" y="62" width="24" height="24" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="4" />
        <rect x="62" y="62" width="24" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
      </>
    ),
  },
  E: {
    title: 'Energetic pattern',
    accent: '#FACC15',
    background: 'linear-gradient(145deg, rgba(250, 204, 21, 0.32), rgba(58, 40, 10, 0.68))',
    renderer: () => (
      <>
        <circle cx="56" cy="56" r="12" fill="currentColor" fillOpacity="0.35" />
        <path d="M56 20v16M56 76v16M20 56h16M76 56h16M31 31l11 11M70 70l11 11M31 81l11-11M70 42l11-11" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  A: {
    title: 'Harmony pattern',
    accent: '#22C55E',
    background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.35), rgba(10, 52, 36, 0.72))',
    renderer: () => (
      <>
        <circle cx="34" cy="52" r="11" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="56" cy="34" r="11" fill="none" stroke="currentColor" strokeOpacity="0.8" strokeWidth="4" />
        <circle cx="78" cy="52" r="11" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M34 52h44M56 34l-22 18M56 34l22 18" stroke="currentColor" strokeOpacity="0.7" strokeWidth="3" />
      </>
    ),
  },
  N: {
    title: 'Wave pattern',
    accent: '#EF4444',
    background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.35), rgba(61, 19, 19, 0.72))',
    renderer: () => (
      <>
        <path d="M18 40 C30 24, 44 56, 56 40 C68 24, 82 56, 94 40" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M18 64 C30 48, 44 80, 56 64 C68 48, 82 80, 94 64" stroke="currentColor" strokeOpacity="0.72" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
  },
};

const QuestionTraitVisual = ({ trait = 'O' }) => {
  const prefersReducedMotion = useReducedMotion();
  const spec = traitSpec[trait] || traitSpec.O;

  return (
    <motion.div
      className="question-trait-visual"
      style={{
        '--trait-visual-bg': spec.background,
        '--trait-visual-accent': spec.accent,
      }}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              y: [0, -6, 0],
              rotate: [0, 1.5, 0, -1.5, 0],
            }
      }
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: 7,
              repeat: Infinity,
              ease: 'easeInOut',
            }
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 112 112" role="img" aria-label={spec.title}>
        {spec.renderer()}
      </svg>
    </motion.div>
  );
};

export default QuestionTraitVisual;
