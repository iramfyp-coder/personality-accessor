import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const bubbleVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
  exit: { opacity: 0 },
};

const AvatarSpeechBubble = ({ message, visible, anchor, side = 'right' }) => {
  const position = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        x: 0,
        y: 0,
      };
    }

    const widthLimit = Math.min(320, Math.round(window.innerWidth * 0.38));
    const top = clamp((anchor?.y ?? 120) - 26, 12, window.innerHeight - 48);

    let left;
    if (side === 'left') {
      left = (anchor?.x ?? 120) + 18;
    } else {
      left = (anchor?.x ?? 120) - widthLimit - 18;
    }

    left = clamp(left, 10, window.innerWidth - widthLimit - 10);

    return {
      x: left,
      y: top,
    };
  }, [anchor?.x, anchor?.y, side]);

  return (
    <AnimatePresence>
      {visible && message ? (
        <motion.div
          key={message}
          className={`avatar-speech-bubble avatar-speech-bubble--${side === 'left' ? 'left' : 'right'}`}
          variants={bubbleVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          role="status"
          aria-live="polite"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default AvatarSpeechBubble;
