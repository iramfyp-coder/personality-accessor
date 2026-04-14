const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 46;
const TOP_MARGIN = PAGE_HEIGHT - PAGE_MARGIN;
const DEFAULT_WRAP_WIDTH = 94;
const lineHeight = 14;
const sectionSpacing = 28;

const wrapLine = (text = '', width = DEFAULT_WRAP_WIDTH) => {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (!words.length) {
    return [''];
  }

  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

const escapePdfText = (text = '') =>
  String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const toBar = (value = 0) => {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  const size = Math.max(1, Math.round(score / 5));
  const empty = Math.max(0, 20 - size);
  return `${'#'.repeat(size)}${'-'.repeat(empty)}`;
};

const toConfidenceLabel = (confidenceBand = '', confidenceGap = 0) => {
  const band = String(confidenceBand || '').toLowerCase();
  if (band) {
    return `${band.toUpperCase()} (${Math.round(Number(confidenceGap || 0))})`;
  }

  const gap = Number(confidenceGap || 0);
  if (gap < 5) {
    return `LOW (${gap})`;
  }

  if (gap <= 15) {
    return `MEDIUM (${gap})`;
  }

  return `HIGH (${gap})`;
};

const toReportSections = ({ result }) => {
  const cv = result.cv_data || {};
  const careers = Array.isArray(result.career_recommendations) ? result.career_recommendations : [];
  const roadmap = Array.isArray(result.career_roadmap) ? result.career_roadmap : [];
  const skills = Array.isArray(cv.skills) ? cv.skills : [];
  const topSkills = skills.slice(0, 8).map((item) => `${item.name} (${item.level}/5)`);
  const ocean = result.ocean_scores || result.trait_scores || {};
  const cognitive = result.cognitive_scores || {};
  const behaviorVector = result.behavior_vector || {};
  const careerContrast = result.career_contrast || {};
  const consistencyScore = Math.round(Number(result.consistency_score || 0) * 100);
  const narrativeSummary = String(result.narrative_summary || result.behavioral_summary || '').trim();

  return [
    {
      title: 'Cover Page',
      lines: [
        'Career Personality Intelligence Report',
        '',
        `Candidate: ${cv.name || 'Candidate'}`,
        `Archetype: ${result.personality_type_label || result.personality_type || 'Analytical Builder'}`,
        `Career Cluster: ${result.career_cluster || 'Not specified'}`,
        `Confidence: ${toConfidenceLabel(result.confidence_band, result.confidence_gap)}`,
        `Consistency: ${consistencyScore}%`,
        `Generated At: ${new Date().toISOString()}`,
      ],
    },
    {
      title: 'Personality Summary',
      lines: [
        `Archetype: ${result.personality_type_label || result.personality_type || 'Analytical Builder'}`,
        '',
        ...wrapLine(narrativeSummary || 'Narrative summary unavailable.'),
        '',
        ...(Array.isArray(result.dominant_strengths) ? result.dominant_strengths.slice(0, 4) : []).map(
          (item, index) => `Strength ${index + 1}: ${item}`
        ),
      ],
    },
    {
      title: 'OCEAN',
      lines: [
        `Openness (O):         [${toBar(ocean.O)}] ${Math.round(Number(ocean.O || 0))}%`,
        `Conscientiousness (C):[${toBar(ocean.C)}] ${Math.round(Number(ocean.C || 0))}%`,
        `Extraversion (E):      [${toBar(ocean.E)}] ${Math.round(Number(ocean.E || 0))}%`,
        `Agreeableness (A):     [${toBar(ocean.A)}] ${Math.round(Number(ocean.A || 0))}%`,
        `Neuroticism (N):       [${toBar(ocean.N)}] ${Math.round(Number(ocean.N || 0))}%`,
      ],
    },
    {
      title: 'Cognitive',
      lines: [
        `Analytical: [${toBar(cognitive.analytical)}] ${Math.round(Number(cognitive.analytical || 0))}%`,
        `Creative:   [${toBar(cognitive.creative)}] ${Math.round(Number(cognitive.creative || 0))}%`,
        `Strategic:  [${toBar(cognitive.strategic)}] ${Math.round(Number(cognitive.strategic || 0))}%`,
        `Systematic: [${toBar(cognitive.systematic)}] ${Math.round(Number(cognitive.systematic || 0))}%`,
        `Practical:  [${toBar(cognitive.practical)}] ${Math.round(Number(cognitive.practical || 0))}%`,
        `Abstract:   [${toBar(cognitive.abstract)}] ${Math.round(Number(cognitive.abstract || 0))}%`,
      ],
    },
    {
      title: 'Behavior',
      lines: [
        `Leadership:       [${toBar(behaviorVector.leadership)}] ${Math.round(Number(behaviorVector.leadership || 0))}%`,
        `Risk Tolerance:   [${toBar(behaviorVector.risk_tolerance)}] ${Math.round(Number(behaviorVector.risk_tolerance || 0))}%`,
        `Decision Speed:   [${toBar(behaviorVector.decision_speed)}] ${Math.round(Number(behaviorVector.decision_speed || 0))}%`,
        `Stress Tolerance: [${toBar(behaviorVector.stress_tolerance)}] ${Math.round(Number(behaviorVector.stress_tolerance || 0))}%`,
        `Team Preference:  [${toBar(behaviorVector.team_preference)}] ${Math.round(Number(behaviorVector.team_preference || 0))}%`,
      ],
    },
    {
      title: 'Skills',
      lines: topSkills.length
        ? topSkills.map((skill, index) => `${index + 1}. ${skill}`)
        : ['No skill chart data available.'],
    },
    {
      title: 'Careers',
      lines: careers.length
        ? careers.slice(0, 6).flatMap((career, index) => [
            `${index + 1}. ${career.career} (${career.cluster || 'General'}) - ${career.score}% | Confidence ${career.confidence || 0}%`,
            ...wrapLine(career.why_fit || ''),
            '',
          ])
        : ['No career matches available.'],
    },
    {
      title: 'Summary',
      lines: [
        `Top Career: ${careers[0]?.career || 'n/a'} (${careers[0]?.score || 0}%)`,
        `Confidence Band: ${String(result.confidence_band || 'low').toUpperCase()}`,
        `Consistency Score: ${consistencyScore}%`,
        '',
        ...(careerContrast?.summary
          ? [
              ...wrapLine(careerContrast.summary),
              '',
              ...(Array.isArray(careerContrast.reasons) ? careerContrast.reasons.slice(0, 4) : []).map(
                (item, index) => `${index + 1}. ${item}`
              ),
              '',
            ]
          : []),
        ...(roadmap.length
          ? roadmap.slice(0, 4).flatMap((item, index) => [
              `${index + 1}. ${item.stage || 'Stage'}`,
              ...wrapLine(item.summary || ''),
              '',
            ])
          : []),
        ...wrapLine(
          narrativeSummary ||
            'This report combines personality, cognition, behavior, and career alignment signals to guide your next steps.'
        ),
      ],
    },
  ];
};

const checkPageBreak = ({ state, requiredSpace = lineHeight }) => {
  if (state.y - requiredSpace < PAGE_MARGIN) {
    state.pages.push([]);
    state.pageIndex += 1;
    state.y = TOP_MARGIN;
  }
};

const pushTextLine = ({ state, text = '', font = 'F1', size = 11 }) => {
  checkPageBreak({ state, requiredSpace: lineHeight });

  const content = String(text || '').trim();
  if (content) {
    state.pages[state.pageIndex].push(
      `BT\n/${font} ${size} Tf\n1 0 0 1 ${PAGE_MARGIN} ${state.y.toFixed(2)} Tm\n(${escapePdfText(content)}) Tj\nET`
    );
  }

  state.y -= lineHeight;
};

const toPageStreams = (sections = []) => {
  const state = {
    pages: [[]],
    pageIndex: 0,
    y: TOP_MARGIN,
  };

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      state.y -= sectionSpacing;
    }

    checkPageBreak({ state, requiredSpace: lineHeight * 2 + sectionSpacing });
    pushTextLine({ state, text: section.title, font: 'F2', size: 17 });
    state.y -= Math.max(4, Math.round(sectionSpacing / 3));

    const rawLines = Array.isArray(section.lines) ? section.lines : [];
    rawLines.forEach((rawLine) => {
      const wrapped = wrapLine(rawLine, DEFAULT_WRAP_WIDTH);
      wrapped.forEach((line) => {
        pushTextLine({ state, text: line, font: 'F1', size: 11 });
      });
    });
  });

  return state.pages.map((commands) => commands.join('\n'));
};

const buildPdfBufferFromStreams = (streams = []) => {
  const pageCount = streams.length;
  const objects = new Map();
  const kids = [];

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');

  streams.forEach((stream, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = 4 + index * 2;
    const length = Buffer.byteLength(stream, 'utf8');

    objects.set(contentObjectId, `<< /Length ${length} >>\nstream\n${stream}\nendstream`);
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${
        3 + pageCount * 2
      } 0 R /F2 ${4 + pageCount * 2} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );

    kids.push(`${pageObjectId} 0 R`);
  });

  objects.set(2, `<< /Type /Pages /Count ${pageCount} /Kids [${kids.join(' ')}] >>`);
  objects.set(3 + pageCount * 2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.set(4 + pageCount * 2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const orderedObjectIds = Array.from(objects.keys()).sort((a, b) => a - b);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  orderedObjectIds.forEach((objectId) => {
    offsets[objectId] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${objectId} 0 obj\n${objects.get(objectId)}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  const maxObjectId = orderedObjectIds[orderedObjectIds.length - 1];

  pdf += `xref\n0 ${maxObjectId + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    const offset = String(offsets[objectId] || 0).padStart(10, '0');
    pdf += `${offset} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const generateAssessmentPdfBuffer = ({ resultSummary }) => {
  const sections = toReportSections({ result: resultSummary || {} });
  const streams = toPageStreams(sections);
  return buildPdfBufferFromStreams(streams);
};

module.exports = {
  generateAssessmentPdfBuffer,
};
