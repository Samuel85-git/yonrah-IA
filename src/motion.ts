import { Bone, Object3D, Quaternion, Vector3 } from "three";
import type { Action, Motion } from "./types";

const canonical = (name: string) =>
  name
    .replace(/_\d+$/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

/** Pose directly in the character's own skeleton. Never copy another rig's local axes. */
export function createMotion(root: Object3D, bones: Bone[]) {
  root.updateMatrixWorld(true);
  const find = (name: string) => {
    const bone = bones.find(
      (b) => canonical(b.name) === `mixamorig${name.toLowerCase()}`,
    );
    if (!bone) throw new Error(`Missing animation bone: ${name}`);
    return bone;
  };
  const rest = bones.map((b) => b.quaternion.clone());
  const previous = rest.map((q) => q.clone());
  const world = new Map(
    bones.map((b) => [b, b.getWorldQuaternion(new Quaternion())]),
  );
  const position = (b: Object3D) => b.getWorldPosition(new Vector3());
  const hips = find("Hips");
  const height = position(find("Head")).y - position(find("LeftFoot")).y;
  const legs = ["Left", "Right"].map((side) => {
    const upper = find(side + "UpLeg"),
      lower = find(side + "Leg"),
      foot = find(side + "Foot");
    return {
      upper,
      lower,
      foot,
      home: position(foot),
      a: position(upper).distanceTo(position(lower)),
      b: position(lower).distanceTo(position(foot)),
    };
  });
  // Apply a world-space rotation then convert it back into this bone's parent frame.
  function worldRotation(bone: Bone, q: Quaternion) {
    const parent = bone.parent!.getWorldQuaternion(new Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(q));
    bone.updateWorldMatrix(false, true);
  }
  function aim(bone: Bone, child: Bone, direction: Vector3) {
    const before = position(child).sub(position(bone)).normalize();
    const delta = new Quaternion().setFromUnitVectors(
      before,
      direction.normalize(),
    );
    worldRotation(
      bone,
      delta.multiply(bone.getWorldQuaternion(new Quaternion())),
    );
  }
  function rotate(bone: Bone, axis: Vector3, angle: number) {
    worldRotation(
      bone,
      new Quaternion()
        .setFromAxisAngle(axis, angle)
        .multiply(bone.getWorldQuaternion(new Quaternion())),
    );
  }
  function stepLeg(leg: (typeof legs)[number], phase: number, amount: number) {
    const target = leg.home.clone();
    target.z += Math.sin(phase) * height * 0.045 * amount;
    target.y += Math.max(0, Math.cos(phase)) ** 2 * height * 0.025 * amount;
    const origin = position(leg.upper);
    const axis = target.clone().sub(origin);
    const distance = Math.min(axis.length(), leg.a + leg.b - height * 0.00001);
    axis.normalize();
    const along =
      (leg.a * leg.a - leg.b * leg.b + distance * distance) / (2 * distance);
    const bend = Math.sqrt(Math.max(0, leg.a * leg.a - along * along));
    const pole = new Vector3(0, 0, 1)
      .addScaledVector(axis, -axis.z)
      .normalize();
    const knee = origin
      .clone()
      .addScaledVector(axis, along)
      .addScaledVector(pole, bend);
    aim(leg.upper, leg.lower, knee.sub(origin));
    aim(leg.lower, leg.foot, target.sub(position(leg.lower)));
    worldRotation(leg.foot, world.get(leg.foot)!.clone());
  }
  let id: number | undefined,
    type: Motion = "idle",
    elapsed = 0,
    time = 0;
  function update(
    action: Action,
    delta: number,
    reduced: boolean,
    pointer = { x: 0, y: 0 },
    instant = false,
  ) {
    const dt = Math.max(0, delta);
    if (action.id !== id || action.type !== type) {
      id = action.id;
      type = action.type;
      elapsed = 0;
    }
    if (!reduced) {
      elapsed += dt;
      time += dt;
    }
    bones.forEach((bone, i) => bone.quaternion.copy(rest[i]));
    root.updateMatrixWorld(true);
    const active = reduced ? 0 : 1;
    const enter = smooth(elapsed / 0.5) * active;
    const breath = Math.sin(time * 1.7) * 0.008 * active;
    const wave = type === "greet" ? enter * smooth((3.6 - elapsed) / 0.65) : 0;
    const walk = type === "walk" ? enter * smooth((6.8 - elapsed) / 0.7) : 0;
    const nod =
      type === "agree"
        ? enter * smooth((2.8 - elapsed) / 0.7) * Math.sin(elapsed * 5) * 0.12
        : 0;
    const focus = type === "thinking" || type === "focus" ? enter : 0;
    const speak = type === "speak" ? enter : 0;
    rotate(find("Spine2"), new Vector3(1, 0, 0), breath);
    rotate(
      find("Spine2"),
      new Vector3(0, 1, 0),
      Math.sin(time * 1.8) * 0.02 * speak,
    );
    rotate(
      find("Head"),
      new Vector3(1, 0, 0),
      nod +
        focus * 0.09 -
        Math.max(-1, Math.min(1, pointer.y)) * 0.055 * active,
    );
    rotate(
      find("Head"),
      new Vector3(0, 1, 0),
      Math.max(-1, Math.min(1, pointer.x)) * 0.12 * active,
    );
    rotate(find("Head"), new Vector3(0, 0, 1), focus * 0.025);
    for (const [index, side] of ["Left", "Right"].entries()) {
      const sign = index === 0 ? 1 : -1;
      const arm = find(side + "Arm"),
        forearm = find(side + "ForeArm"),
        hand = find(side + "Hand");
      const greeting = side === "Right" ? wave : 0;
      const swing = Math.sin(time * 4.2 + index * Math.PI) * 0.15 * walk;
      aim(
        arm,
        forearm,
        new Vector3(
          sign * (0.19 + greeting * 0.5),
          -1 + greeting * 0.45,
          0.015 + swing,
        ),
      );
      // Raised forearm is blended as a direction, avoiding Euler flips and wrist spins.
      aim(
        forearm,
        hand,
        new Vector3(
          sign * (0.06 + greeting * (0.25 + Math.sin(elapsed * 7) * 0.12)),
          -1 + greeting * 1.9,
          0.12 + greeting * 0.3 + swing,
        ),
      );
      aim(
        hand,
        find(side + "HandIndex1"),
        new Vector3(
          sign * (0.09 + greeting * 0.15),
          -1 + greeting * 1.95,
          0.1 + greeting * 0.08,
        ),
      );
      rotate(
        hand,
        new Vector3(0, 0, 1),
        greeting * Math.sin(elapsed * 7) * 0.1,
      );
    }
    if (walk > 0)
      legs.forEach((leg, index) =>
        stepLeg(leg, time * 4.2 + index * Math.PI, walk),
      );
    const alpha = instant ? 1 : 1 - Math.exp(-12 * dt);
    bones.forEach((bone, i) => {
      previous[i].slerp(bone.quaternion, alpha).normalize();
      bone.quaternion.copy(previous[i]);
    });
    root.updateMatrixWorld(true);
  }
  // Set the relaxed pose synchronously, before the first rendered frame (also reduced motion).
  update({ type: "idle", id: 0 }, 0, true, undefined, true);
  return { update, hips };
}
