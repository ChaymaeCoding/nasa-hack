import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissionChecklist } from '../components/MissionChecklist';
import { telemetryStore } from '../services/telemetryStore';
import { TelemetryPacket } from '../types/telemetry';

describe('<MissionChecklist /> Component', () => {
  const basePacket: TelemetryPacket = {
    timestamp: 88.0,
    time_step: 5280,
    position: { x: -45.0, y: 10.0, z: 280.0 },
    velocity: { x: 4.0, y: -0.5, z: -2.8, vx: 4.0, vy: -0.5, vz: -2.8, v_xy: 0.45, v_total: 4.8 },
    quaternion: { q0: 1.0, q1: 0.0, q2: 0.0, q3: 0.0 },
    euler: { roll: 0.0, pitch: 0.0, yaw: 0.0, tilt: 2.1 },
    angular_velocity: { wx: 0.0, wy: 0.0, wz: 0.0 },
    fuel: { mass: 410.0, max_mass: 650.0, percentage: 63.1, flow_rate: 1.8 },
    mass: { dry: 450.0, total: 860.0 },
    thrust: { cmd: 0.65, percentage: 65.0, newtons: 2925, gimbal_pitch: 2.0, gimbal_yaw: -1.0 },
    rcs: { roll: 0.0, pitch: 0.0, yaw: 0.0, firing: false },
    stage: { id: 3, name: 'Autonomous Divert', description: 'Lateral hazard avoidance' },
    status: 'NOMINAL',
    constraints: {
      touchdown_vz_safe: false, // 2.8 > 1.5/2.0
      touchdown_vxy_safe: true,
      tilt_safe: true,
      in_descent_cone: true
    },
    landing_site: { target_x: 0, target_y: 0, target_z: 0, distance_to_target: 283.6 },
    mode: 'AI'
  };

  beforeEach(() => {
    telemetryStore.publishTelemetry(basePacket);
  });

  it('renders all 5 flight stages in the checklist', () => {
    render(<MissionChecklist />);
    expect(screen.getByText(/Phase 1: Deorbit Burn/i)).toBeInTheDocument();
    expect(screen.getByText(/Phase 2: Ballistic Drift/i)).toBeInTheDocument();
    expect(screen.getByText(/Phase 3: Autonomous Divert/i)).toBeInTheDocument();
    expect(screen.getByText(/Phase 4: Suicide Burn/i)).toBeInTheDocument();
    expect(screen.getByText(/Phase 5: Touchdown & Debrief/i)).toBeInTheDocument();
  });

  it('marks prior stages as COMPLETED and current stage as ACTIVE', () => {
    render(<MissionChecklist />);

    // Since stage is 3:
    // Stages 1 and 2 should be COMPLETED
    // Stage 3 should be ACTIVE
    // Stages 4 and 5 should be PENDING
    const completedBadges = screen.getAllByText('COMPLETED');
    expect(completedBadges.length).toBe(2);

    const activeBadge = screen.getByText('ACTIVE');
    expect(activeBadge).toBeInTheDocument();
  });

  it('updates constraint display when touchdown constraints are violated', () => {
    render(<MissionChecklist />);
    // In basePacket, touchdown_vz_safe is false -> should show WARN
    expect(screen.getByText('WARN')).toBeInTheDocument();
  });
});
