import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Box3, Euler, MathUtils, Quaternion } from 'three';
import { AVATAR_STATES, resolveClipName } from './AvatarAnimations';

const MODEL_PATH = '/models/mentor-premium.glb';
const DRACO_PATH = '/draco/gltf/';
const STATIC_FALLBACK = '/avatars/analyzer.png';
const BASE_MODEL_HEIGHT_UNITS = 1.6;
const AVATAR_VISUAL_SCALE_FACTOR = 0.75;
const MODEL_BASE_YAW = 0;
const DESKTOP_RIG_POSITION = Object.freeze({ x: 0, y: -1.12 });
const MOBILE_RIG_POSITION = Object.freeze({ x: 0, y: -1.2 });
const DESKTOP_RIG_SCALE = 0.62;
const MOBILE_RIG_SCALE = 0.54;
const CAMERA_POSITION = Object.freeze([0, 0.86, 3.75]);
const CAMERA_LOOK_AT = Object.freeze([0, -0.2, 0]);
const WEAPON_KEYWORDS = ['gun', 'weapon', 'rifle', 'pistol'];

useGLTF.setDecoderPath(DRACO_PATH);

class AvatarCanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}

const supportsWebGL = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const prefersLowPower = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2;
  const lowThreads = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const saveData = navigator.connection?.saveData === true;

  return lowMemory || lowThreads || saveData;
};

const Loader = () => (
  <Html center>
    <div className="avatar-3d-loading">Loading mentor...</div>
  </Html>
);

const findBoneByName = (root, includes = []) => {
  let found = null;
  root.traverse((node) => {
    if (found || !node.isBone) {
      return;
    }

    const lower = String(node.name || '').toLowerCase();
    if (includes.some((value) => lower.includes(value))) {
      found = node;
    }
  });

  return found;
};

const resolveBreathingAmplitude = ({ motionLevel, mobileMode }) => {
  if (motionLevel === 'off') {
    return 0;
  }

  if (motionLevel === 'medium') {
    return mobileMode ? 0.00055 : 0.00095;
  }

  return mobileMode ? 0.00035 : 0.00065;
};

const MentorRig = ({
  avatarState = AVATAR_STATES.IDLE,
  rect,
  mobileMode = false,
  lowPowerMode = false,
  motionLevel = 'low',
  speechTurnSignal = 0,
  onReady,
}) => {
  const { camera, size, clock } = useThree();

  const rigRef = useRef(null);
  const normalizedRootRef = useRef(null);
  const modelRootRef = useRef(null);

  const modelBoxRef = useRef(new Box3());

  const targetQuatRef = useRef(new Quaternion());
  const deltaQuatRef = useRef(new Quaternion());
  const tempEulerRef = useRef(new Euler(0, 0, 0, 'XYZ'));

  const thinkBlendRef = useRef(0);
  const speakingBlendRef = useRef(0);
  const speechTurnProgressRef = useRef(0);

  const { scene, animations } = useGLTF(MODEL_PATH);
  const model = useMemo(() => cloneSkeleton(scene), [scene]);
  const { actions, names, mixer } = useAnimations(animations, modelRootRef);
  const activeActionRef = useRef(null);

  const boneRefs = useRef({
    head: null,
    neck: null,
    shoulderL: null,
    upperArmL: null,
    lowerArmL: null,
    shoulderR: null,
    upperArmR: null,
    lowerArmR: null,
  });

  const baseBoneQuatsRef = useRef(new Map());

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    model.traverse((node) => {
      const lowerName = String(node.name || '').toLowerCase();
      if (WEAPON_KEYWORDS.some((token) => lowerName.includes(token))) {
        node.visible = false;
      }

      if (!node.isMesh) {
        return;
      }

      node.castShadow = !(mobileMode || lowPowerMode);
      node.receiveShadow = !mobileMode;
      node.frustumCulled = false;
    });

    boneRefs.current.head = findBoneByName(model, ['head']);
    boneRefs.current.neck = findBoneByName(model, ['neck']);
    boneRefs.current.shoulderL = findBoneByName(model, ['shoulder.l', 'shoulder_l']);
    boneRefs.current.upperArmL = findBoneByName(model, ['upperarm.l', 'upper_arm.l']);
    boneRefs.current.lowerArmL = findBoneByName(model, ['lowerarm.l', 'forearm.l', 'lower_arm.l']);
    boneRefs.current.shoulderR = findBoneByName(model, ['shoulder.r', 'shoulder_r']);
    boneRefs.current.upperArmR = findBoneByName(model, ['upperarm.r', 'upper_arm.r']);
    boneRefs.current.lowerArmR = findBoneByName(model, ['lowerarm.r', 'forearm.r', 'lower_arm.r']);

    Object.values(boneRefs.current)
      .filter(Boolean)
      .forEach((bone) => {
        baseBoneQuatsRef.current.set(bone.uuid, bone.quaternion.clone());
      });

    if (!normalizedRootRef.current) {
      return;
    }

    modelBoxRef.current.setFromObject(model);
    const box = modelBoxRef.current;
    const height = Math.max(0.0001, box.max.y - box.min.y);
    const centerX = (box.min.x + box.max.x) * 0.5;
    const centerZ = (box.min.z + box.max.z) * 0.5;

    model.position.x -= centerX;
    model.position.y -= box.min.y;
    model.position.z -= centerZ;
    model.rotation.y = MODEL_BASE_YAW;

    const scale = BASE_MODEL_HEIGHT_UNITS / height;
    normalizedRootRef.current.scale.setScalar(scale);
  }, [lowPowerMode, mobileMode, model]);

  useEffect(() => {
    if (!mixer || typeof mixer.stopAllAction !== 'function' || !names.length) {
      return;
    }

    const initialClip = resolveClipName({ state: AVATAR_STATES.IDLE, clipNames: names });
    const initialAction = actions?.[initialClip] || null;

    if (initialAction) {
      initialAction.reset().fadeIn(0.35).play();
      initialAction.setEffectiveTimeScale(0.72);
      activeActionRef.current = initialAction;
    }

    return () => {
      Object.values(actions || {}).forEach((action) => {
        action?.stop();
      });

      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    };
  }, [actions, mixer, model, names]);

  useEffect(() => {
    if (!mixer || typeof mixer.stopAllAction !== 'function' || !names.length) {
      return;
    }

    const clipName = resolveClipName({ state: avatarState, clipNames: names });
    const nextAction = actions?.[clipName] || null;

    if (!nextAction || activeActionRef.current === nextAction) {
      if (nextAction) {
        nextAction.paused = false;
      }
      return;
    }

    const timeScale =
      avatarState === AVATAR_STATES.THINK
        ? 0.66
        : avatarState === AVATAR_STATES.SPEAKING
          ? 0.78
          : avatarState === AVATAR_STATES.CELEBRATE
            ? 0.82
            : 0.72;

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(timeScale);
    nextAction.fadeIn(0.38);
    nextAction.play();

    if (activeActionRef.current) {
      activeActionRef.current.fadeOut(0.32);
    }

    activeActionRef.current = nextAction;
  }, [actions, avatarState, mixer, names]);

  useEffect(() => {
    speechTurnProgressRef.current = 0.0001;
  }, [speechTurnSignal]);

  useFrame((_, delta) => {
    if (!rigRef.current) {
      return;
    }

    if (mixer && typeof mixer.update === 'function') {
      mixer.update(delta);
    }

    const breathingAmplitude = resolveBreathingAmplitude({ motionLevel, mobileMode });
    const breathing = Math.sin(clock.elapsedTime * 0.5) * breathingAmplitude;

    const rigPosition = mobileMode ? MOBILE_RIG_POSITION : DESKTOP_RIG_POSITION;
    rigRef.current.position.x = rigPosition.x;
    rigRef.current.position.y = rigPosition.y + breathing;
    rigRef.current.position.z = 0;
    rigRef.current.scale.setScalar(mobileMode ? MOBILE_RIG_SCALE : DESKTOP_RIG_SCALE);

    const stateAlpha = 1 - Math.exp(-delta * 4.2);
    const thinkTarget = avatarState === AVATAR_STATES.THINK ? 1 : 0;
    const speakingTarget = avatarState === AVATAR_STATES.SPEAKING ? 1 : 0;

    thinkBlendRef.current = MathUtils.lerp(thinkBlendRef.current, thinkTarget, stateAlpha);
    speakingBlendRef.current = MathUtils.lerp(speakingBlendRef.current, speakingTarget, stateAlpha);

    if (speechTurnProgressRef.current > 0) {
      speechTurnProgressRef.current += delta / 0.58;
      if (speechTurnProgressRef.current >= 1) {
        speechTurnProgressRef.current = 0;
      }
    }

    const speechCurve =
      speechTurnProgressRef.current > 0 ? Math.sin(Math.PI * speechTurnProgressRef.current) : 0;
    const speakingCurve = speakingBlendRef.current * speechCurve;

    const { head, neck, shoulderL, upperArmL, lowerArmL, shoulderR, upperArmR, lowerArmR } = boneRefs.current;

    const applyBoneOffset = (bone, x, y, z, influence, damping = 0.14) => {
      if (!bone) {
        return;
      }

      const base = baseBoneQuatsRef.current.get(bone.uuid);
      if (!base) {
        return;
      }

      if (influence > 0.001) {
        tempEulerRef.current.set(x * influence, y * influence, z * influence);
        deltaQuatRef.current.setFromEuler(tempEulerRef.current);
        targetQuatRef.current.copy(base).multiply(deltaQuatRef.current);
      } else {
        targetQuatRef.current.copy(base);
      }

      bone.quaternion.slerp(targetQuatRef.current, damping);
    };

    const thinkPitch = -0.11 * thinkBlendRef.current;
    const thinkRoll = 0.038 * thinkBlendRef.current;
    const speechYaw = 0.045 * speechCurve;
    const speakingNod = -0.016 * speakingCurve;
    const gestureInfluence = speakingBlendRef.current * speechCurve * 0.32;

    applyBoneOffset(neck, thinkPitch * 0.5 + speakingNod * 0.35, speechYaw * 0.5, thinkRoll * 0.18, 1);
    applyBoneOffset(head, thinkPitch + speakingNod, speechYaw, thinkRoll, 1);

    applyBoneOffset(shoulderR, -0.11, 0.06, -0.01, gestureInfluence);
    applyBoneOffset(upperArmR, -0.2, 0.11, -0.02, gestureInfluence);
    applyBoneOffset(lowerArmR, -0.14, 0.07, 0, gestureInfluence);

    applyBoneOffset(shoulderL, 0, 0, 0, 0);
    applyBoneOffset(upperArmL, 0, 0, 0, 0);
    applyBoneOffset(lowerArmL, 0, 0, 0, 0);

    camera.position.set(CAMERA_POSITION[0], CAMERA_POSITION[1], CAMERA_POSITION[2]);
    camera.lookAt(CAMERA_LOOK_AT[0], CAMERA_LOOK_AT[1], CAMERA_LOOK_AT[2]);
  });

  return (
    <group ref={rigRef} position={[-1.24, -1.08, 0]} scale={[0.34, 0.34, 0.34]}>
      <group ref={normalizedRootRef}>
        <group ref={modelRootRef}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
};

const Avatar3D = ({ avatarState, rect, mobileMode = false, motionLevel = 'low', speechTurnSignal = 0 }) => {
  const [canRender3D, setCanRender3D] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    setCanRender3D(supportsWebGL());
    setLowPowerMode(prefersLowPower());
    setRenderFailed(false);
    setModelReady(false);
  }, []);

  if (!canRender3D || renderFailed) {
    return (
      <img
        className="avatar-3d-fallback-image"
        src={STATIC_FALLBACK}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: '100%',
        }}
      />
    );
  }

  return (
    <div className="avatar-overlay-canvas" aria-hidden="true">
      {!modelReady ? (
        <img
          className="avatar-3d-fallback-image"
          src={STATIC_FALLBACK}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
          }}
        />
      ) : null}

      <AvatarCanvasErrorBoundary
        fallback={null}
        onError={() => setRenderFailed(true)}
        resetKey={`${mobileMode}-${lowPowerMode}-${avatarState}-${motionLevel}`}
      >
        <Canvas
          dpr={mobileMode || lowPowerMode ? 1 : [1, 1.8]}
          camera={{ position: CAMERA_POSITION, fov: 50, near: 0.1, far: 100 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          shadows={!(mobileMode || lowPowerMode)}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
          style={{ pointerEvents: 'none' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight
            intensity={0.7}
            position={[1.8, 4.8, 2.6]}
            castShadow={!(mobileMode || lowPowerMode)}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={0.5}
            shadow-camera-far={20}
            shadow-camera-left={-3.5}
            shadow-camera-right={3.5}
            shadow-camera-top={3.5}
            shadow-camera-bottom={-3.5}
          />

          <Suspense fallback={<Loader />}>
            <MentorRig
              avatarState={avatarState}
              rect={rect}
              mobileMode={mobileMode}
              lowPowerMode={lowPowerMode}
              motionLevel={motionLevel}
              speechTurnSignal={speechTurnSignal}
              onReady={() => setModelReady(true)}
            />
          </Suspense>

          {!(mobileMode || lowPowerMode) ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
              <circleGeometry args={[0.24, 36]} />
              <shadowMaterial opacity={0.14} transparent />
            </mesh>
          ) : null}
        </Canvas>
      </AvatarCanvasErrorBoundary>
    </div>
  );
};

useGLTF.preload(MODEL_PATH);

export default Avatar3D;
