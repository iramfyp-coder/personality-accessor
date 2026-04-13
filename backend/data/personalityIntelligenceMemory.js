const PERSONALITY_INTELLIGENCE_MEMORY = [
  {
    trait: 'O',
    intent: 'Measure curiosity, abstract thinking, and comfort with novelty.',
    examples: [
      'I have a vivid imagination',
      'I enjoy thinking about abstract ideas',
      'I am quick to understand new things',
    ],
    adaptation_rules: {
      developer:
        'Use experimentation, architecture tradeoffs, and learning-new-stack scenarios.',
      manager:
        'Use strategic pivots, innovation choices, and ambiguous planning scenarios.',
      student:
        'Use project topics, class exploration, and learning-method scenarios.',
      designer:
        'Use concept ideation, design exploration, and style-direction scenarios.',
      business:
        'Use market change, opportunity framing, and decision-under-uncertainty scenarios.',
    },
  },
  {
    trait: 'C',
    intent: 'Measure planning discipline, follow-through, and execution reliability.',
    examples: [
      'I usually follow a schedule',
      'I pay close attention to details',
      'I get chores done right away',
    ],
    adaptation_rules: {
      developer:
        'Use sprint planning, code quality gates, and release-readiness scenarios.',
      manager:
        'Use delivery governance, prioritization, and accountability scenarios.',
      student:
        'Use assignment planning, revision routines, and deadline discipline scenarios.',
      designer:
        'Use handoff quality, revision discipline, and design QA scenarios.',
      business:
        'Use execution cadence, reporting rigor, and operational discipline scenarios.',
    },
  },
  {
    trait: 'E',
    intent: 'Measure social energy, assertiveness, and communication intensity.',
    examples: [
      'I am the life of the party',
      'I often start conversations with others',
      'I feel comfortable being around other people',
    ],
    adaptation_rules: {
      developer:
        'Use collaboration in code reviews, standups, and cross-team syncs.',
      manager:
        'Use leadership communication, stakeholder alignment, and influence scenarios.',
      student:
        'Use class participation, group work, and presentation scenarios.',
      designer:
        'Use critique sessions, stakeholder walkthroughs, and workshop scenarios.',
      business:
        'Use client communication, meeting leadership, and negotiation scenarios.',
    },
  },
  {
    trait: 'A',
    intent: 'Measure empathy, trust, cooperation, and conflict-handling posture.',
    examples: [
      'I sympathize with the feelings of others',
      'I take time out for others',
      'I keep my promises to others',
    ],
    adaptation_rules: {
      developer:
        'Use pair-programming, conflict resolution in technical debates, and mentorship scenarios.',
      manager:
        'Use coaching conversations, conflict mediation, and team-trust scenarios.',
      student:
        'Use peer support, group collaboration, and fairness scenarios.',
      designer:
        'Use feedback integration, cross-functional empathy, and user-advocacy scenarios.',
      business:
        'Use customer empathy, collaboration under pressure, and partner-management scenarios.',
    },
  },
  {
    trait: 'N',
    intent: 'Measure stress response, emotional reactivity, and stability under pressure.',
    examples: [
      'I get stressed out easily',
      'I often worry about things',
      'I lose my temper easily',
    ],
    adaptation_rules: {
      developer:
        'Use production incidents, deadline pressure, and uncertainty-resolution scenarios.',
      manager:
        'Use crisis leadership, escalation handling, and ambiguity-management scenarios.',
      student:
        'Use exam stress, workload pressure, and setback-recovery scenarios.',
      designer:
        'Use revision pressure, stakeholder rejection, and constraint-heavy scenarios.',
      business:
        'Use sales pressure, target stress, and high-risk decision scenarios.',
    },
  },
];

const getPersonalityTraitIntents = () =>
  PERSONALITY_INTELLIGENCE_MEMORY.map((entry) => ({
    trait: entry.trait,
    intent: entry.intent,
    examples: entry.examples,
    adaptation_rules: entry.adaptation_rules,
  }));

module.exports = {
  PERSONALITY_INTELLIGENCE_MEMORY,
  getPersonalityTraitIntents,
};

