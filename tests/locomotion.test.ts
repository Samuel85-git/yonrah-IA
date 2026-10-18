import { describe, it, expect } from "vitest";
import { createLocomotion } from "../src/locomotion";
import {
  deformCinematicPoint,
  neutralCinematicPose,
} from "../src/cinematic-motion";
describe("semi-3D scene movement", () => {
  it("accelerates, reaches the requested point and stops at different frame rates", () => {
    for (const fps of [4, 30, 60]) {
      const mover = createLocomotion(),
        target = { id: 1, x: 0.8, depth: 0.65 };
      let peak = 0;
      for (let i = 0; i < fps * 8; i++) {
        const s = mover.update(target, 1 / fps, false);
        peak = Math.max(peak, s.speed);
        expect(Math.abs(s.x)).toBeLessThanOrEqual(1);
        expect(s.depth).toBeGreaterThanOrEqual(0);
        expect(s.depth).toBeLessThanOrEqual(1);
      }
      expect(peak).toBeGreaterThan(0.2);
      expect(mover.state.x).toBeCloseTo(0.8, 3);
      expect(mover.state.depth).toBeCloseTo(0.65, 3);
      expect(mover.state.moving).toBe(false);
    }
  });
  it("clamps destinations, settles after suspension, and rejects invalid positions", () => {
    const m = createLocomotion();
    m.update({ id: 1, x: 99, depth: -1 }, 3600, false);
    expect(m.state.x).toBeCloseTo(1, 3);
    expect(m.state.depth).toBe(0);
    m.update({ id: 2, x: NaN, depth: Infinity }, 5, false);
    for (const value of [m.state.x, m.state.depth, m.state.speed])
      expect(Number.isFinite(value)).toBe(true);
  });
  it("stops on request and resets the scene without drift", () => {
    const m = createLocomotion();
    for (let i = 0; i < 60; i++)
      m.update({ id: 1, x: 1, depth: 0.5 }, 1 / 60, false);
    const x = m.state.x,
      z = m.state.depth;
    for (let i = 0; i < 300; i++)
      m.update({ id: 2, x: 0, depth: 0, stop: true }, 1 / 60, false);
    expect(m.state.x).toBe(x);
    expect(m.state.depth).toBe(z);
    expect(m.state.moving).toBe(false);
    m.reset();
    expect(m.state.x).toBe(0);
    expect(m.state.depth).toBe(0);
  });
  it("honors reduced motion with immediate requested placement and no gait", () => {
    const m = createLocomotion();
    const s = m.update({ id: 1, x: -0.6, depth: 0.7 }, 1 / 60, true);
    expect(s.x).toBe(-0.6);
    expect(s.depth).toBe(0.7);
    expect(s.moving).toBe(false);
    expect(s.stride).toBe(0);
  });
  it("moves alternating lower limbs only while walking and preserves the resting soles", () => {
    const pose = neutralCinematicPose();
    expect(deformCinematicPoint(0.25, 0, pose)).toEqual({
      x: 0.25,
      y: 0,
      z: 0,
    });
    pose.stride = 1;
    pose.step = Math.PI / 2;
    const left = deformCinematicPoint(-0.4, 0.1, pose),
      right = deformCinematicPoint(0.4, 0.1, pose);
    expect(left.x).toBeLessThan(-0.4);
    expect(right.x).toBeGreaterThan(0.4);
    for (const value of Object.values(left))
      expect(Number.isFinite(value)).toBe(true);
  });
});
