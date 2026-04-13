import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { AdditiveBlending, CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import mapTraitsTo3DData from '../../utils/traitMapper';
import { TRAIT_META } from '../../utils/traits';
import { traitColors } from '../../theme/colors';
import ParticleBackground from './ParticleBackground';
import { sanitizeChartValue } from '../../utils/chartSafety';

const TRAIT_COLORS = traitColors;

const TRAIT_DETAILS = {
  O: 'Openness: curiosity, novelty-seeking, and abstract thinking preferences.',
  C: 'Conscientiousness: planning discipline, reliability, and execution consistency.',
  E: 'Extraversion: social energy, assertiveness, and communication intensity.',
  A: 'Agreeableness: empathy, cooperation style, and conflict posture.',
  N: 'Neuroticism: emotional reactivity and stress sensitivity in uncertainty.',
};

const toNodePoints = (data) => {
  const payload = Array.isArray(data?.coordinates) ? data : mapTraitsTo3DData(data || {});

  return (payload.coordinates || []).map((point) => ({
    trait: point.trait,
    x: Number.isFinite(Number(point.x)) ? Number(point.x) * 3 : 0,
    y: Number.isFinite(Number(point.y)) ? Number(point.y) * 3 : 0,
    z: Number.isFinite(Number(point.z)) ? Number(point.z) * 3 : 0,
    score: sanitizeChartValue(payload?.traits?.[point.trait] || 0),
  }));
};

const tooltipStyle = {
  padding: '0.45rem 0.6rem',
  borderRadius: '10px',
  background: 'rgba(11, 15, 26, 0.93)',
  border: '1px solid rgba(126, 153, 212, 0.4)',
  color: '#dce8ff',
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
};

class TraitSphereErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Rendering fallback UI for any 3D runtime issue.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const SmoothTraitShape = ({ points }) => {
  const curvePoints = useMemo(() => {
    const vectors = points.map((point) => new Vector3(point.x, point.y, point.z));
    vectors.push(vectors[0]?.clone() || new Vector3(0, 0, 0));
    const curve = new CatmullRomCurve3(vectors, true, 'catmullrom', 0.16);

    return curve.getPoints(128).map((point) => [point.x, point.y, point.z]);
  }, [points]);

  return (
    <Line
      points={curvePoints}
      color="#9FB9FF"
      lineWidth={2.5}
      transparent
      opacity={0.92}
    />
  );
};

const TraitGraph = ({
  points,
  hoveredTrait,
  onHover,
  onSelect,
  reducedMotion = false,
  opennessScore = 50,
}) => {
  const groupRef = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    pulseRef.current = 1;
  }, [points]);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    if (reducedMotion) {
      return;
    }

    const targetY = groupRef.current.rotation.y + delta * 0.12;
    const targetX = Math.sin(state.clock.elapsedTime * 0.26) * 0.09;
    const opennessScaleTarget = 1 + MathUtils.clamp(Number(opennessScore || 50), 0, 100) / 260;

    groupRef.current.rotation.y = MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.12);
    groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.12);
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.14;

    pulseRef.current = Math.max(0, pulseRef.current - delta * 1.3);
    const pulse = 1 + pulseRef.current * 0.08;
    groupRef.current.scale.x = MathUtils.lerp(groupRef.current.scale.x, opennessScaleTarget * pulse, 0.12);
    groupRef.current.scale.y = MathUtils.lerp(groupRef.current.scale.y, pulse, 0.1);
    groupRef.current.scale.z = MathUtils.lerp(groupRef.current.scale.z, pulse, 0.1);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2.6, 56, 56]} />
        <meshStandardMaterial
          color="#1D4ED8"
          wireframe
          transparent
          opacity={0.08}
          emissive="#1D4ED8"
          emissiveIntensity={0.45}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.88, 44, 44]} />
        <meshBasicMaterial
          color="#6EA8FF"
          transparent
          opacity={0.08}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <SmoothTraitShape points={points} />

      {points.map((point) => (
        <Line
          key={`${point.trait}-axis`}
          points={[
            [0, 0, 0],
            [point.x, point.y, point.z],
          ]}
          color={TRAIT_COLORS[point.trait]}
          transparent
          opacity={0.46}
        />
      ))}

      {points.map((point) => {
        const isHovered = hoveredTrait === point.trait;
        const nodeSize = 0.13 + point.score / 650;

        return (
          <group key={point.trait} position={[point.x, point.y, point.z]}>
            <mesh
              onPointerOver={(event) => {
                event.stopPropagation();
                onHover(point.trait);
              }}
              onPointerOut={(event) => {
                event.stopPropagation();
                onHover(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(point.trait);
              }}
            >
              <sphereGeometry args={[nodeSize, 26, 26]} />
              <meshStandardMaterial
                color={TRAIT_COLORS[point.trait]}
                emissive={TRAIT_COLORS[point.trait]}
                emissiveIntensity={isHovered ? 2.2 : 1.25}
                metalness={0.18}
                roughness={0.26}
              />
            </mesh>

            <mesh>
              <sphereGeometry args={[nodeSize * 1.95, 18, 18]} />
              <meshBasicMaterial
                color={TRAIT_COLORS[point.trait]}
                transparent
                opacity={isHovered ? 0.32 : 0.16}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>

            <Html distanceFactor={8} position={[0, 0.35, 0]} center>
              <div className="trait-sphere__label">{point.trait}</div>
            </Html>

            {isHovered && (
              <Html distanceFactor={8} position={[0, 0.7, 0]} center>
                <div style={tooltipStyle}>
                  {TRAIT_META[point.trait]?.label}: {Math.round(point.score)}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

const TraitSphere = ({ data }) => {
  const points = useMemo(() => toNodePoints(data), [data]);
  const [hoveredTrait, setHoveredTrait] = useState(null);
  const [selectedTrait, setSelectedTrait] = useState(points[0]?.trait || 'O');
  const [reducedMotion, setReducedMotion] = useState(false);
  const opennessScore = Number(data?.traits?.O || 50);
  const extraversionScore = Number(data?.traits?.E || 50);
  const particleCount = Math.round(120 + MathUtils.clamp(extraversionScore, 0, 100) * 1.4);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(Boolean(motionMedia.matches));

    updateMotion();
    motionMedia.addEventListener('change', updateMotion);
    return () => motionMedia.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    if (!points.some((point) => point.trait === selectedTrait)) {
      setSelectedTrait(points[0]?.trait || 'O');
    }
  }, [points, selectedTrait]);

  const selectedScore = useMemo(
    () => points.find((point) => point.trait === selectedTrait)?.score || 0,
    [points, selectedTrait]
  );

  if (!points.length) {
    return <p className="empty-state">No trait data is available for 3D visualization.</p>;
  }

  return (
    <div className="trait-sphere">
      <TraitSphereErrorBoundary
        fallback={<p className="empty-state">3D view is unavailable right now. Trait chart data is still valid.</p>}
      >
        <div className="trait-sphere__canvas" role="img" aria-label="3D personality visualization">
          <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 1.7]}>
            <color attach="background" args={['#080C15']} />
            <fog attach="fog" args={['#080C15', 5.8, 12]} />

            <ambientLight intensity={0.52} />
            <directionalLight intensity={1.3} position={[4, 5, 4]} />
            <pointLight intensity={0.95} position={[-4, -3, -5]} color="#38BDF8" />
            <pointLight intensity={0.7} position={[5, -2, 2]} color="#A855F7" />

            <ParticleBackground reducedMotion={reducedMotion} particleCount={particleCount} />

            <TraitGraph
              points={points}
              hoveredTrait={hoveredTrait}
              onHover={setHoveredTrait}
              onSelect={setSelectedTrait}
              reducedMotion={reducedMotion}
              opennessScore={opennessScore}
            />

            <OrbitControls
              enablePan={false}
              enableDamping
              dampingFactor={0.06}
              minDistance={3.3}
              maxDistance={8.8}
            />
          </Canvas>
        </div>
      </TraitSphereErrorBoundary>

      <div className="trait-sphere__details">
        <p className="trait-sphere__detail-title">
          {TRAIT_META[selectedTrait]?.label} ({selectedTrait})
        </p>
        <p className="trait-sphere__detail-score">Score: {Math.round(selectedScore)}/100</p>
        <p className="trait-sphere__detail-copy">{TRAIT_DETAILS[selectedTrait]}</p>
        <p className="trait-sphere__hint">Hover for quick trait tooltips. Click a node to pin detail.</p>
      </div>
    </div>
  );
};

export default TraitSphere;
