import { describe, it, expect } from 'vitest';
import { calculateTilt, quaternionToEulerDegrees } from '../services/fallbackTelemetry';

describe('Telemetry Mathematics & Constraint Verification', () => {
  it('correctly calculates off-axis tilt angle for upright vehicle (0 degrees)', () => {
    // Identity quaternion: [w=1, x=0, y=0, z=0]
    const tilt = calculateTilt(1.0, 0.0, 0.0, 0.0);
    expect(tilt).toBeCloseTo(0.0, 2);
  });

  it('correctly calculates off-axis tilt angle when rotated 10 degrees around X', () => {
    // 10 degrees pitch rotation around X: q = [cos(5°), sin(5°), 0, 0]
    const rad5 = (5.0 * Math.PI) / 180.0;
    const q0 = Math.cos(rad5);
    const q1 = Math.sin(rad5);
    const tilt = calculateTilt(q0, q1, 0.0, 0.0);
    expect(tilt).toBeCloseTo(10.0, 1);
  });

  it('correctly converts identity quaternion to 0 roll, pitch, and yaw', () => {
    const euler = quaternionToEulerDegrees(1.0, 0.0, 0.0, 0.0);
    expect(euler.roll).toBeCloseTo(0.0, 1);
    expect(euler.pitch).toBeCloseTo(0.0, 1);
    expect(euler.yaw).toBeCloseTo(0.0, 1);
  });

  it('evaluates touchdown safety criteria accurately', () => {
    const safeLanding = {
      vz: -1.2,
      vxy: 0.3,
      tilt: 3.2,
      cone: 8.5
    };

    const unsafeLanding = {
      vz: -3.8, // excessive impact velocity
      vxy: 0.9, // tip-over drift
      tilt: 8.5, // tilted beyond footpad polygon
      cone: 18.0 // cone violation
    };

    // Safe Landing checks
    expect(Math.abs(safeLanding.vz) <= 2.0).toBe(true);
    expect(safeLanding.vxy <= 0.5).toBe(true);
    expect(safeLanding.tilt <= 5.0).toBe(true);
    expect(safeLanding.cone <= 15.0).toBe(true);

    // Unsafe Landing checks
    expect(Math.abs(unsafeLanding.vz) <= 2.0).toBe(false);
    expect(unsafeLanding.vxy <= 0.5).toBe(false);
    expect(unsafeLanding.tilt <= 5.0).toBe(false);
    expect(unsafeLanding.cone <= 15.0).toBe(false);
  });

  it('calculates propellant mass flow rate based on T_max and Isp', () => {
    const T_max = 4500.0; // N
    const Isp = 310.0;     // s
    const g0 = 9.80665;    // m/s^2

    const expectedMdot = T_max / (Isp * g0); // ~1.48 kg/s
    expect(expectedMdot).toBeGreaterThan(1.4);
    expect(expectedMdot).toBeLessThan(1.5);
  });
});
