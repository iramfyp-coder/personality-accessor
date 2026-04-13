import { traitColors } from './colors';

const gradients = {
  primary: 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 52%, #22D3EE 100%)',
  secondary: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
  background: 'radial-gradient(circle at 18% 10%, #1D2A46 0%, #0B0F1A 45%, #090C14 100%)',
  card: 'linear-gradient(150deg, rgba(29, 78, 216, 0.22) 0%, rgba(16, 23, 39, 0.9) 48%, rgba(124, 58, 237, 0.2) 100%)',
  progress: 'linear-gradient(90deg, #22D3EE 0%, #3B82F6 50%, #A855F7 100%)',
};

export const traitGradients = {
  O: `linear-gradient(130deg, ${traitColors.O} 0%, #7C3AED 100%)`,
  C: `linear-gradient(130deg, ${traitColors.C} 0%, #0EA5E9 100%)`,
  E: `linear-gradient(130deg, ${traitColors.E} 0%, #F97316 100%)`,
  A: `linear-gradient(130deg, ${traitColors.A} 0%, #14B8A6 100%)`,
  N: `linear-gradient(130deg, ${traitColors.N} 0%, #F97316 100%)`,
};

export default gradients;
