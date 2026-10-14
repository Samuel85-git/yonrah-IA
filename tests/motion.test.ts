import { readFileSync } from "node:fs";
import { Bone, Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createMotion } from "../src/motion";
import type { Motion } from "../src/types";

// Exercise the shipped GLB's real hierarchy and bind transforms, not a mock rig.
function rig() {
  const bytes = readFileSync("public/models/2b.glb");
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  const joints = new Set<number>(gltf.skins[0].joints);
  const nodes = gltf.nodes.map((n: any, i: number) => {
    const o = joints.has(i) ? new Bone() : new Group();
    o.name = n.name || "";
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  gltf.nodes.forEach((n: any, i: number) =>
    n.children?.forEach((c: number) => nodes[i].add(nodes[c])),
  );
  const root = new Group();
  nodes.filter((n: Group) => !n.parent).forEach((n: Group) => root.add(n));
  const bones = [...joints].map((i) => nodes[i] as Bone);
  const find = (part: string) =>
    bones.find((b) => b.name.includes(`:${part}_`))!;
  const pos = (part: string) => find(part).getWorldPosition(new Vector3());
  return { root, bones, find, pos, motion: createMotion(root, bones) };
}
describe("2B animation regressions", () => {
  it("breathes through the chest without moving the planted feet or accumulating scale", () => {
    const r = rig();
    const feet = [r.pos("LeftFoot"), r.pos("RightFoot")];
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < 900; i++) {
      r.motion.update({ type: "idle", id: 1 }, 1 / 60, false);
      min = Math.min(min, r.find("Spine2").scale.y);
      max = Math.max(max, r.find("Spine2").scale.y);
      expect(r.pos("LeftFoot").distanceTo(feet[0])).toBeLessThan(1e-6);
      expect(r.pos("RightFoot").distanceTo(feet[1])).toBeLessThan(1e-6);
    }
    expect(max - min).toBeGreaterThan(0.02);
    expect(max).toBeLessThan(1.013);
    expect(min).toBeGreaterThan(0.987);
    for (let i = 0; i < 200; i++)
      r.motion.update({ type: "idle", id: 1 }, 1 / 60, true);
    expect(r.find("Spine2").scale.y).toBeCloseTo(1, 6);
  });
  it("layers a directional touch over thinking and returns to that same activity", () => {
    const baseline = rig(),
      touched = rig();
    for (let i = 0; i < 300; i++) {
      baseline.motion.update({ type: "thinking", id: 1 }, 1 / 60, false);
      touched.motion.update(
        { type: "thinking", id: 1 },
        1 / 60,
        false,
        undefined,
        false,
        { id: 1, x: 0.8, y: 0.8, zone: "head", variant: 0 },
      );
      if (i === 40)
        expect(
          touched
            .find("Head")
            .quaternion.angleTo(baseline.find("Head").quaternion),
        ).toBeGreaterThan(0.06);
    }
    touched.bones.forEach((b, i) =>
      expect(b.quaternion.angleTo(baseline.bones[i].quaternion)).toBeLessThan(
        1e-5,
      ),
    );
    const quiet = rig();
    for (let i = 0; i < 120; i++)
      quiet.motion.update(
        { type: "idle", id: 1 },
        1 / 60,
        true,
        undefined,
        false,
        { id: i, x: 1, y: 1, zone: "head", variant: 1 },
      );
    const neutral = rig();
    quiet.bones.forEach((b, i) =>
      expect(b.quaternion.angleTo(neutral.bones[i].quaternion)).toBeLessThan(
        1e-6,
      ),
    );
  });
  it("completes the raised greeting at low frame rates as well as at 60 fps", () => {
    for (const fps of [4, 30, 60]) {
      const r = rig();
      for (let i = 0; i < fps * 2; i++)
        r.motion.update({ type: "greet", id: 1 }, 1 / fps, false);
      expect(r.pos("RightHand").y).toBeGreaterThan(
        r.pos("RightForeArm").y + 10,
      );
    }
  });

  it("starts with arms down before the first frame, including reduced motion", () => {
    const r = rig();
    for (const side of ["Left", "Right"]) {
      expect(r.pos(side + "Arm").y - r.pos(side + "Hand").y).toBeGreaterThan(
        40,
      );
      expect(
        Math.abs(r.pos(side + "Hand").x - r.pos(side + "Arm").x),
      ).toBeLessThan(12);
    }
    const pose = r.bones.map((b) => b.quaternion.clone());
    for (let i = 0; i < 1000; i++)
      r.motion.update({ type: "greet", id: 1 }, 1 / 60, true);
    r.bones.forEach((b, i) =>
      expect(b.quaternion.angleTo(pose[i])).toBeLessThan(1e-6),
    );
  });
  it("keeps all seven actions finite and normalized and feet within a small step of the floor", () => {
    const r = rig();
    const home = [r.pos("LeftFoot"), r.pos("RightFoot")];
    const lengths = r.bones.map((b) => b.position.length());
    const actions: Motion[] = [
      "idle",
      "greet",
      "agree",
      "walk",
      "focus",
      "thinking",
      "speak",
    ];
    for (const [id, type] of actions.entries()) {
      for (let frame = 0; frame < 480; frame++) {
        r.motion.update({ type, id }, 1 / 60, false, { x: 0.8, y: -0.5 });
        r.bones.forEach((b, i) => {
          expect(b.quaternion.length()).toBeCloseTo(1, 6);
          expect(b.position.length()).toBeCloseTo(lengths[i], 8);
        });
        for (const [i, side] of ["Left", "Right"].entries()) {
          expect(r.pos(side + "Foot").y).toBeGreaterThan(home[i].y - 0.6);
          expect(r.pos(side + "Foot").distanceTo(home[i])).toBeLessThan(10);
        }
      }
    }
  });
  it("transitions continuously on interruption and returns to the same neutral pose without drift", () => {
    const r = rig();
    for (let i = 0; i < 120; i++)
      r.motion.update({ type: "greet", id: 1 }, 1 / 60, false);
    const last = r.bones.map((b) => b.quaternion.clone());
    r.motion.update({ type: "walk", id: 2 }, 1 / 60, false);
    r.bones.forEach((b, i) =>
      expect(b.quaternion.angleTo(last[i])).toBeLessThan(0.5),
    );
    for (let i = 0; i < 200; i++)
      r.motion.update({ type: "idle", id: 3 }, 1 / 60, true);
    const neutral = rig();
    r.bones.forEach((b, i) =>
      expect(b.quaternion.angleTo(neutral.bones[i].quaternion)).toBeLessThan(
        1e-6,
      ),
    );
  });
});
