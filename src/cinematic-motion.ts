import type { Action, TouchReaction } from "./types";

export interface Spring {
  value: number;
  velocity: number;
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const band = (y: number, a: number, b: number, c: number, d: number) =>
  smooth((y - a) / (b - a)) * (1 - smooth((y - c) / (d - c)));

/** Exact damped spring solution. A paused tab cannot introduce explosive velocities. */
export function advanceSpring(
  spring: Spring,
  target: number,
  delta: number,
  frequency = 2.3,
  damping = 0.58,
) {
  const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 60);
  const omega = Math.PI * 2 * frequency;
  const decayRate = omega * damping;
  const oscillation = omega * Math.sqrt(1 - damping * damping);
  const offset = spring.value - target;
  const decay = Math.exp(-decayRate * dt);
  const cosine = Math.cos(oscillation * dt);
  const sine = Math.sin(oscillation * dt);
  const velocity = spring.velocity;
  spring.value =
    target +
    decay *
      (offset * cosine +
        ((velocity + decayRate * offset) / oscillation) * sine);
  spring.velocity =
    decay *
    (velocity * cosine -
      ((decayRate * velocity + omega * omega * offset) / oscillation) * sine);
}

export interface CinematicPose {
  breath: number;
  torsoX: number;
  torsoY: number;
  headX: number;
  headY: number;
  headRoll: number;
  cloth: number;
  clothVelocity: number;
  hair: number;
  shoulder: number;
  contact: number;
}

export function neutralCinematicPose(): CinematicPose {
  return {
    breath: 0,
    torsoX: 0,
    torsoY: 0,
    headX: 0,
    headY: 0,
    headRoll: 0,
    cloth: 0,
    clothVelocity: 0,
    hair: 0,
    shoulder: 0,
    contact: 0,
  };
}

/** Coordinates refer to the cropped, full-height artwork: x [-1,1], y [0,1]. */
export function cinematicWeights(x: number, y: number) {
  return {
    // Smooth joins prevent the neck/waist seams of separately translated image cards.
    planted: smooth(y / 0.2),
    upper: smooth((y - 0.42) / 0.25),
    head: smooth((y - 0.815) / 0.05),
    chest: band(y, 0.65, 0.7, 0.78, 0.815),
    shoulder: band(y, 0.76, 0.79, 0.825, 0.865),
    // The illustration's skirt is y .44–.64. Exclude the gloves and the front slit.
    cloth:
      band(y, 0.4, 0.455, 0.57, 0.65) *
      (1 - smooth((Math.abs(x) - 0.7) / 0.21)) *
      (1 - smooth((0.57 - y) / 0.105) * (1 - smooth(Math.abs(x) / 0.3))),
    hair: band(y, 0.84, 0.88, 0.98, 1) * smooth(Math.abs(x) / 0.3),
  };
}
export type CinematicWeights = ReturnType<typeof cinematicWeights>;

/** Small, regional surface articulation. The artwork is not a volumetric character rig. */
export function deformCinematicPoint(
  x: number,
  y: number,
  pose: CinematicPose,
  weights = cinematicWeights(x, y),
  aspect = 0.39,
) {
  if (weights.planted === 0) return { x, y, z: 0 };
  const headAngle = pose.headRoll * weights.head;
  const headPivotY = 0.84;
  const cosine = Math.cos(headAngle);
  const sine = Math.sin(headAngle);
  const headRotationX =
    x * (cosine - 1) - (y - headPivotY) * sine * (2 / aspect);
  const headRotationY =
    x * sine * (aspect / 2) + (y - headPivotY) * (cosine - 1);
  // Scale values are relative to artwork height; keep the chest expansion under 1%.
  const dx =
    pose.torsoX * weights.upper +
    pose.headX * weights.head +
    headRotationX +
    x * pose.breath * weights.chest * 0.0055 +
    pose.cloth * weights.cloth * (0.48 + 0.52 * Math.abs(x)) +
    pose.hair * weights.hair;
  const dy =
    pose.torsoY * weights.upper +
    pose.headY * weights.head +
    headRotationY +
    pose.breath * weights.chest * 0.0018 +
    pose.shoulder * weights.shoulder * 0.0022 +
    Math.sin(x * 6) * pose.cloth * weights.cloth * 0.14;
  const z =
    pose.breath * weights.chest * 0.0014 +
    pose.cloth * weights.cloth * Math.sin(x * 5) * 0.18;
  return {
    x: x + dx * weights.planted,
    y: y + dy * weights.planted,
    z: z * weights.planted,
  };
}

export function createCinematicMotion() {
  let time = 0;
  let elapsed = 0;
  let actionId: number | undefined;
  let type: Action["type"] = "idle";
  let reactionId: number | undefined;
  let touchTime = 10;
  let lastReaction: TouchReaction | undefined;
  const robe: Spring = { value: 0, velocity: 0 };
  const hair: Spring = { value: 0, velocity: 0 };
  const head: Spring = { value: 0, velocity: 0 };
  const pose = neutralCinematicPose();
  return {
    pose,
    update(
      action: Action,
      delta: number,
      reduced: boolean,
      reaction?: TouchReaction,
    ) {
      const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 60);
      if (action.id !== actionId || action.type !== type) {
        actionId = action.id;
        type = action.type;
        elapsed = 0;
      }
      if (reaction && reaction.id !== reactionId) {
        reactionId = reaction.id;
        lastReaction = reaction;
        touchTime = 0;
      }
      // Accessibility is deterministic: no breath, springs, drift, or contact deformation.
      if (reduced) {
        Object.assign(pose, neutralCinematicPose());
        for (const spring of [robe, hair, head]) {
          spring.value = 0;
          spring.velocity = 0;
        }
        touchTime = 10;
        return pose;
      }
      time += dt;
      elapsed += dt;
      touchTime += dt;
      const enter = smooth(elapsed / 0.45);
      const greet =
        type === "greet" ? enter * smooth((3.6 - elapsed) / 0.7) : 0;
      const movement =
        type === "walk" ? enter * smooth((6.8 - elapsed) / 0.85) : 0;
      const focus = type === "focus" || type === "thinking" ? enter : 0;
      const speak = type === "speak" ? enter : 0;
      const agree =
        type === "agree" ? enter * smooth((2.8 - elapsed) / 0.65) : 0;
      const contact =
        lastReaction?.zone !== "space"
          ? smooth(touchTime / 0.24) * smooth((2.7 - touchTime) / 1.1)
          : 0;
      const surprise = contact * Math.exp(-(((touchTime - 0.29) / 0.24) ** 2));
      const touchX = clamp(lastReaction?.x ?? 0, -1, 1);
      const touchY = clamp(lastReaction?.y ?? 0, -1, 1);
      const breath = Math.sin((time * Math.PI * 2) / 5.2);
      const shift = Math.sin(time * 0.72) * 0.004;
      const move = Math.sin(elapsed * 2.05) * 0.016 * movement;
      pose.breath = breath * (1 - surprise * 0.28);
      pose.torsoX = shift + move + touchX * contact * 0.002;
      pose.torsoY =
        Math.sin((elapsed * Math.PI) / 3.6) * -0.006 * greet +
        Math.sin(time * 1.9) * 0.0008 * speak -
        surprise * 0.002;
      const headTarget =
        touchX * contact * 0.019 +
        Math.sin(time * 0.39) * 0.002 +
        Math.sin(time * 1.8) * 0.0025 * speak;
      advanceSpring(head, headTarget, dt, 2.5, 0.82);
      pose.headX = head.value;
      pose.headY =
        -0.0045 * focus -
        Math.sin((elapsed * Math.PI) / 3.6) * 0.004 * greet +
        Math.sin(elapsed * 4.2) * 0.003 * agree +
        contact * (touchY * 0.0015 + surprise * 0.0018);
      pose.headRoll =
        touchX * contact * -0.018 +
        focus * 0.008 +
        Math.sin(time * 0.45) * 0.0015;
      pose.shoulder = breath * 0.6 + surprise * 0.8 - greet * 0.5;
      const robeTarget =
        Math.sin(time * 0.83) * 0.018 +
        Math.sin(elapsed * 2.05 - 0.8) * 0.039 * movement -
        contact * touchX * 0.009 +
        Math.sin((elapsed * Math.PI) / 3.6) * 0.012 * greet;
      advanceSpring(robe, robeTarget, dt, 1.55, 0.52);
      advanceSpring(
        hair,
        -head.velocity * 0.035 + Math.sin(time * 1.1) * 0.005,
        dt,
        2.8,
        0.62,
      );
      pose.cloth = robe.value;
      pose.clothVelocity = robe.velocity;
      pose.hair = hair.value;
      pose.contact = contact;
      return pose;
    },
  };
}
