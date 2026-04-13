const QUESTION_TEMPLATES = [
  {
    key: 'learning-loop',
    type: 'technical_validation',
    traitFocus: 'O',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['learning', 'adaptability'],
    prompts: {
      beginner:
        'When you learn a new tool, what first step helps you understand it quickly?',
      intermediate:
        'Walk through how you break down an unfamiliar tool or framework before using it in real work.',
      advanced:
        'Describe the decision framework you use to evaluate whether a new technology is worth adopting in production.',
    },
  },
  {
    key: 'debugging-approach',
    type: 'problem_solving',
    traitFocus: 'C',
    domainTags: ['software', 'data'],
    skillTags: ['debugging', 'analysis'],
    prompts: {
      beginner:
        'How do you usually find the cause when something you built is not working?',
      intermediate:
        'Explain your step-by-step debugging strategy when an issue appears in a project with multiple moving parts.',
      advanced:
        'How do you design a reproducible root-cause investigation process for intermittent production issues?',
    },
  },
  {
    key: 'quality-ownership',
    type: 'technical_validation',
    traitFocus: 'C',
    domainTags: ['software', 'data', 'design', 'product'],
    skillTags: ['quality', 'delivery'],
    prompts: {
      beginner:
        'Before submitting work, what quality checks do you make automatically?',
      intermediate:
        'Which quality signals do you track to decide if your deliverable is ready for review?',
      advanced:
        'How do you balance delivery speed and quality in high-stakes deadlines without creating rework debt?',
    },
  },
  {
    key: 'stakeholder-communication',
    type: 'decision_simulation',
    traitFocus: 'E',
    domainTags: ['software', 'product', 'business', 'marketing'],
    skillTags: ['communication', 'alignment'],
    prompts: {
      beginner:
        'If someone non-technical asks for an update, how do you explain your work clearly?',
      intermediate:
        'How do you communicate tradeoffs when stakeholders ask for faster delivery than is realistic?',
      advanced:
        'Describe how you manage conflicting stakeholder priorities while protecting delivery quality and team focus.',
    },
  },
  {
    key: 'collaboration-style',
    type: 'behavioral_psychology',
    traitFocus: 'A',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['teamwork', 'collaboration'],
    prompts: {
      beginner:
        'What helps you work smoothly with teammates who have different styles?',
      intermediate:
        'How do you handle collaboration when your teammate disagrees with your solution approach?',
      advanced:
        'How do you maintain constructive collaboration in high-pressure, cross-functional decision cycles?',
    },
  },
  {
    key: 'ownership-under-pressure',
    type: 'decision_simulation',
    traitFocus: 'N',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['stress-management', 'ownership'],
    prompts: {
      beginner:
        'When deadlines get tight, what helps you stay calm and productive?',
      intermediate:
        'Describe how you prioritize tasks when multiple urgent requests appear at once.',
      advanced:
        'How do you protect decision quality and team stability during repeated deadline shocks?',
    },
  },
  {
    key: 'interest-energy',
    type: 'interest_alignment',
    traitFocus: 'O',
    domainTags: ['software', 'data', 'design', 'product', 'marketing', 'business'],
    skillTags: ['motivation', 'curiosity'],
    prompts: {
      beginner:
        'Which kind of work naturally keeps your attention the longest?',
      intermediate:
        'Which project activities consistently increase your motivation, and which drain it?',
      advanced:
        'What work themes do you repeatedly return to, even when they are not part of your assigned scope?',
    },
  },
  {
    key: 'tradeoff-thinking',
    type: 'decision_simulation',
    traitFocus: 'C',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['decision-making', 'tradeoffs'],
    prompts: {
      beginner:
        'If you must choose between speed and perfection, how do you decide?',
      intermediate:
        'Describe the tradeoff checks you run before choosing a solution with known limitations.',
      advanced:
        'How do you structure tradeoff decisions when each option has different long-term risk profiles?',
    },
  },
  {
    key: 'system-thinking',
    type: 'problem_solving',
    traitFocus: 'O',
    domainTags: ['software', 'data', 'product', 'business'],
    skillTags: ['systems-thinking'],
    prompts: {
      beginner:
        'How do you make sure your work fits with the bigger project goals?',
      intermediate:
        'How do you identify upstream and downstream impacts before implementing a change?',
      advanced:
        'How do you map second-order consequences when designing decisions across interconnected systems?',
    },
  },
  {
    key: 'customer-focus',
    type: 'interest_alignment',
    traitFocus: 'A',
    domainTags: ['software', 'product', 'marketing', 'business', 'design'],
    skillTags: ['user-empathy', 'impact'],
    prompts: {
      beginner:
        'How do you check whether your work is actually useful to end users?',
      intermediate:
        'What signals do you rely on to judge whether user needs are being solved, not just features shipped?',
      advanced:
        'How do you reconcile conflicting user feedback while preserving product direction and business outcomes?',
    },
  },
  {
    key: 'initiative-pattern',
    type: 'behavioral_psychology',
    traitFocus: 'E',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['initiative', 'leadership'],
    prompts: {
      beginner:
        'When you notice a problem, what usually makes you act on it?',
      intermediate:
        'Describe how you take initiative when a project has unclear ownership.',
      advanced:
        'How do you create momentum and alignment when critical work has no obvious owner?',
    },
  },
  {
    key: 'learning-from-failure',
    type: 'behavioral_psychology',
    traitFocus: 'N',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['resilience', 'reflection'],
    prompts: {
      beginner:
        'When something fails, what is the first thing you do next?',
      intermediate:
        'How do you extract useful lessons from failed attempts without losing confidence?',
      advanced:
        'How do you turn recurring failure patterns into systemic improvements for future delivery?',
    },
  },
  {
    key: 'technical-depth',
    type: 'technical_validation',
    traitFocus: 'O',
    domainTags: ['software', 'data'],
    skillTags: ['architecture', 'technical-depth'],
    prompts: {
      beginner:
        'How do you decide when to ask for help on a technical problem?',
      intermediate:
        'How do you decide whether a problem needs a quick patch or a deeper redesign?',
      advanced:
        'Explain how you evaluate technical debt tradeoffs when choosing architecture direction.',
    },
  },
  {
    key: 'execution-discipline',
    type: 'technical_validation',
    traitFocus: 'C',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['planning', 'execution'],
    prompts: {
      beginner:
        'What simple routine helps you finish tasks on time?',
      intermediate:
        'How do you plan your week to protect deep work while still handling interrupts?',
      advanced:
        'How do you maintain consistent execution quality across parallel priorities and shifting requirements?',
    },
  },
  {
    key: 'conflict-navigation',
    type: 'behavioral_psychology',
    traitFocus: 'A',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['conflict-resolution'],
    prompts: {
      beginner:
        'What do you do when a discussion starts becoming tense?',
      intermediate:
        'How do you keep disagreements objective when opinions become emotionally charged?',
      advanced:
        'How do you resolve repeated cross-team conflicts without weakening accountability standards?',
    },
  },
  {
    key: 'risk-judgement',
    type: 'decision_simulation',
    traitFocus: 'N',
    domainTags: ['software', 'data', 'product', 'business'],
    skillTags: ['risk-management'],
    prompts: {
      beginner:
        'How do you notice early signs that a task may miss its deadline?',
      intermediate:
        'How do you assess whether a decision risk is acceptable or needs escalation?',
      advanced:
        'Describe your method for quantifying delivery risk when information is incomplete.',
    },
  },
  {
    key: 'career-direction',
    type: 'interest_alignment',
    traitFocus: 'O',
    domainTags: ['software', 'data', 'design', 'product', 'marketing', 'business'],
    skillTags: ['career-orientation'],
    prompts: {
      beginner:
        'Which role direction currently feels most natural for you, and why?',
      intermediate:
        'What role trajectory do you see for yourself in the next 2-3 years, based on your strengths?',
      advanced:
        'How do you choose career opportunities that compound both your strengths and market relevance?',
    },
  },
  {
    key: 'problem-framing',
    type: 'problem_solving',
    traitFocus: 'O',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['problem-framing'],
    prompts: {
      beginner:
        'Before solving a task, how do you confirm you understood the actual problem?',
      intermediate:
        'How do you separate symptoms from root problems before proposing solutions?',
      advanced:
        'How do you construct problem statements that align strategic intent, constraints, and measurable outcomes?',
    },
  },
  {
    key: 'decision-confidence',
    type: 'behavioral_psychology',
    traitFocus: 'E',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['confidence'],
    prompts: {
      beginner:
        'When are you confident enough to make a call without waiting for more input?',
      intermediate:
        'How do you decide when to move forward with imperfect information?',
      advanced:
        'How do you calibrate confidence so decisions remain decisive without becoming overconfident?',
    },
  },
  {
    key: 'focus-maintenance',
    type: 'behavioral_psychology',
    traitFocus: 'C',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['focus', 'self-management'],
    prompts: {
      beginner:
        'What helps you stay focused when distractions appear?',
      intermediate:
        'How do you recover focus quickly after context switching several times in a day?',
      advanced:
        'How do you structure your workflow to preserve cognitive quality during sustained high workload periods?',
    },
  },
  {
    key: 'feedback-response',
    type: 'behavioral_psychology',
    traitFocus: 'A',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['feedback', 'growth'],
    prompts: {
      beginner:
        'How do you react when your work receives critical feedback?',
      intermediate:
        'Describe how you decide which feedback to apply immediately and which to challenge.',
      advanced:
        'How do you turn high-friction feedback into measurable growth without losing delivery momentum?',
    },
  },
  {
    key: 'ambiguity-comfort',
    type: 'decision_simulation',
    traitFocus: 'N',
    domainTags: ['software', 'data', 'design', 'product', 'business'],
    skillTags: ['ambiguity-handling'],
    prompts: {
      beginner:
        'When instructions are vague, what is your first move?',
      intermediate:
        'How do you make progress when goals are clear but implementation details are undefined?',
      advanced:
        'How do you design execution paths for ambiguous problems while keeping stakeholders aligned on certainty levels?',
    },
  },
];

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

const getExpandedAdaptiveQuestionBank = () => {
  const questions = [];

  QUESTION_TEMPLATES.forEach((template) => {
    LEVEL_ORDER.forEach((difficulty) => {
      const questionId = `${template.key}-${difficulty}`;

      questions.push({
        questionId,
        source: 'adaptive_bank',
        type: template.type,
        traitFocus: template.traitFocus,
        difficulty,
        domainTags: template.domainTags,
        skillTags: template.skillTags,
        baseText: template.prompts[difficulty],
        promptByLevel: {
          beginner: template.prompts.beginner,
          intermediate: template.prompts.intermediate,
          advanced: template.prompts.advanced,
        },
      });
    });
  });

  return questions;
};

module.exports = {
  QUESTION_TEMPLATES,
  LEVEL_ORDER,
  getExpandedAdaptiveQuestionBank,
};
