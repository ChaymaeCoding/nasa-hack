import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as THREE from 'three';
import { TelemetryHUD } from '../components/TelemetryHUD';
import { TrajectoryPlot } from '../components/TrajectoryPlot';
import { LanderModel } from '../graphics/LanderModel';
import { VacuumPlume } from '../graphics/VacuumPlumeShader';
import { DustAgitationEmitter } from '../graphics/DustAgitationEmitter';
import { calculateTilt, quaternionToEulerDegrees } from '../services/fallbackTelemetry';
import { telemetryStore } from '../services/telemetryStore';
import { TelemetryPacket } from '../types/telemetry';

function createMockPacket(overrides?: Partial<TelemetryPacket>): TelemetryPacket {
  return {
    timestamp: 42.5,
    time_step: 2550,
    position: { x: -120.0, y: 15.0, z: 240.0 },
    velocity: { x: -2.0, y: 0.5, z: -1.2, vx: -2.0, vy: 0.5, vz: -1.2, v_xy: 2.06, v_total: 2.38 },
    quaternion: { q0: 1.0, q1: 0.0, q2: 0.0, q3: 0.0 },
    euler: { roll: 0.0, pitch: 0.0, yaw: 0.0, tilt: 0.0 },
    angular_velocity: { wx: 0.0, wy: 0.0, wz: 0.0 },
    fuel: { mass: 450.0, max_mass: 650.0, percentage: 69.2, flow_rate: 1.48 },
    mass: { dry: 450.0, total: 900.0 },
    thrust: { cmd: 0.65, percentage: 65.0, newtons: 2925, gimbal_pitch: 0.0, gimbal_yaw: 0.0 },
    rcs: { roll: 0.0, pitch: 0.0, yaw: 0.0, firing: false },
    stage: { id: 3, name: 'Autonomous Divert', description: 'Lateral alignment with target pad' },
    status: 'NOMINAL',
    constraints: {
      touchdown_vz_safe: true,
      touchdown_vxy_safe: false,
      tilt_safe: true,
      in_descent_cone: true
    },
    landing_site: { target_x: 0, target_y: 0, target_z: 0, distance_to_target: 268.4 },
    mode: 'AI',
    ...overrides
  };
}

describe('Adversarial Stress: Extreme Telemetry Inputs & Mathematical Robustness', () => {
  let lander: LanderModel;

  beforeEach(() => {
    lander = new LanderModel();
  });

  afterEach(() => {
    lander.dispose();
  });

  describe('1. Gimbal Angles Exceeding ±20.0° Clamping & Handling', () => {
    it('strictly clamps positive and negative gimbal angles exceeding ±20° in LanderModel', () => {
      // Test extreme positive angles
      lander.updateTelemetry(0, 0, 100, 1, 0, 0, 0, 45.0, 75.0, 1.0, 1.0);
      const pitchRad = lander.nozzlePivot.rotation.x;
      const yawRad = lander.nozzlePivot.rotation.z;

      expect(pitchRad).toBeCloseTo(THREE.MathUtils.degToRad(20.0), 4);
      expect(yawRad).toBeCloseTo(THREE.MathUtils.degToRad(20.0), 4);

      // Test extreme negative angles
      lander.updateTelemetry(0, 0, 100, 1, 0, 0, 0, -85.0, -120.0, 1.0, 2.0);
      expect(lander.nozzlePivot.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(-20.0), 4);
      expect(lander.nozzlePivot.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(-20.0), 4);

      // Test mega-extreme boundary (1,000,000 degrees)
      lander.updateTelemetry(0, 0, 100, 1, 0, 0, 0, 1e6, -1e6, 1.0, 3.0);
      expect(lander.nozzlePivot.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(20.0), 4);
      expect(lander.nozzlePivot.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(-20.0), 4);
    });

    it('renders HUD without crashing when thrust gimbal pitch and yaw exceed ±20°', () => {
      const packet = createMockPacket({
        thrust: { cmd: 1.0, percentage: 100, newtons: 4500, gimbal_pitch: 90.0, gimbal_yaw: -90.0 }
      });
      telemetryStore.publishTelemetry(packet);

      const { unmount } = render(<TelemetryHUD />);
      expect(screen.getByTestId('hud-gimbal-pitch')).toHaveTextContent('90.0°');
      expect(screen.getByTestId('hud-gimbal-yaw')).toHaveTextContent('-90.0°');
      unmount();
    });
  });

  describe('2. Negative and Zero Propellant Handling', () => {
    it('safely renders HUD when propellant mass, percentage, and flow rate are negative', () => {
      const packet = createMockPacket({
        fuel: { mass: -25.0, max_mass: 650.0, percentage: -10.5, flow_rate: -1.2 }
      });
      telemetryStore.publishTelemetry(packet);

      const { unmount } = render(<TelemetryHUD />);
      const fuelPercent = screen.getByTestId('hud-fuel-percent');
      expect(fuelPercent).toHaveTextContent('-10.5%');
      // Low fuel condition should trigger red alert styling
      const fuelProgressBar = fuelPercent.closest('.aerospace-panel')?.querySelector('.bg-red-500');
      expect(fuelProgressBar).toBeTruthy();
      unmount();
    });

    it('handles zero fuel cleanly in HUD', () => {
      const packet = createMockPacket({
        fuel: { mass: 0.0, max_mass: 650.0, percentage: 0.0, flow_rate: 0.0 }
      });
      telemetryStore.publishTelemetry(packet);

      const { unmount } = render(<TelemetryHUD />);
      expect(screen.getByTestId('hud-fuel-percent')).toHaveTextContent('0.0%');
      unmount();
    });
  });

  describe('3. Extreme Descent Velocities (>10 m/s)', () => {
    it('activates CRITICAL safety badge on HUD when vertical descent velocity is extreme (> 3.0 m/s)', () => {
      const extremeVzPacket = createMockPacket({
        velocity: { x: 0, y: 0, z: -18.5, vx: 0, vy: 0, vz: -18.5, v_xy: 0.0, v_total: 18.5 }
      });
      telemetryStore.publishTelemetry(extremeVzPacket);

      const { unmount } = render(<TelemetryHUD />);
      const vzReadout = screen.getByTestId('hud-vz-readout');
      expect(vzReadout).toHaveTextContent('-18.50');
      // Must be styled with critical red
      expect(vzReadout).toHaveClass('text-red-400');
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      unmount();
    });

    it('handles supersonic downward velocity (>100 m/s) without UI overflow or exception', () => {
      const hyperPacket = createMockPacket({
        velocity: { x: 45.0, y: 12.0, z: -250.0, vx: 45.0, vy: 12.0, vz: -250.0, v_xy: 46.57, v_total: 254.3 }
      });
      telemetryStore.publishTelemetry(hyperPacket);

      const { unmount } = render(<TelemetryHUD />);
      expect(screen.getByTestId('hud-vz-readout')).toHaveTextContent('-250.00');
      expect(screen.getByTestId('hud-vxy-readout')).toHaveTextContent('46.57');
      expect(screen.getByText('WARN')).toBeInTheDocument();
      unmount();
    });
  });

  describe('4. Inverted and Boundary Attitude Quaternions', () => {
    it('calculates 180° tilt for full 180° inversion quaternions', () => {
      // Inverted around X-axis: q = [w=0, x=1, y=0, z=0]
      const tiltX = calculateTilt(0.0, 1.0, 0.0, 0.0);
      expect(tiltX).toBeCloseTo(180.0, 2);

      // Inverted around Y-axis: q = [w=0, x=0, y=1, z=0]
      const tiltY = calculateTilt(0.0, 0.0, 1.0, 0.0);
      expect(tiltY).toBeCloseTo(180.0, 2);

      // Yaw 180° around Z-axis (lander still upright vertical, pointing in reverse azimuth)
      const tiltZ = calculateTilt(0.0, 0.0, 0.0, 1.0);
      expect(tiltZ).toBeCloseTo(0.0, 2);
    });

    it('calculates exact 90° and 45° tilt angles', () => {
      // 90° pitch around X: cos(45°) = sin(45°) ≈ 0.7071
      const q_90 = calculateTilt(Math.SQRT1_2, Math.SQRT1_2, 0, 0);
      expect(q_90).toBeCloseTo(90.0, 2);

      // 45° pitch around X: cos(22.5°), sin(22.5°)
      const rad22_5 = (22.5 * Math.PI) / 180;
      const q_45 = calculateTilt(Math.cos(rad22_5), Math.sin(rad22_5), 0, 0);
      expect(q_45).toBeCloseTo(45.0, 2);
    });

    it('handles gimbal lock pitch = ±90° in quaternionToEulerDegrees', () => {
      // Gimbal lock pitch = +90°
      const qLockPos = { q0: Math.SQRT1_2, q1: 0, q2: Math.SQRT1_2, q3: 0 };
      const eulerPos = quaternionToEulerDegrees(qLockPos.q0, qLockPos.q1, qLockPos.q2, qLockPos.q3);
      expect(eulerPos.pitch).toBeCloseTo(90.0, 2);
      expect(Number.isFinite(eulerPos.roll)).toBe(true);
      expect(Number.isFinite(eulerPos.yaw)).toBe(true);

      // Gimbal lock pitch = -90°
      const qLockNeg = { q0: Math.SQRT1_2, q1: 0, q2: -Math.SQRT1_2, q3: 0 };
      const eulerNeg = quaternionToEulerDegrees(qLockNeg.q0, qLockNeg.q1, qLockNeg.q2, qLockNeg.q3);
      expect(eulerNeg.pitch).toBeCloseTo(-90.0, 2);
      expect(Number.isFinite(eulerNeg.roll)).toBe(true);
      expect(Number.isFinite(eulerNeg.yaw)).toBe(true);
    });

    it('does not produce NaN for unnormalized or out-of-range quaternions in calculateTilt', () => {
      // Unnormalized quaternion with large components
      const unnormTilt = calculateTilt(3.0, 4.0, 5.0, 0.0);
      expect(Number.isNaN(unnormTilt)).toBe(false);
      expect(unnormTilt).toBeGreaterThanOrEqual(0.0);
      expect(unnormTilt).toBeLessThanOrEqual(180.0);
    });
  });

  describe('5. Zero and Negative Altitude Rendering', () => {
    it('correctly formats and renders zero altitude (touchdown)', () => {
      const packet = createMockPacket({
        position: { x: 0.0, y: 0.0, z: 0.0 },
        velocity: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, v_xy: 0, v_total: 0 },
        status: 'TOUCHDOWN'
      });
      telemetryStore.publishTelemetry(packet);

      const { unmount } = render(<TelemetryHUD />);
      expect(screen.getByTestId('hud-altitude-readout')).toHaveTextContent('0.0');
      expect(screen.getByTestId('hud-flight-status-badge')).toHaveTextContent('STATUS: TOUCHDOWN');
      unmount();
    });

    it('TrajectoryPlot SVG gracefully handles zero and negative altitude and extreme downrange', () => {
      telemetryStore.resetHistory();
      const packet1 = createMockPacket({ position: { x: -600.0, y: 0, z: 1600.0 } });
      const packet2 = createMockPacket({ position: { x: 300.0, y: 0, z: -20.0 } });
      telemetryStore.publishTelemetry(packet1);
      telemetryStore.publishTelemetry(packet2);

      const { container, unmount } = render(<TrajectoryPlot />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      unmount();
    });
  });

  describe('6. 3D Graphics Subsystem Resilience Against NaN and Extreme Inputs', () => {
    it('LanderModel updateTelemetry tolerates NaN and Infinite inputs without unhandled exception', () => {
      expect(() => {
        lander.updateTelemetry(NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN);
      }).not.toThrow();

      expect(() => {
        lander.updateTelemetry(Infinity, -Infinity, 100, 1, 0, 0, 0, 10, -10, 0.5, 10);
      }).not.toThrow();
    });

    it('VacuumPlume shader updates gracefully with negative, NaN, and >1 thrust commands', () => {
      const plume = new VacuumPlume();
      expect(() => {
        plume.update(0.0, -0.5);
        expect(plume.mesh.visible).toBe(false);

        plume.update(1.0, 5.0); // should clamp to 1.0
        expect(plume.mesh.visible).toBe(true);

        plume.update(2.0, NaN);
        expect(plume.mesh.visible).toBe(false);
      }).not.toThrow();
      plume.dispose();
    });

    it('DustAgitationEmitter updates without exception under NaN altitude and negative thrust', () => {
      const dust = new DustAgitationEmitter(500);
      const pos = new THREE.Vector3(0, 5, 0);

      expect(() => {
        dust.update(0.016, pos, NaN, NaN);
        dust.update(0.016, pos, -10.0, 1.0);
        dust.update(0.016, pos, 0.0, 0.0);
      }).not.toThrow();

      dust.dispose();
    });
  });
});
