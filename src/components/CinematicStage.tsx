import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
} from "three";
import type { Action, TouchPoint, TouchReaction } from "../types";
import {
  cinematicWeights,
  createCinematicMotion,
  deformCinematicPoint,
} from "../cinematic-motion";

import { createLocomotion } from "../locomotion";
import type { SceneDestination } from "../locomotion";

type Props = {
  action: Action;
  night: boolean;
  reduced: boolean;
  onTouch: (point: TouchPoint) => void;
  reaction?: TouchReaction;
  onReady: (ready: boolean) => void;
  reset: number;
  destination?: SceneDestination;
  navigation?: boolean;
  onDestination?: (x: number, depth: number) => void;
};

class ArtworkBoundary extends Component<
  { children: ReactNode; onError: () => void; fallback?: ReactNode },
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
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children;
  }
}

function Artwork(props: Props) {
  const textures = useLoader(TextureLoader, [
    "/assets/2b-cinematic.png",
    "/assets/2b-poses.png",
  ]);
  const { gl, size, camera } = useThree();
  const meshes = useRef<(Mesh | null)[]>([]);
  const materials = useRef<(MeshBasicMaterial | null)[]>([]);
  const group = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);
  const marker = useRef<Mesh>(null);
  const activeFrame = useRef(0);
  const opacity = useRef([1, 0, 0, 0]);
  const pan = useRef({ x: 0, y: 0, actualX: 0, actualY: 0 });
  const motion = useMemo(createCinematicMotion, []);
  const locomotion = useMemo(createLocomotion, []);
  const latest = useRef(props);
  latest.current = props;
  const prepared = useMemo(() => {
    return [0, 1, 2, 3].map((frame) => {
      const texture = textures[frame === 0 ? 0 : 1];
      const image = texture.image as HTMLImageElement;
      const w = image.naturalWidth || image.width,
        h = image.naturalHeight || image.height;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Cannot read artwork");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, w, h).data;
      const start = frame === 0 ? 0 : Math.round(((frame - 1) * w) / 3),
        end = frame === 0 ? w : Math.round((frame * w) / 3);
      let left = end,
        right = start,
        top = h,
        bottom = 0;
      for (let y = 0; y < h; y++)
        for (let x = start; x < end; x++)
          if (pixels[(y * w + x) * 4 + 3] > 24) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      if (right <= left || bottom <= top) throw new Error("Empty pose");
      left = Math.max(start, left - 3);
      right = Math.min(end - 1, right + 3);
      top = Math.max(0, top - 3);
      bottom = Math.min(h - 1, bottom + 3);
      const height = 2,
        width = (2 * (right - left + 1)) / (bottom - top + 1);
      const geometry = new PlaneGeometry(width, height, 80, 128),
        position = geometry.getAttribute("position"),
        uv = geometry.getAttribute("uv");
      const original = new Float32Array(position.array),
        weights = [];
      for (let i = 0; i < position.count; i++) {
        const x = (position.getX(i) / width) * 2,
          y = position.getY(i) / height + 0.5;
        weights.push(cinematicWeights(x, y));
        uv.setXY(
          i,
          (left + ((x + 1) / 2) * (right - left)) / w,
          1 - (top + (1 - y) * (bottom - top)) / h,
        );
      }
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      return {
        texture,
        geometry,
        original,
        weights,
        pixels,
        w,
        h,
        width,
        height,
        left,
        right,
        top,
        bottom,
      };
    });
  }, [textures, gl]);
  const maximumWidth = Math.max(...prepared.map((p) => p.width));
  const fittedZoom = Math.min(
    size.height / 2.21,
    size.width / (maximumWidth * 1.16),
  );
  const halfWidth = size.width / (2 * fittedZoom);
  const safeX = Math.max(
    0.04,
    Math.min(0.85, halfWidth - maximumWidth / 2 - 0.07),
  );
  const bounds = useRef({ safeX, halfWidth });
  bounds.current = { safeX, halfWidth };
  useEffect(
    () => () => prepared.forEach((p) => p.geometry.dispose()),
    [prepared],
  );
  useEffect(() => {
    props.onReady(true);
  }, [props.onReady, prepared]);
  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(
        size.height / 2.21,
        size.width / (maximumWidth * 1.16),
      );
      camera.updateProjectionMatrix();
    }
  }, [camera, size, maximumWidth]);
  useEffect(() => {
    pan.current = { x: 0, y: 0, actualX: 0, actualY: 0 };
    locomotion.reset();
  }, [props.reset, locomotion]);
  useEffect(() => {
    pan.current = { x: 0, y: 0, actualX: 0, actualY: 0 };
  }, [props.reduced]);
  useEffect(() => {
    const canvas = gl.domElement,
      raycaster = new Raycaster(),
      cursor = new Vector2(),
      pointers = new Set<number>();
    let press:
      | {
          id: number;
          x: number;
          y: number;
          panX: number;
          panY: number;
          moved: boolean;
        }
      | undefined;
    const down = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      if (pointers.size > 1) {
        if (press) press.moved = true;
        return;
      }
      if (!event.isPrimary || event.button !== 0) return;
      press = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: pan.current.x,
        panY: pan.current.y,
        moved: false,
      };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id || pointers.size > 1) return;
      const dx = event.clientX - press.x,
        dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > 7) press.moved = true;
      if (!press.moved || latest.current.reduced) return;
      const rect = canvas.getBoundingClientRect();
      pan.current.x = Math.max(
        -1,
        Math.min(1, press.panX + dx / (rect.width * 0.42)),
      );
      pan.current.y = Math.max(
        -1,
        Math.min(1, press.panY - dy / (rect.height * 0.42)),
      );
    };
    const up = (event: PointerEvent) => {
      const current = press;
      if (current?.id === event.pointerId) press = undefined;
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      if (
        !current ||
        current.id !== event.pointerId ||
        current.moved ||
        Math.hypot(event.clientX - current.x, event.clientY - current.y) > 7
      )
        return;
      const rect = canvas.getBoundingClientRect();
      cursor.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      );
      raycaster.setFromCamera(cursor, camera);
      const index = activeFrame.current,
        p = prepared[index],
        mesh = meshes.current[index];
      const hit = mesh ? raycaster.intersectObject(mesh, false)[0] : undefined;
      if (hit?.uv) {
        const px = Math.max(0, Math.min(p.w - 1, Math.round(hit.uv.x * p.w))),
          py = Math.max(0, Math.min(p.h - 1, Math.round((1 - hit.uv.y) * p.h)));
        if (p.pixels[(py * p.w + px) * 4 + 3] > 40) {
          const y = 1 - (py - p.top) / (p.bottom - p.top);
          latest.current.onTouch({
            x: Math.max(
              -1,
              Math.min(1, ((px - p.left) / (p.right - p.left)) * 2 - 1),
            ),
            y: y * 2 - 1,
            zone: y > 0.835 ? "head" : "body",
          });
          return;
        }
      }
      if (latest.current.navigation) {
        latest.current.onDestination?.(
          Math.max(
            -1,
            Math.min(
              1,
              (cursor.x * bounds.current.halfWidth) / bounds.current.safeX,
            ),
          ),
          Math.max(0, Math.min(1, (cursor.y + 0.7) / 1.4)),
        );
      } else
        latest.current.onTouch({ x: cursor.x, y: cursor.y, zone: "space" });
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (press?.id === e.pointerId) press = undefined;
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("lostpointercapture", cancel);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
    };
  }, [gl, camera, prepared]);
  useFrame((_, delta) => {
    const travel = locomotion.update(props.destination, delta, props.reduced);
    const pose = motion.update(
      props.action,
      delta,
      props.reduced,
      props.reaction,
    );
    pose.stride = travel.stride;
    pose.step = travel.phase;
    pose.cloth +=
      travel.stride * Math.sin(travel.phase - 0.4) * 0.012 + travel.vx * 0.02;
    pose.hair += travel.vx * 0.003;
    const index = travel.moving
      ? 3
      : props.action.type === "greet"
        ? 1
        : ["focus", "thinking"].includes(props.action.type)
          ? 2
          : 0;
    activeFrame.current = index;
    const blend = 1 - Math.exp(-Math.max(0, delta) * 20);
    for (let frame = 0; frame < prepared.length; frame++) {
      opacity.current[frame] +=
        (Number(frame === index) - opacity.current[frame]) *
        (props.reduced ? 1 : blend);
      const material = materials.current[frame],
        mesh = meshes.current[frame];
      if (material) material.opacity = opacity.current[frame];
      if (mesh) mesh.visible = opacity.current[frame] > 0.003;
      if (opacity.current[frame] < 0.003) continue;
      const p = prepared[frame],
        vertices = p.geometry.getAttribute("position");
      for (let i = 0; i < vertices.count; i++) {
        const x = (p.original[i * 3] / p.width) * 2,
          y = p.original[i * 3 + 1] / p.height + 0.5;
        const point = deformCinematicPoint(
          x,
          y,
          pose,
          p.weights[i],
          p.width / p.height,
        );
        vertices.setXYZ(
          i,
          (point.x * p.width) / 2,
          (point.y - 0.5) * p.height,
          point.z * p.height,
        );
      }
      vertices.needsUpdate = true;
    }
    const damping = 1 - Math.exp(-Math.max(0, delta) * 7);
    pan.current.actualX += (pan.current.x - pan.current.actualX) * damping;
    pan.current.actualY += (pan.current.y - pan.current.actualY) * damping;
    const scale = 1 - travel.depth * 0.19,
      x = travel.x * safeX,
      feet = -1 + travel.depth * 0.15;
    if (group.current) {
      group.current.scale.setScalar(scale);
      group.current.position.set(
        x + (props.reduced ? 0 : pan.current.actualX * 0.023),
        feet +
          scale +
          (props.reduced
            ? 0
            : Math.abs(Math.sin(travel.phase)) * travel.stride * 0.003),
        travel.depth * -0.1,
      );
      group.current.rotation.y = props.reduced
        ? 0
        : pan.current.actualX * 0.035 +
          (travel.moving ? travel.facing * 0.045 : 0);
      group.current.rotation.x = props.reduced
        ? 0
        : pan.current.actualY * -0.018;
    }
    if (shadow.current) {
      shadow.current.position.set(x, feet - 0.014, -0.2);
      shadow.current.scale.set(0.27 * scale, 0.012 * scale, 1);
    }
    if (marker.current && props.destination) {
      const d = props.destination;
      marker.current.visible = !!props.navigation && travel.moving;
      marker.current.position.set(d.x * safeX, -1 + d.depth * 0.15, -0.19);
    }
    const element = gl.domElement.closest(
      "[data-testid=stage]",
    ) as HTMLElement | null;
    if (element) {
      element.dataset.pose = ["idle", "greet", "focus", "walk"][index];
      element.dataset.x = travel.x.toFixed(3);
      element.dataset.depth = travel.depth.toFixed(3);
      element.dataset.moving = String(travel.moving);
    }
  });
  return (
    <>
      <mesh ref={shadow} position={[0, -1.014, -0.2]} scale={[0.27, 0.012, 1]}>
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial
          color={props.night ? "#101624" : "#58647a"}
          transparent
          opacity={props.night ? 0.22 : 0.11}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={marker} visible={false} scale={[0.11, 0.015, 1]}>
        <ringGeometry args={[0.75, 1, 40]} />
        <meshBasicMaterial
          color={props.night ? "#ccd7e9" : "#7b6a4b"}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <group ref={group}>
        {prepared.map((p, i) => (
          <mesh
            key={i}
            ref={(m) => {
              meshes.current[i] = m;
            }}
            geometry={p.geometry}
            frustumCulled={false}
            renderOrder={i}
          >
            <meshBasicMaterial
              ref={(m) => {
                materials.current[i] = m;
              }}
              map={p.texture}
              color={props.night ? "#e2e7f5" : "#ffffff"}
              transparent
              opacity={i === 0 ? 1 : 0}
              alphaTest={0.015}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

function StaticArtwork({
  onReady,
  onTouch,
}: Pick<Props, "onReady" | "onTouch">) {
  const press = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
      }}
      data-renderer="static-fallback"
    >
      <img
        src="/assets/2b-cinematic.png"
        alt="2B, androïde YoRHa aux cheveux blancs, en robe noire brodée."
        draggable={false}
        style={{
          height: "94%",
          width: "auto",
          maxWidth: "95%",
          objectFit: "contain",
          userSelect: "none",
        }}
        onLoad={() => onReady(true)}
        onError={() => onReady(false)}
        onPointerDown={(event) => {
          press.current =
            event.isPrimary && event.button === 0
              ? { x: event.clientX, y: event.clientY }
              : null;
        }}
        onPointerCancel={() => {
          press.current = null;
        }}
        onPointerUp={(event) => {
          const start = press.current;
          press.current = null;
          if (
            !start ||
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7
          )
            return;
          const rect = event.currentTarget.getBoundingClientRect();
          const y = 1 - (event.clientY - rect.top) / rect.height;
          onTouch({
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: y * 2 - 1,
            zone: y > 0.835 ? "head" : "body",
          });
        }}
      />
    </div>
  );
}

export default function CinematicStage(props: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="stage" data-testid="stage" data-renderer="cinematic-2.5d">
      <ArtworkBoundary
        onError={() => props.onReady(false)}
        fallback={
          <StaticArtwork onReady={props.onReady} onTouch={props.onTouch} />
        }
      >
        <Canvas
          orthographic
          camera={{ position: [0, 0, 10], zoom: 180, near: 0.1, far: 30 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          fallback={
            <StaticArtwork onReady={props.onReady} onTouch={props.onTouch} />
          }
        >
          <Suspense fallback={null}>
            <ArtworkBoundary
              onError={() => {
                setFailed(true);
                props.onReady(false);
              }}
            >
              <Artwork {...props} />
            </ArtworkBoundary>
          </Suspense>
        </Canvas>
      </ArtworkBoundary>
      {failed && (
        <div className="stage-model-error model-error">
          Le personnage n’a pas pu être chargé.
          <br />
          Rechargez l’application pour réessayer.
        </div>
      )}
    </div>
  );
}
