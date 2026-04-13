const CAREERS_KB = require('../../data/careers.json');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const WEIGHTS = {
  personality: 0.25,
  skills: 0.2,
  subjects: 0.1,
  aptitude: 0.15,
  interests: 0.1,
  cognitive: 0.15,
  behavior: 0.05,
};

const CAREER_CLUSTERS = ['Engineering', 'Business', 'Creative', 'Medical', 'Research', 'Technology', 'Social'];

const COGNITIVE_KEYS = ['analytical', 'creative', 'strategic', 'systematic', 'practical', 'abstract'];
const BEHAVIOR_KEYS = ['leadership', 'risk_tolerance', 'decision_speed', 'stress_tolerance', 'team_preference'];

const toSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeList = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const toNormalizedTokenSet = (items = []) =>
  new Set(
    normalizeList(items)
      .map((item) => item.toLowerCase())
      .map((item) => item.replace(/[^a-z0-9\s]/g, ' '))
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );

const toCareerCatalog = () =>
  Object.entries(CAREERS_KB || {})
    .map(([careerId, payload]) => {
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      return {
        careerId,
        title: String(payload.title || careerId).trim(),
        personality: payload.personality || {},
        skills: normalizeList(payload.skills),
        subjects: normalizeList(payload.subjects),
        aptitude: payload.aptitude || {},
        interests: normalizeList(payload.interests),
        growthPotential: clamp(Number(payload.growthPotential || 78), 35, 99),
      };
    })
    .filter(Boolean);

const toPercentFromScale = (value) => clamp(Math.round(((Number(value || 3) - 1) / 4) * 100), 0, 100);

const toNumericAnswerScore = (answer = {}) => {
  const type = String(answer.type || '').toLowerCase();

  if (type === 'scale') {
    const raw = Number(answer.value);
    const min = Number(answer?.metadata?.scaleMin || 1);
    const max = Number(answer?.metadata?.scaleMax || 10);

    if (Number.isFinite(raw) && Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return clamp(((raw - min) / (max - min)) * 4 + 1, 1, 5);
    }

    return 3;
  }

  if (typeof answer.value === 'number') {
    return clamp(Number(answer.value), 1, 5);
  }

  if (answer.value && typeof answer.value === 'object') {
    const candidate = Number(
      answer.value.normalizedScore ||
        answer.metadata?.normalizedScore ||
        answer.value.weight ||
        answer.value.score
    );

    return Number.isFinite(candidate) ? clamp(candidate, 1, 5) : 3;
  }

  return 3;
};

const scorePersonalityAlignment = ({ traitScores = {}, career }) => {
  const targets = career.personality || {};
  const entries = Object.entries(targets);

  if (!entries.length) {
    return 50;
  }

  const avgDistance =
    entries.reduce((sum, [trait, target]) => {
      const actual = Number(traitScores?.[trait] || 50);
      return sum + Math.abs(actual - Number(target));
    }, 0) / entries.length;

  return clamp(Math.round(100 - avgDistance), 0, 100);
};

const scoreKeywordOverlap = ({ profileValues = [], targetValues = [] }) => {
  const left = toNormalizedTokenSet(profileValues);
  const right = toNormalizedTokenSet(targetValues);

  if (!left.size || !right.size) {
    return 45;
  }

  let hits = 0;

  right.forEach((target) => {
    const directHit = left.has(target);
    const fuzzyHit =
      directHit ||
      Array.from(left).some((item) => item.includes(target) || target.includes(item));

    if (fuzzyHit) {
      hits += 1;
    }
  });

  return clamp(Math.round((hits / Math.max(right.size, 1)) * 100), 0, 100);
};

const toAverageMarksScore = (marks = []) => {
  const values = (Array.isArray(marks) ? marks : [])
    .map((item) => {
      if (typeof item === 'number') {
        return item;
      }

      const value = Number(item?.score ?? item?.marks ?? item?.percentage);
      return Number.isFinite(value) ? value : null;
    })
    .filter((item) => Number.isFinite(item));

  if (!values.length) {
    return 62;
  }

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp(Math.round(avg), 0, 100);
};

const computeAptitudeSignals = ({ answers = [], questionPlan = [], cvData = {} }) => {
  const byQuestionId = new Map((Array.isArray(questionPlan) ? questionPlan : []).map((q) => [q.questionId, q]));

  const aptitudeAnswers = (Array.isArray(answers) ? answers : []).filter((answer) => {
    const question = byQuestionId.get(answer.questionId);
    const category = String(question?.category || answer?.metadata?.category || '').toLowerCase();
    const intent = String(question?.intent || answer?.metadata?.intent || '').toLowerCase();

    return category.includes('aptitude') || intent === 'analytical' || intent === 'planning';
  });

  const aptitudeScore = aptitudeAnswers.length
    ? Math.round(
        aptitudeAnswers.reduce((sum, answer) => sum + toPercentFromScale(toNumericAnswerScore(answer)), 0) /
          aptitudeAnswers.length
      )
    : 60;

  const marksScore = toAverageMarksScore(cvData.marks || []);

  return {
    logical_reasoning: clamp(Math.round(aptitudeScore * 0.65 + marksScore * 0.35), 0, 100),
    numerical_reasoning: clamp(Math.round(marksScore * 0.7 + aptitudeScore * 0.3), 0, 100),
    verbal_reasoning: clamp(Math.round(aptitudeScore * 0.55 + marksScore * 0.45), 0, 100),
  };
};

const scoreAptitudeAlignment = ({ aptitudeSignals = {}, career }) => {
  const targets = career.aptitude || {};
  const entries = Object.entries(targets);

  if (!entries.length) {
    return 55;
  }

  const avgDistance =
    entries.reduce((sum, [key, target]) => {
      const actual = Number(aptitudeSignals?.[key] || 55);
      return sum + Math.abs(actual - Number(target));
    }, 0) / entries.length;

  return clamp(Math.round(100 - avgDistance), 0, 100);
};

const inferCareerCluster = (career = {}) => {
  const text = `${career.title || ''} ${(career.skills || []).join(' ')} ${(career.interests || []).join(' ')}`.toLowerCase();

  if (/doctor|medical|clinical|nurse|pharma|health/.test(text)) {
    return 'Medical';
  }

  if (/research|scientist|r&d|machine learning|ai/.test(text)) {
    return 'Research';
  }

  if (/designer|ux|creative|visual/.test(text)) {
    return 'Creative';
  }

  if (/manager|business|marketing|sales|operations/.test(text)) {
    return 'Business';
  }

  if (/teacher|counsel|hr|social|community/.test(text)) {
    return 'Social';
  }

  if (/engineer|devops|backend|frontend|software/.test(text)) {
    return 'Engineering';
  }

  return 'Technology';
};

const COGNITIVE_TARGETS_BY_CLUSTER = {
  Engineering: { analytical: 78, creative: 55, strategic: 62, systematic: 78, practical: 68, abstract: 62 },
  Business: { analytical: 62, creative: 58, strategic: 76, systematic: 62, practical: 74, abstract: 54 },
  Creative: { analytical: 54, creative: 82, strategic: 66, systematic: 48, practical: 60, abstract: 76 },
  Medical: { analytical: 74, creative: 44, strategic: 60, systematic: 72, practical: 82, abstract: 52 },
  Research: { analytical: 84, creative: 58, strategic: 62, systematic: 66, practical: 52, abstract: 82 },
  Technology: { analytical: 74, creative: 60, strategic: 66, systematic: 68, practical: 64, abstract: 68 },
  Social: { analytical: 52, creative: 64, strategic: 70, systematic: 52, practical: 76, abstract: 56 },
};

const BEHAVIOR_TARGETS_BY_CLUSTER = {
  Engineering: { leadership: 62, risk_tolerance: 58, decision_speed: 64, stress_tolerance: 70, team_preference: 62 },
  Business: { leadership: 78, risk_tolerance: 62, decision_speed: 72, stress_tolerance: 68, team_preference: 70 },
  Creative: { leadership: 60, risk_tolerance: 66, decision_speed: 58, stress_tolerance: 60, team_preference: 64 },
  Medical: { leadership: 65, risk_tolerance: 50, decision_speed: 70, stress_tolerance: 80, team_preference: 76 },
  Research: { leadership: 56, risk_tolerance: 58, decision_speed: 54, stress_tolerance: 64, team_preference: 56 },
  Technology: { leadership: 68, risk_tolerance: 62, decision_speed: 68, stress_tolerance: 72, team_preference: 64 },
  Social: { leadership: 72, risk_tolerance: 52, decision_speed: 62, stress_tolerance: 66, team_preference: 86 },
};

const scoreVectorAlignment = ({ actual = {}, target = {}, keys = [] }) => {
  const entries = (Array.isArray(keys) ? keys : []).map((key) => [key, Number(target[key] || 50)]);

  if (!entries.length) {
    return 60;
  }

  const avgDistance =
    entries.reduce((sum, [key, targetValue]) => {
      const actualValue = Number(actual[key] || 50);
      return sum + Math.abs(actualValue - targetValue);
    }, 0) / entries.length;

  return clamp(Math.round(100 - avgDistance), 0, 100);
};

const inferUserCluster = ({ cvData = {}, cognitiveScores = {}, behaviorVector = {} }) => {
  const skills = normalizeList((cvData.skills || []).map((skill) => skill.name || skill));
  const interests = normalizeList(cvData.interests || []);
  const text = `${skills.join(' ')} ${interests.join(' ')}`.toLowerCase();

  const clusterSignals = {
    Engineering: 0,
    Business: 0,
    Creative: 0,
    Medical: 0,
    Research: 0,
    Technology: 0,
    Social: 0,
  };

  if (/react|node|java|python|kubernetes|devops|backend|frontend|engineering/.test(text)) {
    clusterSignals.Engineering += 14;
    clusterSignals.Technology += 10;
  }

  if (/design|ux|figma|creative|visual|storytelling/.test(text)) {
    clusterSignals.Creative += 14;
  }

  if (/product|strategy|business|market|operations/.test(text)) {
    clusterSignals.Business += 14;
  }

  if (/medical|health|biology|doctor/.test(text)) {
    clusterSignals.Medical += 14;
  }

  if (/research|ml|machine learning|ai|data science|statistics/.test(text)) {
    clusterSignals.Research += 14;
    clusterSignals.Technology += 8;
  }

  if (/teaching|community|support|counsel|people/.test(text)) {
    clusterSignals.Social += 14;
  }

  clusterSignals.Research += Number(cognitiveScores.analytical || 50) * 0.18;
  clusterSignals.Creative += Number(cognitiveScores.creative || 50) * 0.2;
  clusterSignals.Business += Number(cognitiveScores.strategic || 50) * 0.2;
  clusterSignals.Engineering += Number(cognitiveScores.systematic || 50) * 0.2;
  clusterSignals.Social += Number(behaviorVector.team_preference || 50) * 0.18;
  clusterSignals.Business += Number(behaviorVector.leadership || 50) * 0.16;

  const ranked = Object.entries(clusterSignals).sort((a, b) => b[1] - a[1]);

  return {
    cluster: ranked[0]?.[0] || 'Technology',
    scores: clusterSignals,
  };
};

const scoreClusterAffinity = ({ userCluster = 'Technology', careerCluster = 'Technology' }) => {
  if (userCluster === careerCluster) {
    return 100;
  }

  const adjacency = {
    Engineering: ['Technology', 'Research'],
    Technology: ['Engineering', 'Research', 'Business'],
    Research: ['Technology', 'Engineering'],
    Business: ['Technology', 'Social'],
    Creative: ['Business', 'Social'],
    Social: ['Business', 'Creative', 'Medical'],
    Medical: ['Social', 'Research'],
  };

  return adjacency[userCluster]?.includes(careerCluster) ? 72 : 48;
};

const buildReasoning = ({ career, components = {} }) => {
  const ranked = [
    { key: 'personality', label: 'personality fit', value: components.personalityMatch },
    { key: 'skills', label: 'skills fit', value: components.skillsMatch },
    { key: 'subjects', label: 'subject alignment', value: components.subjectsMatch },
    { key: 'aptitude', label: 'aptitude alignment', value: components.aptitudeMatch },
    { key: 'interests', label: 'interest alignment', value: components.interestMatch },
    { key: 'cognitive', label: 'cognitive style fit', value: components.cognitiveMatch },
    { key: 'behavior', label: 'behavior signal fit', value: components.behaviorMatch },
  ].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));

  const topSignals = ranked
    .slice(0, 3)
    .map((item) => `${item.label} (${item.value}%)`)
    .join(', ');

  return `You scored highest on ${topSignals}, which aligns strongly with ${career.title}.`;
};

const toStrengthHighlights = ({ components = {} }) => {
  const ordered = [
    { key: 'personalityMatch', label: 'personality pattern' },
    { key: 'skillsMatch', label: 'practical skill execution' },
    { key: 'subjectsMatch', label: 'academic subject base' },
    { key: 'aptitudeMatch', label: 'reasoning aptitude' },
    { key: 'interestMatch', label: 'intrinsic motivation' },
    { key: 'cognitiveMatch', label: 'cognitive style alignment' },
    { key: 'behaviorMatch', label: 'behavioral signal alignment' },
  ]
    .map((item) => ({ ...item, score: Number(components[item.key] || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return ordered.map((item) => `${item.label} (${item.score}%)`);
};

const toSkillGaps = ({ career, profileSkills = [] }) => {
  const profileSet = toNormalizedTokenSet(profileSkills);

  return career.skills
    .filter((skill) => {
      const normalized = String(skill || '').toLowerCase();
      return !profileSet.has(normalized);
    })
    .slice(0, 4);
};

const toRoadmapTimeline = ({ career, skillGaps = [] }) => [
  {
    stage: 'Junior',
    summary: `Build baseline competency in ${career.skills.slice(0, 2).join(', ')} through guided project work.`,
  },
  {
    stage: 'Mid',
    summary: `Own scoped outcomes end-to-end and close gaps in ${skillGaps.slice(0, 2).join(', ') || 'execution consistency'}.`,
  },
  {
    stage: 'Senior',
    summary: `Lead cross-functional initiatives and convert domain mastery into measurable business impact.`,
  },
];

const toGrowthSuggestions = ({ components = {}, skillGaps = [], experienceLevel = 'medium' }) => {
  const suggestions = [];

  if (skillGaps[0]) {
    suggestions.push(`Build practical depth in ${skillGaps[0]} with one measurable project this quarter.`);
  }

  if (components.aptitudeMatch < 60) {
    suggestions.push('Run a weekly reasoning drill (case analysis + post-mortem) to improve decision quality.');
  }

  if (components.cognitiveMatch < 60) {
    suggestions.push('Practice one weekly cognitive stretch task outside your default thinking style.');
  }

  if (experienceLevel === 'junior') {
    suggestions.push('Prioritize consistency and shipped outcomes before broad specialization.');
  } else if (experienceLevel === 'senior') {
    suggestions.push('Translate domain depth into mentoring and system-level strategic ownership.');
  } else {
    suggestions.push('Own one cross-functional initiative to increase promotion readiness.');
  }

  return suggestions.slice(0, 3);
};

const toCareerPrototype = (careerName = '') => {
  const normalizedName = String(careerName || '').trim();
  const lower = normalizedName.toLowerCase();

  const presets = {
    doctor: {
      title: 'Doctor',
      personality: { O: 58, C: 84, E: 62, A: 78, N: 30 },
      skills: ['biology', 'clinical reasoning', 'patient communication', 'decision making'],
      subjects: ['biology', 'medicine', 'chemistry'],
      aptitude: { logical_reasoning: 76, numerical_reasoning: 58, verbal_reasoning: 72 },
      interests: ['healthcare', 'patient care', 'medical science'],
      cluster: 'Medical',
    },
  };

  if (presets[lower]) {
    return presets[lower];
  }

  return {
    title: normalizedName || 'Target Career',
    personality: {},
    skills: [],
    subjects: [],
    aptitude: {},
    interests: [],
    cluster: 'Technology',
  };
};

const recommendCareers = ({
  cvData = {},
  personalityProfile = {},
  profileVector = {},
  answers = [],
  questionPlan = [],
  cognitiveScores = {},
  behaviorVector = {},
}) => {
  const catalog = toCareerCatalog();
  const traitScores = personalityProfile.trait_scores || {};

  const profileSkills = normalizeList((cvData.skills || []).map((skill) => skill.name));
  const profileSubjects = normalizeList([...(cvData.subjects || []), ...(cvData.education || [])]);
  const profileInterests = normalizeList(cvData.interests || []);
  const aptitudeSignals = computeAptitudeSignals({ answers, questionPlan, cvData });

  const userClusterContext = inferUserCluster({
    cvData,
    cognitiveScores,
    behaviorVector,
  });

  const ranked = catalog
    .map((career) => {
      const cluster = inferCareerCluster(career);

      const personalityMatch = scorePersonalityAlignment({ traitScores, career });
      const skillsMatch = scoreKeywordOverlap({
        profileValues: profileSkills,
        targetValues: career.skills,
      });
      const subjectsMatch = scoreKeywordOverlap({
        profileValues: profileSubjects,
        targetValues: career.subjects,
      });
      const aptitudeMatch = scoreAptitudeAlignment({ aptitudeSignals, career });
      const interestMatch = scoreKeywordOverlap({
        profileValues: profileInterests,
        targetValues: career.interests,
      });

      const cognitiveTarget = COGNITIVE_TARGETS_BY_CLUSTER[cluster] || COGNITIVE_TARGETS_BY_CLUSTER.Technology;
      const behaviorTarget = BEHAVIOR_TARGETS_BY_CLUSTER[cluster] || BEHAVIOR_TARGETS_BY_CLUSTER.Technology;

      const cognitiveMatch = scoreVectorAlignment({
        actual: cognitiveScores,
        target: cognitiveTarget,
        keys: COGNITIVE_KEYS,
      });

      const behaviorMatch = scoreVectorAlignment({
        actual: behaviorVector,
        target: behaviorTarget,
        keys: BEHAVIOR_KEYS,
      });

      const clusterAffinity = scoreClusterAffinity({
        userCluster: userClusterContext.cluster,
        careerCluster: cluster,
      });

      const weightedCore =
        personalityMatch * WEIGHTS.personality +
        skillsMatch * WEIGHTS.skills +
        subjectsMatch * WEIGHTS.subjects +
        aptitudeMatch * WEIGHTS.aptitude +
        interestMatch * WEIGHTS.interests +
        cognitiveMatch * WEIGHTS.cognitive +
        behaviorMatch * WEIGHTS.behavior;

      const score = clamp(Math.round(weightedCore * 0.92 + clusterAffinity * 0.08), 0, 100);

      const careerScore = Math.round(
        skillsMatch * 0.32 +
          subjectsMatch * 0.12 +
          aptitudeMatch * 0.2 +
          interestMatch * 0.14 +
          cognitiveMatch * 0.14 +
          behaviorMatch * 0.08
      );

      const components = {
        personalityMatch,
        skillsMatch,
        subjectsMatch,
        aptitudeMatch,
        interestMatch,
        cognitiveMatch,
        behaviorMatch,
      };

      const strengthHighlights = toStrengthHighlights({ components });
      const skillGaps = toSkillGaps({ career, profileSkills });

      return {
        career: career.title,
        career_id: career.careerId,
        cluster,
        score,
        role_match: score,
        personality_score: personalityMatch,
        career_score: careerScore,
        skill_alignment: skillsMatch,
        personality_alignment: personalityMatch,
        subject_match: subjectsMatch,
        aptitude_match: aptitudeMatch,
        interest_match: interestMatch,
        cognitive_match: cognitiveMatch,
        behavior_match: behaviorMatch,
        cluster_affinity: clusterAffinity,
        response_alignment: aptitudeMatch,
        growth_potential: career.growthPotential,
        why_fit: buildReasoning({ career, components }),
        explanation: {
          top_signals: strengthHighlights,
          summary: `You scored high in ${strengthHighlights.join(', ')}, which aligns with ${career.title}.`,
        },
        key_skills_to_build: career.skills,
        skill_gaps: skillGaps,
        growth_suggestions: toGrowthSuggestions({
          components,
          skillGaps,
          experienceLevel: profileVector.experienceLevel || profileVector.experience || 'medium',
        }),
        roadmap_timeline: toRoadmapTimeline({ career, skillGaps }),
        match_breakdown: {
          weights: WEIGHTS,
          personality: personalityMatch,
          skills: skillsMatch,
          subjects: subjectsMatch,
          aptitude: aptitudeMatch,
          interests: interestMatch,
          cognitive: cognitiveMatch,
          behavior: behaviorMatch,
        },
      };
    })
    .sort((a, b) => b.score - a.score);

  const scored = ranked.slice(0, 8).map((career, index, list) => {
    const nextScore = Number(list[index + 1]?.score ?? Math.max(Number(career.score || 0) - 10, 0));
    const separation = clamp(Math.round(Number(career.score || 0) - nextScore), 0, 100);
    const confidence = clamp(Math.round(Number(career.score || 0) * 0.65 + separation * 0.35), 0, 100);
    const confidenceBand = confidence < 45 ? 'low' : confidence <= 70 ? 'medium' : 'high';

    return {
      ...career,
      confidence,
      confidence_band: confidenceBand,
    };
  });

  const careerRoadmap = scored.length ? scored[0].roadmap_timeline : [];
  const personalityScoreAvg = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + Number(item.personality_score || 0), 0) / scored.length)
    : 0;
  const careerScoreAvg = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + Number(item.career_score || 0), 0) / scored.length)
    : 0;

  const topCluster = scored[0]?.cluster || userClusterContext.cluster || 'Technology';
  const whyNotCatalog = scored.reduce((accumulator, career) => {
    accumulator[career.career] = {
      cluster: career.cluster,
      score: career.score,
      top_signals: career.explanation?.top_signals || [],
      key_gaps: career.skill_gaps || [],
    };
    return accumulator;
  }, {});

  return {
    recommendations: scored,
    careerRoadmap,
    aptitudeSignals,
    cluster: topCluster,
    clusterLabel: `${topCluster} Cluster`,
    userCluster: userClusterContext.cluster,
    whyNotCatalog,
    balance: {
      personalityScore: personalityScoreAvg,
      careerScore: careerScoreAvg,
      weights: WEIGHTS,
    },
  };
};

const explainWhyNotCareer = ({
  careerName = '',
  recommendations = [],
  traitScores = {},
  cognitiveScores = {},
  behaviorVector = {},
  aptitudeSignals = {},
}) => {
  const normalizedTarget = String(careerName || '').trim();
  if (!normalizedTarget) {
    return {
      career: '',
      found: false,
      score: 0,
      explanation: 'Career name is required.',
      gaps: [],
    };
  }

  const inRecommendations = (Array.isArray(recommendations) ? recommendations : []).find(
    (item) => String(item.career || '').toLowerCase() === normalizedTarget.toLowerCase()
  );

  if (inRecommendations) {
    if (Number(inRecommendations.score || 0) >= 70) {
      return {
        career: inRecommendations.career,
        found: true,
        score: Number(inRecommendations.score || 0),
        explanation: `${inRecommendations.career} is actually a strong fit in your profile.`,
        gaps: inRecommendations.skill_gaps || [],
        comparison: {
          top_signals: inRecommendations.explanation?.top_signals || [],
          cluster: inRecommendations.cluster || '',
        },
      };
    }

    return {
      career: inRecommendations.career,
      found: true,
      score: Number(inRecommendations.score || 0),
      explanation:
        `${inRecommendations.career} ranks lower because stronger options match your current personality, cognitive, and behavior profile more closely.`,
      gaps: inRecommendations.skill_gaps || [],
      comparison: {
        top_signals: inRecommendations.explanation?.top_signals || [],
        cluster: inRecommendations.cluster || '',
      },
    };
  }

  const catalog = toCareerCatalog();
  const exact = catalog.find((item) => item.title.toLowerCase() === normalizedTarget.toLowerCase());
  const prototype = exact || toCareerPrototype(normalizedTarget);
  const cluster = prototype.cluster || inferCareerCluster(prototype);

  const personalityMatch = scorePersonalityAlignment({ traitScores, career: prototype });
  const cognitiveMatch = scoreVectorAlignment({
    actual: cognitiveScores,
    target: COGNITIVE_TARGETS_BY_CLUSTER[cluster] || COGNITIVE_TARGETS_BY_CLUSTER.Technology,
    keys: COGNITIVE_KEYS,
  });
  const behaviorMatch = scoreVectorAlignment({
    actual: behaviorVector,
    target: BEHAVIOR_TARGETS_BY_CLUSTER[cluster] || BEHAVIOR_TARGETS_BY_CLUSTER.Technology,
    keys: BEHAVIOR_KEYS,
  });

  const aptitudeMatch = scoreVectorAlignment({
    actual: {
      logical_reasoning: aptitudeSignals.logical_reasoning || 50,
      numerical_reasoning: aptitudeSignals.numerical_reasoning || 50,
      verbal_reasoning: aptitudeSignals.verbal_reasoning || 50,
    },
    target: {
      logical_reasoning: Number(prototype.aptitude?.logical_reasoning || 60),
      numerical_reasoning: Number(prototype.aptitude?.numerical_reasoning || 60),
      verbal_reasoning: Number(prototype.aptitude?.verbal_reasoning || 60),
    },
    keys: ['logical_reasoning', 'numerical_reasoning', 'verbal_reasoning'],
  });

  const estimatedScore = Math.round(
    personalityMatch * 0.35 + cognitiveMatch * 0.25 + behaviorMatch * 0.2 + aptitudeMatch * 0.2
  );

  const lowestSignals = [
    { key: 'personality fit', value: personalityMatch },
    { key: 'cognitive fit', value: cognitiveMatch },
    { key: 'behavior fit', value: behaviorMatch },
    { key: 'aptitude fit', value: aptitudeMatch },
  ]
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .map((item) => item.key);

  return {
    career: prototype.title,
    found: Boolean(exact),
    score: estimatedScore,
    explanation: `${prototype.title} is currently a weaker match mainly due to lower ${lowestSignals.join(
      ' and '
    )} versus your top careers.`,
    gaps: normalizeList(prototype.skills || []).slice(0, 4),
    comparison: {
      personality_match: personalityMatch,
      cognitive_match: cognitiveMatch,
      behavior_match: behaviorMatch,
      aptitude_match: aptitudeMatch,
      cluster,
    },
  };
};

module.exports = {
  CAREER_CLUSTERS,
  WEIGHTS,
  recommendCareers,
  explainWhyNotCareer,
};
