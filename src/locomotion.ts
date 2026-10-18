export interface SceneDestination {
  id: number;
  x: number;
  depth: number;
  stop?: boolean;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function createLocomotion() {
  const state = {
    x: 0,
    depth: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    phase: 0,
    stride: 0,
    moving: false,
    facing: 1,
  };
  let targetX = 0,
    targetDepth = 0,
    id: number | undefined;
  return {
    state,
    reset() {
      Object.assign(state, {
        x: 0,
        depth: 0,
        vx: 0,
        vz: 0,
        speed: 0,
        phase: 0,
        stride: 0,
        moving: false,
        facing: 1,
      });
      targetX = targetDepth = 0;
      id = undefined;
    },
    stop() {
      targetX = state.x;
      targetDepth = state.depth;
      state.vx = state.vz = state.speed = state.stride = 0;
      state.moving = false;
    },
    update(
      destination: SceneDestination | undefined,
      delta: number,
      reduced: boolean,
    ) {
      if (destination && destination.id !== id) {
        id = destination.id;
        if (destination.stop) {
          targetX = state.x;
          targetDepth = state.depth;
          state.vx = state.vz = 0;
        }
        if (
          !destination.stop &&
          Number.isFinite(destination.x) &&
          Number.isFinite(destination.depth)
        ) {
          targetX = clamp(destination.x, -1, 1);
          targetDepth = clamp(destination.depth, 0, 1);
        }
      }
      if (reduced) {
        state.x = targetX;
        state.depth = targetDepth;
        state.vx = state.vz = state.speed = state.stride = 0;
        state.moving = false;
        return state;
      }
      const total = clamp(Number.isFinite(delta) ? delta : 0, 0, 5);
      const steps = Math.max(1, Math.ceil(total * 120)),
        dt = total / steps;
      for (let i = 0; i < steps; i++) {
        const dx = targetX - state.x,
          dz = targetDepth - state.depth,
          distance = Math.hypot(dx, dz);
        if (distance < 0.002 && Math.hypot(state.vx, state.vz) < 0.03) {
          state.x = targetX;
          state.depth = targetDepth;
          state.vx = state.vz = 0;
          continue;
        }
        const speed = Math.min(0.52, Math.sqrt(2 * 1.1 * distance));
        const blend = 1 - Math.exp(-dt * 8);
        state.vx +=
          (distance > 0 ? (dx / distance) * speed - state.vx : -state.vx) *
          blend;
        state.vz +=
          (distance > 0 ? (dz / distance) * speed - state.vz : -state.vz) *
          blend;
        const sx = state.vx * dt,
          sz = state.vz * dt;
        if (Math.hypot(sx, sz) > distance && dx * sx + dz * sz > 0) {
          state.x = targetX;
          state.depth = targetDepth;
          state.vx = state.vz = 0;
        } else {
          state.x = clamp(state.x + sx, -1, 1);
          state.depth = clamp(state.depth + sz, 0, 1);
          state.phase += Math.hypot(sx, sz) * 18;
        }
      }
      state.speed = Math.hypot(state.vx, state.vz);
      state.stride +=
        (Math.min(1, state.speed / 0.35) - state.stride) *
        (1 - Math.exp(-total * 10));
      state.moving =
        state.speed > 0.008 ||
        Math.hypot(targetX - state.x, targetDepth - state.depth) > 0.006;
      if (Math.abs(state.vx) > 0.03) state.facing = state.vx < 0 ? -1 : 1;
      return state;
    },
  };
}
