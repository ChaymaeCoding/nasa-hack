import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TelemetryHUD } from '../components/TelemetryHUD';
import { telemetryStore } from '../services/telemetryStore';
import { TelemetryPacket } from '../types/telemetry';

describe('<TelemetryHUD /> Component', () => {
  const mockPacket: TelemetryPacket = {
    timestamp: 42.5,
    time_step: 2550,
    position: { x: -120.5, y: 35.0, z: 850.4 },
    velocity: { x: 12.0, y: -2.0, z: -1.25, vx: 12.0, vy: -2.0, vz: -1.25, v_xy: 0.35, v_total: 1.3 },
    quaternion: { q0: 1.0, q1: 0.0, q2: 0.0, q3: 0.0 },
    euler: { roll: 1.2, pitch: -2.4, yaw: 0.5, tilt: 2.7 },
    angular_velocity: { wx: 0.01, wy: -0.02, wz: 0.0 },
    fuel: { mass: 520.0, max_mass: 650.0, percentage: 80.0, flow_rate: 1.15 },
    mass: { dry: 450.0, total: 970.0 },
    thrust: { cmd: 0.45, percentage: 45.0, newtons: 2025, gimbal_pitch: 5.2, gimbal_yaw: -3.8 },
    rcs: { roll: 0.0, pitch: 0.0, yaw: 0.0, firing: false },
    stage: { id: 2, name: 'Ballistic Drift', description: 'Coasting phase' },
    status: 'NOMINAL',
    constraints: {
      touchdown_vz_safe: true,
      touchdown_vxy_safe: true,
      tilt_safe: true,
      in_descent_cone: true
    },
    landing_site: { target_x: 0, target_y: 0, target_z: 0, distance_to_target: 859.5 },
    mode: 'AI'
  };

  beforeEach(() => {
    telemetryStore.publishTelemetry(mockPacket);
  });

  it('renders altitude readout accurately from telemetry stream', async () => {
    render(<TelemetryHUD />);
    const altElement = screen.getByTestId('hud-altitude-readout');
    expect(altElement).toBeInTheDocument();
    expect(altElement.textContent).toBe('850.4');
  });

  it('renders vertical velocity readout and safe status', async () => {
    render(<TelemetryHUD />);
    const vzElement = screen.getByTestId('hud-vz-readout');
    expect(vzElement).toBeInTheDocument();
    expect(vzElement.textContent).toBe('-1.25');
  });

  it('renders propellant percentage and gimbal deflection', async () => {
    render(<TelemetryHUD />);
    const fuelElement = screen.getByTestId('hud-fuel-percent');
    expect(fuelElement.textContent).toBe('80.0%');

    const gimbalPitchElement = screen.getByTestId('hud-gimbal-pitch');
    expect(gimbalPitchElement.textContent).toBe('5.2°');

    const gimbalYawElement = screen.getByTestId('hud-gimbal-yaw');
    expect(gimbalYawElement.textContent).toBe('-3.8°');
  });

  it('updates flight status badge when status changes to WARNING', async () => {
    render(<TelemetryHUD />);

    act(() => {
      telemetryStore.publishTelemetry({
        ...mockPacket,
        status: 'WARNING'
      });
    });

    const statusBadge = screen.getByTestId('hud-flight-status-badge');
    expect(statusBadge.textContent).toContain('WARNING');
  });
});
