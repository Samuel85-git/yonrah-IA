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

type Props = {
  action: Action;
  night: boolean;
  reduced: boolean;
  onTouch: (point: TouchPoint) => void;
  reaction?: TouchReaction;
  onReady: (ready: boolean) => void;
  reset: number;
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
  const texture = useLoader(TextureLoader, "/assets/2b-cinematic.png");
  const { gl, size, camera } = useThree();
  const mesh = useRef<Mesh>(null);
  const group = useRef<Group>(null);
  const pan = useRef({ x: 0, y: 0, actualX: 0, actualY: 0 });
  const motion = useMemo(createCinematicMotion, []);
  const touchCallback = useRef(props.onTouch);
  touchCallback.current = props.onTouch;
  const reduced = useRef(props.reduced);
  reduced.current = props.reduced;
  const prepared = useMemo(() => {
    const image = texture.image as HTMLImageElement;
    const w = image.naturalWidth || image.width;
    const h = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Cannot read the character artwork.");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, w, h).data;
    let left = w,
      right = 0,
      top = h,
      bottom = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] > 24) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (right <= left || bottom <= top)
      throw new Error("Empty character artwork.");
    left = Math.max(0, left - 4);
    top = Math.max(0, top - 4);
    right = Math.min(w - 1, right + 4);
    bottom = Math.min(h - 1, bottom + 4);
    const aspect = (right - left + 1) / (bottom - top + 1);
    const height = 2;
    const width = height * aspect;
    const geometry = new PlaneGeometry(width, height, 80, 128);
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const original = new Float32Array(position.array);
    const weights = [];
    for (let i = 0; i < position.count; i++) {
      const x = (position.getX(i) / width) * 2;
      const y = position.getY(i) / height + 0.5;
      weights.push(cinematicWeights(x, y));
      uv.setXY(
        i,
        (left + ((x + 1) / 2) * (right - left)) / w,
        1 - (top + (1 - y) * (bottom - top)) / h,
      );
    }
    uv.needsUpdate = true;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return {
      geometry,
      original,
      weights,
      pixels,
      w,
      h,
      width,
      height,
      left,
      top,
      right,
      bottom,
    };
  }, [texture, gl]);

  useEffect(() => () => prepared.geometry.dispose(), [prepared]);
  useEffect(() => {
    props.onReady(true);
  }, [props.onReady, prepared]);
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    // Use the actual canvas size: the full silhouette fits both mobile and desktop.
    camera.zoom = Math.min(
      size.height / 2.21,
      size.width / (prepared.width * 1.16),
    );
    camera.updateProjectionMatrix();
  }, [camera, size, prepared.width]);
  useEffect(() => {
    pan.current = { x: 0, y: 0, actualX: 0, actualY: 0 };
  }, [props.reset, props.reduced]);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const cursor = new Vector2();
    const pointers = new Set<number>();
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
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > 7) press.moved = true;
      if (!press.moved || reduced.current) return;
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
      const hit = mesh.current
        ? raycaster.intersectObject(mesh.current, false)[0]
        : undefined;
      if (hit?.uv) {
        const px = Math.max(
          0,
          Math.min(prepared.w - 1, Math.round(hit.uv.x * prepared.w)),
        );
        const py = Math.max(
          0,
          Math.min(prepared.h - 1, Math.round((1 - hit.uv.y) * prepared.h)),
        );
        if (prepared.pixels[(py * prepared.w + px) * 4 + 3] > 40) {
          const y = 1 - (py - prepared.top) / (prepared.bottom - prepared.top);
          touchCallback.current({
            x: Math.max(
              -1,
              Math.min(
                1,
                ((px - prepared.left) / (prepared.right - prepared.left)) * 2 -
                  1,
              ),
            ),
            y: y * 2 - 1,
            zone: y > 0.835 ? "head" : "body",
          });
          return;
        }
      }
      touchCallback.current({ x: cursor.x, y: cursor.y, zone: "space" });
    };
    const cancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (press?.id === event.pointerId) press = undefined;
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
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
    const pose = motion.update(
      props.action,
      delta,
      props.reduced,
      props.reaction,
    );
    const vertices = prepared.geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const x = (prepared.original[i * 3] / prepared.width) * 2;
      const y = prepared.original[i * 3 + 1] / prepared.height + 0.5;
      const point = deformCinematicPoint(
        x,
        y,
        pose,
        prepared.weights[i],
        prepared.width / prepared.height,
      );
      vertices.setXYZ(
        i,
        (point.x * prepared.width) / 2,
        (point.y - 0.5) * prepared.height,
        point.z * prepared.height,
      );
    }
    vertices.needsUpdate = true;
    // A restrained view adjustment suggests depth without exposing the paper-thin sides.
    const damping = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    pan.current.actualX += (pan.current.x - pan.current.actualX) * damping;
    pan.current.actualY += (pan.current.y - pan.current.actualY) * damping;
    if (group.current) {
      group.current.position.x = props.reduced
        ? 0
        : pan.current.actualX * 0.023;
      group.current.position.y = props.reduced
        ? 0
        : pan.current.actualY * 0.017;
      group.current.rotation.y = props.reduced
        ? 0
        : pan.current.actualX * 0.035;
      group.current.rotation.x = props.reduced
        ? 0
        : pan.current.actualY * -0.018;
    }
  });

  return (
    <>
      <mesh position={[0, -1.018, -0.06]} scale={[0.28, 0.013, 1]}>
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial
          color={props.night ? "#101624" : "#58647a"}
          transparent
          opacity={props.night ? 0.22 : 0.1}
          depthWrite={false}
        />
      </mesh>
      <group ref={group}>
        <mesh ref={mesh} geometry={prepared.geometry} frustumCulled={false}>
          <meshBasicMaterial
            map={texture}
            color={props.night ? "#e2e7f5" : "#ffffff"}
            transparent
            alphaTest={0.015}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
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
