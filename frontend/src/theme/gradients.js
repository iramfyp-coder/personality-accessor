import tokens, { traitColors } from './tokens';

const gradients = {
  primary: tokens.gradients.primaryButton,
  secondary: 'linear-gradient(135deg, #22D3EE 0%, #3B82F6 100%)',
  background: tokens.gradients.background,
  card: 'linear-gradient(150deg, rgba(59, 130, 246, 0.2) 0%, rgba(15, 23, 42, 0.9) 48%, rgba(139, 92, 246, 0.2) 100%)',
  progress: tokens.gradients.progress,
};

export const traitGradients = {
  O: `linear-gradient(130deg, ${traitColors.O} 0%, #7C3AED 100%)`,
  C: `linear-gradient(130deg, ${traitColors.C} 0%, #2563EB 100%)`,
  E: `linear-gradient(130deg, ${traitColors.E} 0%, #D97706 100%)`,
  A: `linear-gradient(130deg, ${traitColors.A} 0%, #16A34A 100%)`,
  N: `linear-gradient(130deg, ${traitColors.N} 0%, #DC2626 100%)`,
};

export default gradients;
