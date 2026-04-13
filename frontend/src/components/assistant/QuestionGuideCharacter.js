import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Float,
  Html,
  OrbitControls,
  RoundedBox,
  useAnimations,
  useGLTF,
} from '@react-three/drei';
import { MathUtils } from 'three';
import { FiActivity, FiAperture, FiGrid, FiHeart, FiZap } from 'react-icons/fi';

const MODEL_PATH = '/models/character.glb';

const traitPersona = {
  O: {
    icon: FiAperture,
    label: 'Creative lens active',
    tone: '#A855F7',
    helper: 'Lean into curiosity. Pick what feels most natural right now.',
  },
  C: {
    icon: FiGrid,
    label: 'Structure guide active',
    tone: '#3B82F6',
    helper: 'Think about routines and follow-through in your recent behavior.',
  },
  E: {
    icon: FiZap,
    label: 'Energy guide active',
    tone: '#FACC15',
    helper: 'Focus on social energy and how often you seek interaction.',
  },
  A: {
    icon: FiHeart,
    label: 'Empathy guide active',
    tone: '#22C55E',
    helper: 'Consider how you respond when collaboration gets difficult.',
  },
  N: {
    icon: FiActivity,
    label: 'Stability guide active',
    tone: '#EF4444',
    helper: 'Think about emotional reactions under stress and uncertainty.',
  },
};

const supportsWebGL = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');

    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl'))
    );
  } catch (error) {
    return false;
  }
};

class MascotErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // no-op: fallback UI is shown for any WebGL/model runtime issue.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const SceneLoader = () => (
  <Html center>
    <div className="question-guide__canvas-loading">Loading 3D assistant...</div>
  </Html>
);

const ModelAndCard = ({
  reducedMotion,
  questionIndex,
  selectionSignal,
}) => {
  const rigRef = useRef(null);
  const cardRef = useRef(null);
  const modelRootRef = useRef(null);

  const { scene, animations } = useGLTF(MODEL_PATH);
  const modelScene = useMemo(() => scene.clone(true), [scene]);
  const { actions, names } = useAnimations(animations, modelRootRef);

  const questionPulse = useRef(0);
  const selectionPulse = useRef(0);

  useEffect(() => {
    questionPulse.current = 1;
  }, [questionIndex]);

  useEffect(() => {
    if (selectionSignal) {
      selectionPulse.current = 1;
    }
  }, [selectionSignal]);

  useEffect(() => {
    if (reducedMotion) {
      Object.values(actions || {}).forEach((action) => {
        if (action) {
          action.stop();
        }
      });
      return;
    }

    const preferredClipName =
      names.find((name) => /idle|breath|standing|look|gesture/i.test(name)) ||
      names[0];

    const clip = preferredClipName ? actions?.[preferredClipName] : null;

    if (clip) {
      clip.reset();
      clip.fadeIn(0.24);
      clip.play();
      clip.timeScale = 0.82;
    }

    return () => {
      if (clip) {
        clip.fadeOut(0.2);
      }
    };
  }, [actions, names, reducedMotion]);

  useFrame((state, delta) => {
    if (!rigRef.current || reducedMotion) {
      return;
    }

    questionPulse.current = Math.max(0, questionPulse.current - delta * 1.9);
    selectionPulse.current = Math.max(0, selectionPulse.current - delta * 2.3);

    const elapsed = state.clock.elapsedTime;
    const idleFloat = Math.sin(elapsed * 1.3) * 0.06;
    const breathing = 1 + Math.sin(elapsed * 1.7) * 0.015;

    const questionBounce =
      Math.sin((1 - questionPulse.current) * Math.PI * 3.2) *
      questionPulse.current *
      0.14;

    const selectionBounce =
      Math.sin((1 - selectionPulse.current) * Math.PI * 4) *
      selectionPulse.current *
      0.1;

    rigRef.current.position.y = -0.92 + idleFloat + questionBounce + selectionBounce;
    rigRef.current.rotation.x = MathUtils.lerp(
      rigRef.current.rotation.x,
      Math.sin(elapsed * 0.9) * 0.03,
      0.09
    );
    rigRef.current.rotation.y = MathUtils.lerp(
      rigRef.current.rotation.y,
      -0.5 + Math.sin(elapsed * 0.65) * 0.08,
      0.09
    );
    rigRef.current.scale.setScalar(breathing);

    if (cardRef.current) {
      cardRef.current.rotation.z = Math.sin(elapsed * 1.2) * 0.03;
      cardRef.current.position.y = -0.1 + Math.sin(elapsed * 1.4 + 0.2) * 0.025;
    }
  });

  return (
    <group>
      <group ref={rigRef}>
        <group ref={modelRootRef}>
          <primitive object={modelScene} scale={1.22} position={[0, -1.1, 0]} />
        </group>
      </group>

      <group ref={cardRef} position={[1.1, -0.1, 0.35]} rotation={[0.08, -0.58, 0.04]}>
        <RoundedBox args={[1.3, 0.8, 0.05]} radius={0.06} smoothness={6}>
          <meshStandardMaterial
            color="#101b31"
            roughness={0.36}
            metalness={0.08}
            emissive="#0f223f"
            emissiveIntensity={0.22}
          />
        </RoundedBox>

        <mesh position={[-0.1, 0.22, 0.03]}>
          <boxGeometry args={[0.8, 0.08, 0.01]} />
          <meshBasicMaterial color="#8ad8ff" transparent opacity={0.8} />
        </mesh>
        <mesh position={[-0.14, 0.06, 0.03]}>
          <boxGeometry args={[0.86, 0.06, 0.01]} />
          <meshBasicMaterial color="#69b9ee" transparent opacity={0.76} />
        </mesh>
        <mesh position={[-0.18, -0.08, 0.03]}>
          <boxGeometry args={[0.9, 0.06, 0.01]} />
          <meshBasicMaterial color="#69b9ee" transparent opacity={0.7} />
        </mesh>
      </group>

      <mesh position={[0.96, -0.28, 0.15]} rotation={[0.15, 0, -0.92]}>
        <cylinderGeometry args={[0.05, 0.05, 0.56, 16]} />
        <meshStandardMaterial
          color="#6fd7ff"
          emissive="#3cb4f2"
          emissiveIntensity={0.22}
          roughness={0.28}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
};

const MascotCanvas = ({ reducedMotion, questionIndex, selectionSignal }) => (
  <div className="question-guide__scene" role="img" aria-label="3D mascot presenting question card">
    <Canvas
      dpr={[1, 1.45]}
      camera={{ position: [0.15, 0.18, 4.15], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.86} />
      <directionalLight intensity={1.05} position={[2.4, 3.2, 2.6]} />
      <pointLight intensity={0.8} position={[-2.1, 1.2, 1.6]} color="#22D3EE" />
      <pointLight intensity={0.58} position={[2.3, -0.8, 1.8]} color="#A855F7" />

      <Suspense fallback={<SceneLoader />}>
        <Float
          speed={reducedMotion ? 0 : 1.26}
          rotationIntensity={reducedMotion ? 0 : 0.08}
          floatIntensity={reducedMotion ? 0 : 0.28}
        >
          <ModelAndCard
            reducedMotion={reducedMotion}
            questionIndex={questionIndex}
            selectionSignal={selectionSignal}
          />
        </Float>
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={!reducedMotion}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 1.75}
        minAzimuthAngle={-0.42}
        maxAzimuthAngle={0.52}
      />
    </Canvas>
  </div>
);

const MascotFallback = ({ profile, hasSelection }) => {
  const Icon = profile.icon;

  return (
    <div className="question-guide__fallback" role="img" aria-label="Static assistant">
      <span className="question-guide__fallback-emoji">🤖</span>
      <p>{hasSelection ? 'Great choice. Ready for the next one.' : 'Let\'s answer this one.'}</p>
      <span className="question-guide__fallback-tag">
        <Icon />
        {profile.label}
      </span>
    </div>
  );
};

const QuestionGuideCharacter = ({
  trait = 'O',
  questionIndex = 0,
  hasSelection = false,
  selectionSignal = 0,
  className = '',
}) => {
  const controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const [canRender3D, setCanRender3D] = useState(true);

  const profile = useMemo(() => traitPersona[trait] || traitPersona.O, [trait]);
  const Icon = profile.icon;

  useEffect(() => {
    setCanRender3D(supportsWebGL());
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    controls.start({
      y: [0, -6, 0],
      rotate: [0, -1.2, 1.2, 0],
      transition: {
        duration: 0.7,
        ease: 'easeOut',
      },
    });
  }, [controls, prefersReducedMotion, questionIndex]);

  useEffect(() => {
    if (prefersReducedMotion || !selectionSignal) {
      return;
    }

    controls.start({
      scale: [1, 1.04, 1],
      y: [0, -8, 0],
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    });
  }, [controls, prefersReducedMotion, selectionSignal]);

  return (
    <motion.aside
      className={`question-guide ${className}`.trim()}
      style={{ '--guide-tone': profile.tone }}
      animate={controls}
      initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
      aria-live="polite"
    >
      <div className="question-guide__stage">
        {canRender3D ? (
          <MascotErrorBoundary fallback={<MascotFallback profile={profile} hasSelection={hasSelection} />}>
            <MascotCanvas
              reducedMotion={prefersReducedMotion}
              questionIndex={questionIndex}
              selectionSignal={selectionSignal}
            />
          </MascotErrorBoundary>
        ) : (
          <MascotFallback profile={profile} hasSelection={hasSelection} />
        )}

        <motion.p
          className="question-guide__speech"
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [0, -2, 0],
                }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: 2.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
        >
          {hasSelection ? 'Nice answer. Let\'s keep going 👇' : 'Let\'s answer this one 👇'}
        </motion.p>
      </div>

      <div className="question-guide__copy">
        <span className="question-guide__tag">
          <Icon />
          {profile.label}
        </span>
        <p>{profile.helper}</p>
      </div>
    </motion.aside>
  );
};

useGLTF.preload(MODEL_PATH);

export default QuestionGuideCharacter;
