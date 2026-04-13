import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls } from '@react-three/drei';
import Lottie from 'lottie-react';
import {
  FiActivity,
  FiBarChart2,
  FiBriefcase,
  FiCode,
  FiCompass,
  FiCpu,
  FiFeather,
  FiFlag,
  FiGrid,
  FiLayers,
  FiUsers,
} from 'react-icons/fi';
import { gsap } from 'gsap';

const PULSE_LOTTIE = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 120,
  w: 200,
  h: 200,
  nm: 'Pulse Ring',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Outer Ring',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 120, s: [360] },
          ],
        },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [74, 74, 100] },
            { t: 60, s: [100, 100, 100] },
            { t: 120, s: [74, 74, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [132, 132] }, nm: 'Path' },
            {
              ty: 'st',
              c: { a: 0, k: [0.14, 0.82, 0.95, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
              lc: 2,
              lj: 2,
              nm: 'Stroke',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform',
            },
          ],
          nm: 'Group',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Core Dot',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [45] },
            { t: 60, s: [95] },
            { t: 120, s: [45] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100] },
            { t: 60, s: [140, 140, 100] },
            { t: 120, s: [100, 100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [42, 42] }, nm: 'Path' },
            {
              ty: 'fl',
              c: { a: 0, k: [0.55, 0.44, 0.99, 1] },
              o: { a: 0, k: 100 },
              r: 1,
              bm: 0,
              nm: 'Fill',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform',
            },
          ],
          nm: 'Group',
        },
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0,
    },
  ],
};

const VISUAL_MAP = {
  technical: {
    icon: FiCode,
    title: 'Technical Decision Lens',
    subtitle: 'Thinking about systems, constraints, and execution quality.',
    accent: '#38BDF8',
    softAccent: 'rgba(56, 189, 248, 0.24)',
    icons: [FiCode, FiCpu, FiGrid, FiLayers],
  },
  business: {
    icon: FiBarChart2,
    title: 'Business Strategy Lens',
    subtitle: 'Balancing outcomes, priorities, and trade-offs under pressure.',
    accent: '#22D3EE',
    softAccent: 'rgba(34, 211, 238, 0.24)',
    icons: [FiBarChart2, FiBriefcase, FiCompass, FiFlag],
  },
  creative: {
    icon: FiFeather,
    title: 'Creative Synthesis Lens',
    subtitle: 'Exploring novelty while keeping ideas practical and useful.',
    accent: '#A78BFA',
    softAccent: 'rgba(167, 139, 250, 0.24)',
    icons: [FiFeather, FiCompass, FiLayers, FiActivity],
  },
  leadership: {
    icon: FiUsers,
    title: 'Leadership Impact Lens',
    subtitle: 'Reading ownership, influence, and decision confidence in teams.',
    accent: '#34D399',
    softAccent: 'rgba(52, 211, 153, 0.24)',
    icons: [FiUsers, FiFlag, FiActivity, FiBriefcase],
  },
  general: {
    icon: FiActivity,
    title: 'Adaptive Intelligence Lens',
    subtitle: 'Measuring patterns that shape personality and career fit.',
    accent: '#60A5FA',
    softAccent: 'rgba(96, 165, 250, 0.24)',
    icons: [FiActivity, FiCompass, FiLayers, FiGrid],
  },
};

const VISUAL_IMAGE_FILES = {
  technical: 'technical-context.svg',
  business: 'business-context.svg',
  creative: 'creative-context.svg',
  leadership: 'leadership-context.svg',
  general: 'general-context.svg',
};

const toDataUri = (svgMarkup) => `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;

const buildFallbackImageDataUri = ({ visualKey = 'general', visual = VISUAL_MAP.general }) => {
  const title = String(visual?.title || 'Context Frame');
  const accent = String(visual?.accent || '#60A5FA');
  const subtitle = String(visualKey || 'general').toUpperCase();

  return toDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f1b32"/>
      <stop offset="100%" stop-color="#091224"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.55">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="420" rx="20" fill="url(#bg)"/>
  <rect width="800" height="420" rx="20" fill="url(#glow)"/>
  <rect x="38" y="34" width="724" height="352" rx="18" fill="none" stroke="${accent}" stroke-opacity="0.35"/>
  <circle cx="130" cy="120" r="30" fill="${accent}" fill-opacity="0.22"/>
  <circle cx="690" cy="300" r="46" fill="${accent}" fill-opacity="0.16"/>
  <path d="M100 278 L235 170 L358 226 L480 132 L632 246" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-opacity="0.75"/>
  <circle cx="235" cy="170" r="9" fill="${accent}"/>
  <circle cx="358" cy="226" r="9" fill="${accent}"/>
  <circle cx="480" cy="132" r="9" fill="${accent}"/>
  <circle cx="632" cy="246" r="9" fill="${accent}"/>
  <text x="72" y="74" fill="#d8ecff" font-size="26" font-family="Arial, sans-serif" font-weight="700">${title}</text>
  <text x="72" y="104" fill="#9fbcdf" font-size="15" font-family="Arial, sans-serif" letter-spacing="1.5">${subtitle} CONTEXT VISUAL</text>
</svg>`);
};

const inferVisualKey = (question = {}) => {
  const category = String(question?.category || '').toLowerCase();
  const trait = String(question?.trait || question?.traitTarget || '').toLowerCase();

  if (/(software|technical|aptitude|system|code|engineering)/.test(category + trait)) {
    return 'technical';
  }

  if (/(business|career|decision|finance|management|strategy)/.test(category + trait)) {
    return 'business';
  }

  if (/(creative|design|innovation|openness)/.test(category + trait)) {
    return 'creative';
  }

  if (/(leadership|team|social|conflict|agreeableness)/.test(category + trait)) {
    return 'leadership';
  }

  return 'general';
};

const MiniOrb = ({ color = '#38BDF8' }) => {
  const orbRef = useRef(null);

  useFrame(({ clock }) => {
    if (!orbRef.current) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    orbRef.current.rotation.y = elapsed * 0.5;
    orbRef.current.rotation.x = Math.sin(elapsed * 0.7) * 0.2;
  });

  return (
    <group ref={orbRef}>
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={0.6}>
        <mesh>
          <icosahedronGeometry args={[1.1, 1]} />
          <meshStandardMaterial color={color} wireframe transparent opacity={0.7} />
        </mesh>
      </Float>
      <mesh>
        <sphereGeometry args={[0.68, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} roughness={0.3} />
      </mesh>
    </group>
  );
};

const QuestionVisualPanel = ({ question }) => {
  const floatingRefs = useRef([]);
  const publicBasePath = useMemo(() => {
    const baseUrl = String(import.meta?.env?.BASE_URL || '').trim();
    if (!baseUrl || baseUrl === '/') {
      return '';
    }

    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }, []);

  const visualKey = useMemo(() => inferVisualKey(question), [question]);
  const visual = VISUAL_MAP[visualKey] || VISUAL_MAP.general;
  const VisualIcon = visual.icon;
  const primaryImageSrc = useMemo(
    () => `${publicBasePath}/visuals/${VISUAL_IMAGE_FILES[visualKey] || VISUAL_IMAGE_FILES.general}`,
    [publicBasePath, visualKey]
  );
  const fallbackImageSrc = useMemo(
    () => buildFallbackImageDataUri({ visualKey, visual }),
    [visualKey, visual]
  );
  const [imageSrc, setImageSrc] = useState(primaryImageSrc);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const refs = floatingRefs.current.filter(Boolean);

    if (!refs.length) {
      return () => {};
    }

    const timeline = gsap.timeline({ repeat: -1, yoyo: true });

    refs.forEach((node, index) => {
      timeline.to(
        node,
        {
          y: index % 2 === 0 ? -10 : -6,
          rotate: index % 2 === 0 ? 8 : -8,
          duration: 1.9 + index * 0.22,
          ease: 'sine.inOut',
        },
        index * 0.08
      );
    });

    return () => timeline.kill();
  }, [visualKey]);

  useEffect(() => {
    setImageLoaded(false);
    setImageSrc(primaryImageSrc);
  }, [primaryImageSrc]);

  return (
    <aside
      className="question-visual-panel"
      style={{
        '--question-visual-accent': visual.accent,
        '--question-visual-soft': visual.softAccent,
      }}
      aria-label="Question context visualization"
    >
      <header className="question-visual-panel__head">
        <span className="question-visual-panel__icon" aria-hidden="true">
          <VisualIcon />
        </span>
        <div>
          <p className="question-visual-panel__kicker">Context Frame</p>
          <h3>{visual.title}</h3>
        </div>
      </header>

      <p className="question-visual-panel__subtitle">{visual.subtitle}</p>

      <div className="question-visual-panel__image-frame" aria-label="Context image frame">
        {!imageLoaded ? (
          <div className="question-visual-panel__image-loader">Loading context image...</div>
        ) : null}
        <img
          src={imageSrc}
          alt={`${visual.title} context illustration`}
          className={`question-visual-panel__image ${imageLoaded ? 'is-ready' : ''}`}
          loading="eager"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (imageSrc !== fallbackImageSrc) {
              setImageLoaded(false);
              setImageSrc(fallbackImageSrc);
              return;
            }

            setImageLoaded(true);
          }}
        />
      </div>

      <div className="question-visual-panel__lottie" aria-hidden="true">
        <Lottie animationData={PULSE_LOTTIE} loop autoplay />
      </div>

      <div className="question-visual-panel__canvas" aria-hidden="true">
        <Canvas camera={{ position: [0, 0, 3.6], fov: 48 }} dpr={[1, 1.35]}>
          <ambientLight intensity={0.62} />
          <directionalLight intensity={1.2} position={[2.8, 3.5, 2.1]} />
          <pointLight intensity={0.75} color={visual.accent} position={[-2.2, -1.4, -2.3]} />
          <MiniOrb color={visual.accent} />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.1} />
        </Canvas>
      </div>

      <div className="question-visual-panel__chips" aria-hidden="true">
        {visual.icons.map((IconComponent, index) => (
          <span
            key={`${visualKey}-chip-${index}`}
            ref={(node) => {
              floatingRefs.current[index] = node;
            }}
            className="question-visual-chip"
          >
            <IconComponent />
          </span>
        ))}
      </div>

      <p className="question-visual-panel__meta">
        Trait Focus: <strong>{String(question?.trait || question?.traitTarget || 'Adaptive').replace(/_/g, ' ')}</strong>
      </p>
    </aside>
  );
};

export default QuestionVisualPanel;
