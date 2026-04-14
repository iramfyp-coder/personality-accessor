import tokens, { traitColors } from './tokens';

const colors = {
  background: tokens.background,
  text: tokens.text,
  border: {
    soft: 'rgba(148, 163, 200, 0.28)',
    strong: 'rgba(148, 163, 200, 0.48)',
  },
  primary: tokens.accent.blue,
  primaryStrong: tokens.accent.blueHover,
  accent: tokens.accent.cyan,
  success: tokens.state.success,
  warning: tokens.accent.amber,
  error: tokens.state.error,
};

export { traitColors };
export default colors;
