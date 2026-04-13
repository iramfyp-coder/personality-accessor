import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';

const ParticleBackground = ({ reducedMotion = false, particleCount = 180 }) => {
  const pointsRef = useRef(null);
  const safeCount = Math.max(60, Math.min(420, Math.round(Number(particleCount || 180))));

  const { positions, seeds } = useMemo(() => {
    const payload = new Float32Array(safeCount * 3);
    const localSeeds = new Float32Array(safeCount);

    for (let index = 0; index < safeCount; index += 1) {
      const stride = index * 3;
      payload[stride] = (Math.random() - 0.5) * 18;
      payload[stride + 1] = (Math.random() - 0.5) * 12;
      payload[stride + 2] = (Math.random() - 0.5) * 16;
      localSeeds[index] = Math.random() * Math.PI * 2;
    }

    return {
      positions: payload,
      seeds: localSeeds,
    };
  }, [safeCount]);

  useFrame((state, delta) => {
    if (!pointsRef.current || reducedMotion) {
      return;
    }

    const { array } = pointsRef.current.geometry.attributes.position;
    const elapsed = state.clock.elapsedTime;

    for (let index = 0; index < safeCount; index += 1) {
      const stride = index * 3;
      const seed = seeds[index];

      array[stride] += Math.sin(elapsed * 0.35 + seed) * delta * 0.06;
      array[stride + 1] += Math.cos(elapsed * 0.27 + seed) * delta * 0.05;
      array[stride + 2] += Math.sin(elapsed * 0.22 + seed) * delta * 0.03;

      if (array[stride] > 9) array[stride] = -9;
      if (array[stride] < -9) array[stride] = 9;
      if (array[stride + 1] > 6) array[stride + 1] = -6;
      if (array[stride + 1] < -6) array[stride + 1] = 6;
      if (array[stride + 2] > 8) array[stride + 2] = -8;
      if (array[stride + 2] < -8) array[stride + 2] = 8;
    }

    pointsRef.current.rotation.y += delta * 0.024;
    pointsRef.current.rotation.x = Math.sin(elapsed * 0.2) * 0.08;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={safeCount > 220 ? 0.052 : 0.06}
        sizeAttenuation
        color="#7DD3FC"
        transparent
        opacity={safeCount > 220 ? 0.68 : 0.75}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
};

export default ParticleBackground;
