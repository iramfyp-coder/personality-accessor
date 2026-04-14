import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls } from '@react-three/drei';
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
import { selectImage } from '../../services/questionImageEngine';
import tokens from '../../theme/tokens';

const PROFESSIONAL_FALLBACK_IMAGE =
  '/assessment-images/professional-workplace/professional-workplace-01.webp';

const VISUAL_MAP = {
  technical: {
    icon: FiCode,
    accent: tokens.accent.blueGlow,
    softAccent: 'rgba(96, 165, 250, 0.24)',
    icons: [FiCode, FiCpu, FiGrid, FiLayers],
  },
  business: {
    icon: FiBarChart2,
    accent: tokens.accent.cyan,
    softAccent: 'rgba(34, 211, 238, 0.24)',
    icons: [FiBarChart2, FiBriefcase, FiCompass, FiFlag],
  },
  creative: {
    icon: FiFeather,
    accent: tokens.accent.purple,
    softAccent: 'rgba(139, 92, 246, 0.24)',
    icons: [FiFeather, FiCompass, FiLayers, FiActivity],
  },
  leadership: {
    icon: FiUsers,
    accent: tokens.state.success,
    softAccent: 'rgba(52, 211, 153, 0.24)',
    icons: [FiUsers, FiFlag, FiActivity, FiBriefcase],
  },
  general: {
    icon: FiActivity,
    accent: tokens.accent.blue,
    softAccent: 'rgba(96, 165, 250, 0.24)',
    icons: [FiActivity, FiCompass, FiLayers, FiGrid],
  },
};

const inferVisualKey = (question = {}) => {
  const category = String(question?.category || '').toLowerCase();
  const trait = String(question?.trait || question?.traitTarget || '').toLowerCase();

  if (/(software|technical|aptitude|system|code|engineering|analysis|analytic)/.test(category + trait)) {
    return 'technical';
  }

  if (/(business|career|decision|finance|management|strategy)/.test(category + trait)) {
    return 'business';
  }

  if (/(creative|design|innovation|openness)/.test(category + trait)) {
    return 'creative';
  }

  if (/(leadership|team|social|conflict|agreeableness|collaboration)/.test(category + trait)) {
    return 'leadership';
  }

  return 'general';
};

const MiniOrb = ({ color = tokens.accent.blueGlow }) => {
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
  const visualKey = useMemo(() => inferVisualKey(question), [question]);
  const visual = VISUAL_MAP[visualKey] || VISUAL_MAP.general;
  const VisualIcon = visual.icon;

  const floatingRefs = useRef([]);
  const imageFrameRef = useRef(null);
  const imageRef = useRef(null);
  const imageZoomTweenRef = useRef(null);
  const parallaxTweenRef = useRef(null);

  const [imageSrc, setImageSrc] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageMeta, setImageMeta] = useState({ source: '', category: '', keywords: [] });

  useEffect(() => {
    let isMounted = true;

    const resolveImage = async () => {
      setImageLoaded(false);
      try {
        const payload = await selectImage(question || {});
        if (!isMounted) {
          return;
        }

        setImageSrc(payload.url || PROFESSIONAL_FALLBACK_IMAGE);
        setImageMeta({
          source: payload.source || '',
          category: payload.category || '',
          keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setImageSrc(PROFESSIONAL_FALLBACK_IMAGE);
        setImageMeta({ source: 'fallback', category: 'professional-workplace', keywords: [] });
      }
    };

    resolveImage();

    return () => {
      isMounted = false;
    };
  }, [question?.questionId, question?.id, question?.text, question?.trait, question?.category]);

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
    if (!imageFrameRef.current) {
      return () => {};
    }

    gsap.fromTo(
      imageFrameRef.current,
      { autoAlpha: 0, y: 14, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }
    );

    return () => {};
  }, [imageSrc]);

  useEffect(() => {
    if (!imageLoaded || !imageRef.current) {
      return () => {};
    }

    imageZoomTweenRef.current?.kill();
    imageZoomTweenRef.current = gsap.to(imageRef.current, {
      scale: 1.06,
      duration: 4.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    return () => {
      imageZoomTweenRef.current?.kill();
      imageZoomTweenRef.current = null;
    };
  }, [imageLoaded, imageSrc]);

  useEffect(() => {
    if (!imageFrameRef.current || !imageRef.current) {
      return () => {};
    }

    const frameNode = imageFrameRef.current;
    const imageNode = imageRef.current;

    const handleMouseMove = (event) => {
      const rect = frameNode.getBoundingClientRect();
      const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
      const relativeY = (event.clientY - rect.top) / rect.height - 0.5;

      parallaxTweenRef.current?.kill();
      parallaxTweenRef.current = gsap.to(imageNode, {
        x: relativeX * 16,
        y: relativeY * 10,
        duration: 0.8,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      parallaxTweenRef.current?.kill();
      parallaxTweenRef.current = gsap.to(imageNode, {
        x: 0,
        y: 0,
        duration: 0.9,
        ease: 'power2.out',
      });
    };

    frameNode.addEventListener('mousemove', handleMouseMove);
    frameNode.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      frameNode.removeEventListener('mousemove', handleMouseMove);
      frameNode.removeEventListener('mouseleave', handleMouseLeave);
      parallaxTweenRef.current?.kill();
      parallaxTweenRef.current = null;
    };
  }, [imageSrc]);

  return (
    <aside
      className="question-visual-panel"
      style={{
        '--question-visual-accent': visual.accent,
        '--question-visual-soft': visual.softAccent,
      }}
      aria-label="Question context visualization"
    >
      <div className="question-visual-panel__image-frame" ref={imageFrameRef} aria-label="Context image frame">
        {!imageLoaded ? <div className="question-visual-panel__image-loader">Loading context image...</div> : null}

        <img
          ref={imageRef}
          src={imageSrc || PROFESSIONAL_FALLBACK_IMAGE}
          alt="Question context"
          className={`question-visual-panel__image ${imageLoaded ? 'is-ready' : ''}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageLoaded(false);
            setImageSrc(PROFESSIONAL_FALLBACK_IMAGE);
          }}
        />

        <div className="question-visual-panel__image-overlay" aria-hidden="true" />

        <div className="question-visual-panel__image-caption">
          <span className="question-visual-panel__icon" aria-hidden="true">
            <VisualIcon />
          </span>
          <p>
            {imageMeta.category || visualKey} context · {imageMeta.source || 'local'}
          </p>
        </div>
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
    </aside>
  );
};

export default QuestionVisualPanel;
