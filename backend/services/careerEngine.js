const { normalizeTraits } = require('./insightService');

const TRAIT_LABELS = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism',
};

const STATIC_CAREER_MAP = {
  O: [
    {
      career: 'Product Strategist',
      reason: 'High openness supports discovery, synthesis of ambiguous inputs, and concept innovation.',
      skillsNeeded: ['Opportunity framing', 'Experiment design', 'Strategic communication'],
    },
    {
      career: 'UX Researcher',
      reason: 'Curiosity and tolerance for complexity align with deep user inquiry and insight generation.',
      skillsNeeded: ['Interview design', 'Research synthesis', 'Storytelling with evidence'],
    },
    {
      career: 'Innovation Consultant',
      reason: 'Novelty-seeking and abstract thinking align with reframing business problems and exploring new models.',
      skillsNeeded: ['Creative facilitation', 'Systems thinking', 'Client communication'],
    },
  ],
  C: [
    {
      career: 'Project Manager',
      reason: 'Strong conscientiousness aligns with planning, coordination, and predictable execution.',
      skillsNeeded: ['Roadmapping', 'Risk management', 'Stakeholder alignment'],
    },
    {
      career: 'Operations Manager',
      reason: 'Discipline and process orientation support quality control and operational stability.',
      skillsNeeded: ['Process optimization', 'Performance metrics', 'Cross-functional coordination'],
    },
    {
      career: 'Quality Assurance Lead',
      reason: 'Detail focus and reliability fit structured validation and defect prevention work.',
      skillsNeeded: ['Test strategy', 'Root-cause analysis', 'Automation literacy'],
    },
  ],
  E: [
    {
      career: 'Sales Manager',
      reason: 'High extraversion supports persuasive communication, relationship building, and momentum.',
      skillsNeeded: ['Consultative selling', 'Pipeline management', 'Negotiation'],
    },
    {
      career: 'Partnerships Lead',
      reason: 'Social energy and assertiveness align with external collaboration and alliance building.',
      skillsNeeded: ['Business development', 'Relationship strategy', 'Executive communication'],
    },
    {
      career: 'Community Manager',
      reason: 'Expressive communication fits audience engagement and participation growth.',
      skillsNeeded: ['Community operations', 'Content planning', 'Conflict de-escalation'],
    },
  ],
  A: [
    {
      career: 'People Operations Specialist',
      reason: 'High agreeableness aligns with support, trust-building, and team wellbeing work.',
      skillsNeeded: ['Coaching basics', 'Policy communication', 'Conflict mediation'],
    },
    {
      career: 'Customer Success Manager',
      reason: 'Empathy and collaborative orientation support client retention and long-term relationships.',
      skillsNeeded: ['Account planning', 'Needs discovery', 'Relationship management'],
    },
    {
      career: 'Learning & Development Partner',
      reason: 'Cooperative communication fits mentoring and capability-building roles.',
      skillsNeeded: ['Instructional design', 'Facilitation', 'Feedback frameworks'],
    },
  ],
  N: [
    {
      career: 'Risk Analyst',
      reason: 'Sensitivity to weak signals can improve early identification of downside scenarios.',
      skillsNeeded: ['Risk modeling', 'Scenario analysis', 'Decision framing'],
    },
    {
      career: 'Compliance Specialist',
      reason: 'Vigilance and caution align with policy adherence and controls management.',
      skillsNeeded: ['Regulatory literacy', 'Documentation discipline', 'Audit preparation'],
    },
    {
      career: 'Cybersecurity Analyst',
      reason: 'Threat awareness and anticipation fit monitoring, incident triage, and defensive planning.',
      skillsNeeded: ['Threat detection', 'Incident response', 'Security fundamentals'],
    },
  ],
};

const BLEND_CAREER_MAP = {
  'O+E': [
    {
      career: 'Product Marketing Manager',
      reason: 'Creativity plus social influence supports translating ideas into compelling market narratives.',
      skillsNeeded: ['Positioning', 'Go-to-market planning', 'Storytelling'],
    },
  ],
  'O+C': [
    {
      career: 'Technical Program Manager',
      reason: 'Innovation mindset paired with execution rigor fits complex cross-functional delivery.',
      skillsNeeded: ['Program architecture', 'Prioritization', 'Delivery governance'],
    },
  ],
  'C+A': [
    {
      career: 'Service Delivery Manager',
      reason: 'Reliable execution and relational stability support high-trust operational environments.',
      skillsNeeded: ['Service design', 'SLA management', 'Stakeholder communication'],
    },
  ],
  'E+A': [
    {
      career: 'Account Executive',
      reason: 'Outgoing style and empathy support consultative selling and long-cycle account growth.',
      skillsNeeded: ['Active listening', 'Value framing', 'Negotiation'],
    },
  ],
  'C+N': [
    {
      career: 'Business Continuity Planner',
      reason: 'Planning rigor with risk awareness supports resilience and incident preparedness.',
      skillsNeeded: ['Continuity strategy', 'Scenario exercises', 'Response coordination'],
    },
  ],
};

const getTraitOrder = (traits) =>
  Object.entries(normalizeTraits(traits))
    .sort((a, b) => b[1] - a[1])
    .map(([trait]) => trait);

const withMetadata = (matches, source, traits) =>
  matches.map((match) => ({
    ...match,
    source,
    signal:
      source === 'dominant'
        ? TRAIT_LABELS[traits[0]] || 'Trait signal'
        : `${TRAIT_LABELS[traits[0]] || 'Trait'} + ${TRAIT_LABELS[traits[1]] || 'Trait'}`,
  }));

const dedupeByCareer = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.career || '').toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const toCareerRecommendation = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const career = String(item.career || '').trim();
  if (!career) {
    return null;
  }

  const reason = String(item.reason || '').trim();
  const skillsNeeded = Array.isArray(item.skillsNeeded)
    ? item.skillsNeeded
        .map((skill) => String(skill || '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    career,
    reason,
    skillsNeeded,
    source: item.source || 'ai',
    signal: item.signal || null,
  };
};

const buildCareerContext = (traits = {}, limit = 5) => {
  const traitOrder = getTraitOrder(traits);
  const dominantTrait = traitOrder[0] || 'O';

  const dominantMatches = STATIC_CAREER_MAP[dominantTrait] || [];
  const blendKey = `${traitOrder[0] || 'O'}+${traitOrder[1] || 'C'}`;
  const blendMatches = BLEND_CAREER_MAP[blendKey] || [];

  const merged = dedupeByCareer([
    ...withMetadata(dominantMatches, 'dominant', traitOrder),
    ...withMetadata(blendMatches, 'blend', traitOrder),
  ]);

  return merged.slice(0, Math.max(1, limit));
};

const mergeCareerRecommendations = ({
  aiRecommendations = [],
  staticRecommendations = [],
  limit = 5,
}) => {
  const fromAi = Array.isArray(aiRecommendations)
    ? aiRecommendations
        .map((item) =>
          toCareerRecommendation(
            typeof item === 'string'
              ? { career: item, reason: '', skillsNeeded: [] }
              : item
          )
        )
        .filter(Boolean)
    : [];

  const fromStatic = Array.isArray(staticRecommendations)
    ? staticRecommendations.map(toCareerRecommendation).filter(Boolean)
    : [];

  return dedupeByCareer([...fromAi, ...fromStatic]).slice(0, Math.max(1, limit));
};

module.exports = {
  buildCareerContext,
  mergeCareerRecommendations,
};
