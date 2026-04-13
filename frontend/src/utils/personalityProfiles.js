export const PERSONALITY_PROFILES = {
  O: {
    name: 'Innovator',
    traitName: 'Openness',
    summary:
      'Curious, imaginative, and exploratory. You tend to perform well in roles that reward experimentation and idea generation.',
    recommendations: [
      'Allocate dedicated exploration time, then lock execution windows.',
      'Convert ideas into short experiments with measurable outcomes.',
      'Pair creativity with structured weekly planning.',
    ],
  },
  C: {
    name: 'Organizer',
    traitName: 'Conscientiousness',
    summary:
      'Reliable, disciplined, and system-oriented. You thrive in environments where quality and consistency matter.',
    recommendations: [
      'Use clear priorities to avoid over-optimization.',
      'Delegate repetitive tasks where possible.',
      'Build buffers to handle uncertainty without stress.',
    ],
  },
  E: {
    name: 'Catalyst',
    traitName: 'Extraversion',
    summary:
      'Expressive, energetic, and socially driven. You often accelerate teams through communication and momentum.',
    recommendations: [
      'Balance high-collaboration time with deep-focus blocks.',
      'Capture action items immediately after meetings.',
      'Use short feedback cycles to keep momentum productive.',
    ],
  },
  A: {
    name: 'Mediator',
    traitName: 'Agreeableness',
    summary:
      'Supportive, cooperative, and empathetic. You help teams sustain trust and high-quality collaboration.',
    recommendations: [
      'Practice assertive boundary-setting in high-load periods.',
      'Separate empathy from ownership of others\' outcomes.',
      'Document decisions to reduce conflict ambiguity.',
    ],
  },
  N: {
    name: 'Analyzer',
    traitName: 'Neuroticism',
    summary:
      'Risk-aware and reflective. You are often strong at identifying weak signals before they become bigger issues.',
    recommendations: [
      'Use decision deadlines to prevent analysis loops.',
      'Pair risk assessment with explicit mitigation actions.',
      'Track wins to avoid bias toward negative outcomes.',
    ],
  },
};

export const getPersonalityProfile = (traitCode = 'O') =>
  PERSONALITY_PROFILES[traitCode] || PERSONALITY_PROFILES.O;
