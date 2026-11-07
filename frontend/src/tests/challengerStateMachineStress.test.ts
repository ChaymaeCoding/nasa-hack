import { describe, it, expect, beforeEach } from 'vitest';
import { FallbackLunarSimulator } from '../services/fallbackTelemetry';

describe('CHALLENGER: Mission Checklist & State Machine Stress Harness', () => {
  let sim: FallbackLunarSimulator;

  beforeEach(() => {
    sim = new FallbackLunarSimulator();
    sim.reset(1450.0);
  });

  describe('1. Normal Flight (AI Autonomous) 5-Stage Transitions', () => {
    it('accurately transitions through all 5 stages in order based on altitude', () => {
      // Stage 1: Deorbit Burn (z > 950m)
      sim.reset(1200.0);
      let pkt = sim.step(1 / 60);
      expect(pkt.stage.id).toBe(1);
      expect(pkt.stage.name).toBe('Deorbit Burn');

      // Stage 2: Ballistic Drift (550m < z <= 950m)
      sim.reset(800.0);
      pkt = sim.step(1 / 60);
      expect(pkt.stage.id).toBe(2);
      expect(pkt.stage.name).toBe('Ballistic Drift');

      // Stage 3: Autonomous Divert (180m < z <= 550m)
      sim.reset(400.0);
      pkt = sim.step(1 / 60);
      expect(pkt.stage.id).toBe(3);
      expect(pkt.stage.name).toBe('Autonomous Divert');

      // Stage 4: Suicide Burn (0.05m < z <= 180m)
      sim.reset(100.0);
      pkt = sim.step(1 / 60);
      expect(pkt.stage.id).toBe(4);
      expect(pkt.stage.name).toBe('Suicide Burn');

      // Stage 5: Touchdown (z <= 0.05m / z <= 0.0)
      sim.reset(0.02);
      pkt = sim.step(1 / 60);
      expect(pkt.stage.id).toBe(5);
    });

    it('reaches soft precision touchdown (Stage 5) when descent constraints are met', () => {
      sim.reset(0.1);
      // Give safe initial velocities and attitude
      const s = (sim as any).state;
      s.vx = 0.1;
      s.vy = 0.0;
      s.vz = -0.8; // Safe Vz (< 2.0 m/s)
      s.q0 = 1.0;
      s.q1 = 0.0;
      s.q2 = 0.0;
      s.q3 = 0.0;

      // Step until contact (z <= 0)
      for (let i = 0; i < 20; i++) {
        sim.step(1 / 60);
        if (s.z <= 0) break;
      }

      const pkt = sim.buildTelemetryPacket();
      expect(pkt.stage.id).toBe(5);
      expect(pkt.status).toBe('TOUCHDOWN');
      expect(pkt.constraints.touchdown_vz_safe).toBe(true);
      expect(pkt.constraints.touchdown_vxy_safe).toBe(true);
      expect(pkt.constraints.tilt_safe).toBe(true);
    });
  });

  describe('2. Manual Override Stage Progression Stress Test', () => {
    it('investigates whether stage progression updates when switched to MANUAL flight mode', () => {
      // Start in Stage 1 at 1450m
      sim.reset(1450.0);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.1 });
      let pkt = sim.buildTelemetryPacket();
      expect(pkt.mode).toBe('MANUAL');
      expect(pkt.stage.id).toBe(1);

      // Descend in MANUAL mode to 700m (which corresponds to Stage 2: Ballistic Drift)
      // Step physics until altitude crosses 950m boundary
      while (pkt.position.z > 700.0) {
        pkt = sim.step(1 / 60);
      }

      // Check current stage under manual override:
      // Does it transition to Stage 2 or does it remain frozen at Stage 1?
      const manualStageAt700 = pkt.stage.id;
      // In the implementation, updateAIGuidance is only called if s.mode === 'AI'
      // If mode === 'MANUAL', stageId is not updated during descent until touchdown.
      console.log('[CHALLENGER STRESS] In MANUAL mode at z =', pkt.position.z, 'stageId is:', manualStageAt700);

      // Descend further to 300m (which corresponds to Stage 3: Autonomous Divert)
      while (pkt.position.z > 300.0) {
        pkt = sim.step(1 / 60);
      }
      const manualStageAt300 = pkt.stage.id;
      console.log('[CHALLENGER STRESS] In MANUAL mode at z =', pkt.position.z, 'stageId is:', manualStageAt300);

      // Descend further to 50m (which corresponds to Stage 4: Suicide Burn)
      while (pkt.position.z > 50.0) {
        pkt = sim.step(1 / 60);
      }
      const manualStageAt50 = pkt.stage.id;
      console.log('[CHALLENGER STRESS] In MANUAL mode at z =', pkt.position.z, 'stageId is:', manualStageAt50);

      // Verify stage progression advances by altitude even under MANUAL pilot mode
      expect(manualStageAt700).toBe(2); // Stage 2: Ballistic Drift (550m < z <= 950m)
      expect(manualStageAt300).toBe(3); // Stage 3: Autonomous Divert (180m < z <= 550m)
      expect(manualStageAt50).toBe(4);  // Stage 4: Suicide Burn (0.05m < z <= 180m)
    });

    it('transitions to Stage 5 upon touchdown even if in MANUAL mode', () => {
      sim.reset(10.0);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0 });
      let pkt = sim.buildTelemetryPacket();

      // Step until contact (z <= 0)
      for (let i = 0; i < 300; i++) {
        pkt = sim.step(1 / 60);
        if (pkt.position.z <= 0.0) break;
      }

      expect(pkt.position.z).toBe(0.0);
      expect(pkt.stage.id).toBe(5);
      expect(pkt.stage.name).toBe('Touchdown');
    });
  });

  describe('3. Simulated Abort & Crash Conditions Stress Test', () => {
    it('triggers CRASH status and Stage 5 on high vertical velocity impact (> 2.0 m/s)', () => {
      sim.reset(50.0);
      // Give extreme downward velocity
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0 });
      // Let it free fall
      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 600; i++) {
        pkt = sim.step(1 / 60);
        if (pkt.position.z <= 0) break;
      }

      expect(pkt.position.z).toBe(0.0);
      expect(pkt.status).toBe('CRASH');
      expect(pkt.stage.id).toBe(5);
      expect(pkt.stage.description).toContain('Structural failure on touchdown');
    });

    it('triggers CRASH status on excessive horizontal velocity touchdown (vxy > 0.5 m/s)', () => {
      sim.reset(2.0);
      // Small height, but heavy lateral disturbance
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0, disturbance_vector: [15.0, 10.0] });
      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 300; i++) {
        pkt = sim.step(1 / 60);
        if (pkt.position.z <= 0) break;
      }

      expect(pkt.position.z).toBe(0.0);
      expect(pkt.status).toBe('CRASH');
    });

    it('triggers CRITICAL status when propellant is completely exhausted mid-flight', () => {
      sim.reset(1000.0);
      // Fast burn all fuel
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 1.0 });

      // Step physics until fuel mass is strictly 0 and engine cutoff is applied
      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 6000; i++) {
        pkt = sim.step(0.1);
        if ((sim as any).state.massFuel <= 0.0 && pkt.thrust.cmd === 0.0) break;
      }

      console.log('[DEBUG FUEL EXHAUSTION]', {
        fuelMass: pkt.fuel.mass,
        throttle: pkt.thrust.cmd,
        newtons: pkt.thrust.newtons,
        status: pkt.status,
        stateThrottle: (sim as any).state.throttle,
        stateMassFuel: (sim as any).state.massFuel,
        isLanded: (sim as any).state.isLanded,
        isCrashed: (sim as any).state.isCrashed,
        z: (sim as any).state.z
      });

      expect(pkt.fuel.mass).toBe(0.0);
      expect(pkt.fuel.percentage).toBe(0.0);
      expect(pkt.thrust.newtons).toBe(0.0);
      expect(pkt.status).toBe('CRITICAL');
    });
  });

  describe('4. Mathematical & Boundary Value Stress Testing', () => {
    it('handles negative dt or 0 dt gracefully without NaN or Inf', () => {
      const pktZeroDt = sim.step(0);
      expect(Number.isNaN(pktZeroDt.position.z)).toBe(false);
      expect(Number.isFinite(pktZeroDt.position.z)).toBe(true);

      const pktNegDt = sim.step(-0.01);
      expect(Number.isNaN(pktNegDt.position.z)).toBe(false);
    });

    it('maintains finite position and velocity under extreme lateral wind disturbances', () => {
      sim.reset(1000.0);
      sim.setDisturbanceVector(999999.0, -999999.0);
      const pkt = sim.step(1 / 60);
      expect(Number.isFinite(pkt.position.x)).toBe(true);
      expect(Number.isFinite(pkt.velocity.vx)).toBe(true);
    });

    it('boundary altitude transitions behave consistently at exact threshold values', () => {
      const altitudes = [950.01, 950.0, 949.99, 550.01, 550.0, 549.99, 180.01, 180.0, 179.99, 0.06, 0.05, 0.04];
      for (const alt of altitudes) {
        sim.reset(alt);
        const pkt = sim.step(1 / 60);
        expect(pkt.stage.id).toBeGreaterThanOrEqual(1);
        expect(pkt.stage.id).toBeLessThanOrEqual(5);
      }
    });
  });
});
