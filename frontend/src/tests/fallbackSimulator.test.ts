import { describe, it, expect, beforeEach } from 'vitest';
import { FallbackLunarSimulator } from '../services/fallbackTelemetry';

describe('Fallback Lunar Flight Simulator (RK4 & 6-DOF)', () => {
  let sim: FallbackLunarSimulator;

  beforeEach(() => {
    sim = new FallbackLunarSimulator();
    sim.reset(1450.0);
  });

  it('initializes with correct mass and physical parameters', () => {
    const packet = sim.buildTelemetryPacket();
    expect(packet.mass.dry).toBe(450.0);
    expect(packet.fuel.max_mass).toBe(650.0);
    expect(packet.mass.total).toBe(1100.0);
    expect(packet.position.z).toBe(1450.0);
    expect(packet.stage.id).toBe(1);
    expect(packet.status).toBe('NOMINAL');
  });

  it('depletes fuel mass over time when thrust is active', () => {
    const initialFuel = sim.buildTelemetryPacket().fuel.mass;

    // Step physics for 1.0 second (60 steps @ 1/60s)
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }

    const currentFuel = sim.buildTelemetryPacket().fuel.mass;
    expect(currentFuel).toBeLessThan(initialFuel);
    expect(currentFuel).toBeGreaterThan(0.0);
  });

  it('accelerates downward under lunar gravity when unpowered', () => {
    sim.reset(1000.0);
    sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0, gimbal_pitch: 0, gimbal_yaw: 0 });

    const initialVz = sim.buildTelemetryPacket().velocity.vz;
    // Step for 1 second with 0 thrust: vz should change by approximately -1.62 m/s
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }

    const newVz = sim.buildTelemetryPacket().velocity.vz;
    expect(newVz).toBeLessThan(initialVz);
    expect(newVz - initialVz).toBeCloseTo(-1.62, 1);
  });

  it('clamps nozzle gimbal deflection to hardware limits [-20, +20 degrees]', () => {
    sim.setPilotCommand({ mode: 'MANUAL', gimbal_pitch: 35.0, gimbal_yaw: -45.0 });
    const packet = sim.step(1 / 60);

    expect(packet.thrust.gimbal_pitch).toBeLessThanOrEqual(20.0);
    expect(packet.thrust.gimbal_pitch).toBeGreaterThanOrEqual(-20.0);
    expect(packet.thrust.gimbal_yaw).toBeLessThanOrEqual(20.0);
    expect(packet.thrust.gimbal_yaw).toBeGreaterThanOrEqual(-20.0);
  });

  it('resets simulator state cleanly upon reset() call', () => {
    for (let i = 0; i < 100; i++) {
      sim.step(1 / 60);
    }

    sim.reset(1200.0);
    const packet = sim.buildTelemetryPacket();
    expect(packet.position.z).toBe(1200.0);
    expect(packet.fuel.mass).toBe(650.0);
    expect(packet.timestamp).toBe(0.0);
  });
});
