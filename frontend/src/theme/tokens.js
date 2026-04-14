const tokens = {
  background: {
    base: '#060812',
    secondary: '#0B0F1D',
    surface: '#0F172A',
    elevated: '#111827',
    glass: 'rgba(15, 23, 42, 0.65)',
  },
  text: {
    primary: '#F8FAFF',
    secondary: '#CBD5F5',
    muted: '#94A3C8',
    disabled: '#64748B',
  },
  accent: {
    blue: '#3B82F6',
    blueHover: '#2563EB',
    blueGlow: '#60A5FA',
    cyan: '#22D3EE',
    purple: '#8B5CF6',
    amber: '#F59E0B',
  },
  state: {
    success: '#22C55E',
    error: '#EF4444',
  },
  chart: {
    trait1: '#22D3EE',
    trait2: '#3B82F6',
    trait3: '#8B5CF6',
    trait4: '#22C55E',
    trait5: '#F59E0B',
  },
  gradients: {
    background:
      'radial-gradient(circle at 10% 20%, rgba(59,130,246,0.18), transparent 40%),radial-gradient(circle at 90% 10%, rgba(139,92,246,0.15), transparent 40%),radial-gradient(circle at 50% 90%, rgba(34,211,238,0.12), transparent 40%),#060812',
    primaryButton: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
    primaryButtonHover: 'linear-gradient(135deg,#2563EB,#7C3AED)',
    progress: 'linear-gradient(90deg, #22D3EE 0%, #3B82F6 50%, #8B5CF6 100%)',
  },
  glass: {
    background: 'rgba(15, 23, 42, 0.65)',
    border: 'rgba(255, 255, 255, 0.06)',
    backdropBlur: '18px',
  },
  glow: {
    primary: '0 0 30px rgba(59,130,246,0.35)',
    cyan: '0 0 30px rgba(34,211,238,0.35)',
    purple: '0 0 30px rgba(139,92,246,0.35)',
  },
  motion: {
    hoverLift: 'translateY(-3px)',
    transition: '0.28s cubic-bezier(.4,0,.2,1)',
  },
};

export const traitColors = {
  O: tokens.accent.purple,
  C: tokens.accent.blue,
  E: tokens.accent.amber,
  A: tokens.state.success,
  N: tokens.state.error,
};

export const chartTokens = {
  axis: tokens.text.secondary,
  mutedAxis: tokens.text.muted,
  grid: 'rgba(148, 163, 200, 0.2)',
  axisLine: 'rgba(148, 163, 200, 0.25)',
  tooltip: {
    background: 'rgba(11, 15, 26, 0.94)',
    border: '1px solid rgba(148, 163, 200, 0.5)',
    text: tokens.text.primary,
  },
};

export default tokens;
