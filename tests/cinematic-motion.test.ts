import { describe, expect, it } from "vitest";
import {
  advanceSpring,
  createCinematicMotion,
  deformCinematicPoint,
  neutralCinematicPose,
} from "../src/cinematic-motion";

describe("cinematic artwork motion", () => {
  it("keeps damped fabric finite after a suspended tab and settles without residual drift", () => {
    const spring = { value: 0.2, velocity: -4 };
    advanceSpring(spring, 0.015, 3600);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Number.isFinite(spring.velocity)).toBe(true);
    for (let i = 0; i < 900; i++) advanceSpring(spring, 0, 1 / 60);
    expect(Math.abs(spring.value)).toBeLessThan(1e-8);
    expect(Math.abs(spring.velocity)).toBeLessThan(1e-8);
  });
  it("breathes through the torso while fixing the ground contact vertices", () => {
    const motion = createCinematicMotion();
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let i = 0; i < 1000; i++) {
      const pose = motion.update({ type: "walk", id: 1 }, 1 / 60, false);
      const foot = deformCinematicPoint(0.32, 0, pose);
      expect(foot).toEqual({ x: 0.32, y: 0, z: 0 });
      const chest = deformCinematicPoint(0.2, 0.7, pose);
      minimum = Math.min(minimum, chest.y);
      maximum = Math.max(maximum, chest.y);
    }
    expect(maximum - minimum).toBeGreaterThan(0.002);
    expect(maximum - minimum).toBeLessThan(0.02);
  });
  it("stops every dynamic deformation for reduced motion, even during touch and activity", () => {
    const motion = createCinematicMotion();
    for (let i = 0; i < 60; i++)
      motion.update({ type: "walk", id: 1 }, 1 / 60, false);
    const pose = motion.update({ type: "greet", id: 2 }, 1 / 60, true, {
      id: 1,
      x: 1,
      y: 1,
      zone: "head",
      variant: 0,
    });
    expect(pose).toEqual(neutralCinematicPose());
    for (const [x, y] of [
      [-0.4, 0.4],
      [0.2, 0.7],
      [0, 0.9],
    ]) {
      expect(deformCinematicPoint(x, y, pose)).toEqual({ x, y, z: 0 });
    }
  });
  it("layers directional contact over thinking and settles back to the same activity", () => {
    const baseline = createCinematicMotion();
    const touched = createCinematicMotion();
    const action = { type: "thinking" as const, id: 1 };
    let peakHeadDifference = 0;
    for (let i = 0; i < 600; i++) {
      const a = baseline.update(action, 1 / 60, false);
      const b = touched.update(action, 1 / 60, false, {
        id: 1,
        x: 0.8,
        y: 0.9,
        zone: "head",
        variant: 0,
      });
      peakHeadDifference = Math.max(
        peakHeadDifference,
        Math.abs(a.headX - b.headX),
      );
      if (i > 500) {
        expect(b.headX).toBeCloseTo(a.headX, 7);
        expect(b.headY).toBeCloseTo(a.headY, 7);
        expect(b.cloth).toBeCloseTo(a.cloth, 7);
      }
    }
    expect(peakHeadDifference).toBeGreaterThan(0.004);
    expect(touched.pose.headY).toBeCloseTo(-0.0045, 6);
  });
  it("does not flinch when the background is touched", () => {
    const motion = createCinematicMotion();
    const reaction = { id: 1, x: 1, y: 1, zone: "space" as const, variant: 0 };
    for (let i = 0; i < 60; i++) {
      expect(
        motion.update({ type: "idle", id: 1 }, 1 / 60, false, reaction).contact,
      ).toBe(0);
    }
  });
  it("completes a gesture at the same real time on a slow device and after a paused tab", () => {
    for (const fps of [4, 30, 60]) {
      const motion = createCinematicMotion();
      for (let i = 0; i < fps * 4; i++)
        motion.update({ type: "greet", id: 1 }, 1 / fps, false);
      expect(motion.pose.torsoY).toBeCloseTo(0, 9);
      expect(motion.pose.headY).toBeCloseTo(0, 9);
      motion.update({ type: "greet", id: 1 }, 3600, false);
      for (const value of Object.values(motion.pose))
        expect(Number.isFinite(value)).toBe(true);
      expect(motion.pose.torsoY).toBeCloseTo(0, 9);
    }
  });
});
