import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import {
  AnimationMixer,
  AnimationClip,
  QuaternionKeyframeTrack,
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  Quaternion,
  SkinnedMesh,
  Vector3,
  LoopOnce,
  LoopRepeat,
} from "three";
import type { AnimationAction, Bone, Object3D } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Action } from "../types";

type Props = {
  action: Action;
  night: boolean;
  reduced: boolean;
  onTouch: () => void;
  onReady: (ready: boolean) => void;
  reset: number;
};

class ModelBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function Lighting({ night }: { night: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.06);
    scene.environment = target.texture;
    scene.environmentIntensity = night ? 0.7 : 1;
    return () => {
      scene.environment = null;
      room.dispose();
      target.dispose();
      generator.dispose();
    };
  }, [gl, scene, night]);
  return (
    <>
      <ambientLight intensity={night ? 0.5 : 0.8} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={night ? 2 : 3}
        color={night ? "#a8bcf0" : "#fff4e6"}
      />
      <directionalLight
        position={[-3, 2, -2]}
        intensity={night ? 3 : 2}
        color="#c7d8fc"
      />
    </>
  );
}
function Pod({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.position.y =
        1.52 + (reduced ? 0 : Math.sin(clock.elapsedTime * 1.6) * 0.035);
      group.current.rotation.y = reduced
        ? 0
        : Math.sin(clock.elapsedTime * 0.55) * 0.1;
    }
  });
  return (
    <group ref={group} position={[0.7, 1.52, -0.12]}>
      <mesh>
        <boxGeometry args={[0.14, 0.21, 0.13]} />
        <meshStandardMaterial
          color="#8a919a"
          metalness={0.65}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[0, 0.06, 0.075]}>
        <boxGeometry args={[0.1, 0.012, 0.015]} />
        <meshStandardMaterial
          color="#6eacc2"
          emissive="#6eacc2"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.18, 0.024, 0.15]} />
        <meshStandardMaterial
          color="#bec3c6"
          metalness={0.55}
          roughness={0.32}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.09, -0.08, 0]}
          rotation={[0, 0, side * 0.12]}
        >
          <mesh>
            <boxGeometry args={[0.015, 0.16, 0.02]} />
            <meshStandardMaterial color="#969ea6" metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.09, 0.03]}>
            <boxGeometry args={[0.045, 0.026, 0.06]} />
            <meshStandardMaterial color="#747c84" metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Character({
  action,
  reduced,
  onTouch,
  onReady,
}: Pick<Props, "action" | "reduced" | "onTouch" | "onReady">) {
  const asset = useGLTF("/models/2b.glb");
  const motion = useGLTF("/models/motion.glb");
  const outer = useRef<Group>(null);
  const started = useRef(0);
  const current = useRef<AnimationAction | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const prepared = useMemo(() => {
    const model = clone(asset.scene);
    let targetSkin: SkinnedMesh | undefined;
    model.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh && !targetSkin)
        targetSkin = o as SkinnedMesh;
      if ((o as Mesh).isMesh) {
        const mesh = o as Mesh;
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        const list = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        if (list.some((m) => m.name === "Material.001")) {
          mesh.geometry = mesh.geometry.clone();
          mesh.geometry.translate(0, -12.5, 0);
        }
        mesh.material = list.map((material) => {
          const copy = material.clone() as MeshStandardMaterial;
          if (copy.isMeshStandardMaterial) {
            copy.roughness = Math.max(0.38, copy.roughness);
            copy.metalness = Math.min(0.15, copy.metalness);
            if (copy.map) copy.map.anisotropy = 4;
          }
          return copy;
        });
        if (!Array.isArray((o as Mesh).material) || list.length === 1)
          mesh.material = (mesh.material as MeshStandardMaterial[])[0];
      }
    });
    if (!targetSkin) throw new Error("Squelette du personnage absent.");
    const importedHelpers: Object3D[] = [];
    model.traverse((o) => {
      if (
        "isLight" in o ||
        "isCamera" in o ||
        ((o as Mesh).isMesh && !(o as SkinnedMesh).isSkinnedMesh)
      )
        importedHelpers.push(o);
    });
    importedHelpers.forEach((o) => o.removeFromParent());
    model.updateMatrixWorld(true);
    const canonical = (value: string) =>
      value
        .replace(/_\d+$/, "")
        .replace(/[^a-z]/gi, "")
        .toLowerCase();
    // Rebase motion around its first idle pose. This preserves this model’s own
    // bind pose, scale and proportions instead of copying the source’s root transforms.
    const idleClip = motion.animations.find((c) => c.name === "idle")!;
    const sourceBaseline = new Map(
      idleClip.tracks
        .filter((t) => t.name.endsWith(".quaternion"))
        .map((t) => [
          canonical(t.name.slice(0, -11)),
          new Quaternion().fromArray(t.values),
        ]),
    );
    for (const bone of targetSkin.skeleton.bones) {
      if (canonical(bone.name) === "mixamorigrightarm")
        bone.quaternion.multiply(
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.22),
        );
      if (canonical(bone.name) === "mixamorigleftarm")
        bone.quaternion.multiply(
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.22),
        );
    }
    const clips: Record<string, AnimationClip> = {};
    for (const clip of motion.animations.filter((c) =>
      ["idle", "agree", "walk", "sad_pose"].includes(c.name),
    )) {
      const tracks = [];
      for (const track of clip.tracks) {
        if (!track.name.endsWith(".quaternion")) continue;
        const name = canonical(track.name.slice(0, -11));
        const bone = targetSkin.skeleton.bones.find(
          (b) => canonical(b.name) === name,
        );
        const baseline = sourceBaseline.get(name);
        if (!bone || !baseline) continue;
        const inverse = baseline.clone().invert();
        const values = new Float32Array(track.values.length);
        for (let index = 0; index < values.length; index += 4) {
          const delta = inverse
            .clone()
            .multiply(new Quaternion().fromArray(track.values, index));
          bone.quaternion
            .clone()
            .multiply(delta)
            .normalize()
            .toArray(values, index);
        }
        tracks.push(
          new QuaternionKeyframeTrack(
            bone.name + ".quaternion",
            track.times,
            values,
          ),
        );
      }
      clips[clip.name] = new AnimationClip(clip.name, clip.duration, tracks);
    }
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const factor = 1.88 / size.y;
    const pivot = new Group();
    pivot.add(model);
    pivot.scale.setScalar(factor);
    model.position.x -= bounds.getCenter(new Vector3()).x;
    model.position.y -= bounds.min.y;
    model.position.z -= bounds.getCenter(new Vector3()).z;
    // Remove the source asset's camera and lights; the application owns lighting.
    const helpers: Object3D[] = [];
    model.traverse((o) => {
      if ("isLight" in o || "isCamera" in o) helpers.push(o);
    });
    helpers.forEach((o) => o.removeFromParent());
    const mixer = new AnimationMixer(model);
    const actions = Object.fromEntries(
      Object.entries(clips).map(([name, clip]) => [
        name,
        mixer.clipAction(clip),
      ]),
    );
    const find = (part: string) =>
      targetSkin!.skeleton.bones.find(
        (b) => canonical(b.name) === ("mixamorig" + part).toLowerCase(),
      );
    return {
      pivot,
      model,
      mixer,
      actions,
      bones: {
        head: find("Head"),
        arm: find("RightArm"),
        forearm: find("RightForeArm"),
        hand: find("RightHand"),
        spine: find("Spine2"),
      },
      boneCount: targetSkin.skeleton.bones.length,
    };
  }, [asset, motion]);
  useEffect(() => {
    onReady(true);
    return () => {
      prepared.mixer.stopAllAction();
      prepared.mixer.uncacheRoot(prepared.model);
    };
  }, [prepared, onReady]);
  useEffect(() => {
    const name =
      action.type === "agree"
        ? "agree"
        : action.type === "walk"
          ? "walk"
          : "idle";
    const next = prepared.actions[name] || prepared.actions.idle;
    if (next) {
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
      next.setLoop(name === "agree" ? LoopOnce : LoopRepeat, Infinity);
      next.clampWhenFinished = name === "agree";
      next.play();
      if (current.current && current.current !== next)
        current.current.crossFadeTo(next, 0.45, true);
      current.current = next;
    }
    started.current = performance.now();
  }, [action, prepared]);
  const rotation = new Quaternion();
  function addRotation(
    bone: Bone | undefined,
    x: number,
    y: number,
    z: number,
  ) {
    if (!bone) return;
    rotation.setFromAxisAngle(new Vector3(1, 0, 0), x);
    bone.quaternion.multiply(rotation);
    rotation.setFromAxisAngle(new Vector3(0, 1, 0), y);
    bone.quaternion.multiply(rotation);
    rotation.setFromAxisAngle(new Vector3(0, 0, 1), z);
    bone.quaternion.multiply(rotation);
  }
  useFrame(({ pointer, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    prepared.mixer.update(reduced ? 0 : dt);
    const elapsed = (performance.now() - started.current) / 1000;
    const envelope =
      Math.min(1, elapsed / 0.5) *
      Math.max(0, Math.min(1, (3.7 - elapsed) / 0.7));
    if (!reduced) {
      addRotation(prepared.bones.head, pointer.y * -0.09, pointer.x * 0.12, 0);
      if (action.type === "greet" && elapsed < 3.7) {
        addRotation(prepared.bones.arm, -0.15 * envelope, 0, -0.9 * envelope);
        addRotation(prepared.bones.forearm, -0.8 * envelope, 0, 0.5 * envelope);
        addRotation(
          prepared.bones.hand,
          0,
          0.18 * Math.sin(elapsed * 8) * envelope,
          0,
        );
      }
      if (action.type === "thinking" || action.type === "focus")
        addRotation(prepared.bones.head, 0.08, 0, -0.035);
      if (action.type === "speak")
        addRotation(
          prepared.bones.spine,
          0,
          Math.sin(clock.elapsedTime * 1.2) * 0.015,
          0,
        );
    }
    if (
      action.type === "agree" &&
      elapsed > 3 &&
      current.current !== prepared.actions.idle
    ) {
      const next = prepared.actions.idle;
      next.reset().play();
      current.current?.crossFadeTo(next, 0.55, true);
      current.current = next;
    }
    prepared.model.updateMatrixWorld(true);
  });
  return (
    <group
      ref={outer}
      onPointerDown={(e) => {
        e.stopPropagation();
        touchStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const p = touchStart.current;
        touchStart.current = null;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) onTouch();
      }}
    >
      <primitive object={prepared.pivot} />
    </group>
  );
}
function Controls({ reset }: { reset: number }) {
  const ref = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  useEffect(() => {
    if (ref.current) {
      ref.current.target.set(0, 0.96, 0);
      camera.position.set(0, 1.12, 3.65);
      ref.current.update();
    }
  }, [reset, camera]);
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={[0, 0.96, 0]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={2.6}
      maxDistance={6}
      minPolarAngle={0.9}
      maxPolarAngle={1.7}
      rotateSpeed={0.55}
    />
  );
}
export default function Stage(props: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="stage" data-testid="stage">
      <Canvas
        camera={{ position: [0, 1.12, 3.65], fov: 35, near: 0.05, far: 60 }}
        dpr={[1, 1.7]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onPointerMissed={(e) => {
          if (e.type === "click") props.onTouch();
        }}
        fallback={
          <div className="model-error">
            Votre navigateur ne permet pas l’affichage 3D WebGL.
          </div>
        }
      >
        <Lighting night={props.night} />
        <Suspense fallback={null}>
          <ModelBoundary
            onError={() => {
              setFailed(true);
              props.onReady(false);
            }}
          >
            <Character
              action={props.action}
              reduced={props.reduced}
              onTouch={props.onTouch}
              onReady={props.onReady}
            />
          </ModelBoundary>
          <Pod reduced={props.reduced} />
          <ContactShadows
            position={[0, -0.018, 0]}
            opacity={props.night ? 0.5 : 0.25}
            scale={5}
            blur={2.8}
            far={2.4}
            resolution={256}
            color="#343c4c"
            frames={props.reduced ? 1 : Infinity}
          />
        </Suspense>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <ringGeometry args={[0.75, 0.754, 96]} />
          <meshBasicMaterial
            color={props.night ? "#72849e" : "#b4bfd0"}
            transparent
            opacity={0.35}
          />
        </mesh>
        <Controls reset={props.reset} />
      </Canvas>
      {failed && (
        <div className="stage-model-error model-error">
          Le modèle 3D n’a pas pu être chargé.
          <br />
          Rechargez l’application pour réessayer.
        </div>
      )}
    </div>
  );
}
