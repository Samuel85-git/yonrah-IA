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
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  SkinnedMesh,
  Vector3,
} from "three";
import type { Object3D } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Action } from "../types";
import { createMotion } from "../motion";

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
  const outer = useRef<Group>(null);
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
    const motion = createMotion(model, targetSkin.skeleton.bones);
    return { pivot, model, motion };
  }, [asset]);
  useEffect(() => {
    onReady(true);
  }, [prepared, onReady]);
  useFrame(({ pointer }, delta) => {
    prepared.motion.update(action, delta, reduced, pointer);
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
