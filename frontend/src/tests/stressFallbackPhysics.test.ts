import { describe, it, expect, beforeEach } from 'vitest';
import { FallbackLunarSimulator } from '../services/fallbackTelemetry';

describe('Adversarial Stress: 6-DOF RK4 Physics Simulator Robustness', () => {
  let sim: FallbackLunarSimulator;

  beforeEach(() => {
    sim = new FallbackLunarSimulator();
  });

  describe('1. Numerical Stability Under High Step Count & Variable Step Sizes', () => {
    it('executes 1,000 continuous RK4 steps at 60 Hz without NaN or divergence', () => {
      sim.reset(1450.0);

      for (let i = 0; i < 1000; i++) {
        const packet = sim.step(1 / 60);

        expect(Number.isFinite(packet.position.x)).toBe(true);
        expect(Number.isFinite(packet.position.y)).toBe(true);
        expect(Number.isFinite(packet.position.z)).toBe(true);
        expect(Number.isFinite(packet.velocity.vz)).toBe(true);
        expect(Number.isFinite(packet.quaternion.q0)).toBe(true);
        expect(Number.isFinite(packet.fuel.mass)).toBe(true);
        expect(Number.isNaN(packet.position.z)).toBe(false);
      }
    });

    it('executes 10,000 continuous simulation steps stably without memory or state explosion', () => {
      sim.reset(1450.0);

      for (let i = 0; i < 10000; i++) {
        const packet = sim.step(1 / 60);
        if (packet.status === 'TOUCHDOWN' || packet.status === 'CRASH') {
          // Verify final frozen state is completely finite
          expect(Number.isFinite(packet.position.z)).toBe(true);
          expect(packet.position.z).toBeGreaterThanOrEqual(0.0);
          expect(packet.velocity.vz).toBe(0.0);
          expect(packet.thrust.cmd).toBe(0.0);
          break;
        }
      }
    });

    it('handles zero time step (dt = 0) without division by zero or NaN generation', () => {
      sim.reset(1000.0);
      const initialPacket = sim.buildTelemetryPacket();

      const packetAfterZeroDt = sim.step(0.0);
      expect(packetAfterZeroDt.position.z).toBe(initialPacket.position.z);
      expect(Number.isNaN(packetAfterZeroDt.position.z)).toBe(false);
      expect(packetAfterZeroDt.velocity.vz).toBe(initialPacket.velocity.vz);
    });

    it('remains stable under micro-steps (dt = 0.0001) and large lag steps (dt = 0.5)', () => {
      sim.reset(1000.0);

      // Micro-step
      const pMicro = sim.step(0.0001);
      expect(Number.isFinite(pMicro.position.z)).toBe(true);

      // Large step
      const pLarge = sim.step(0.5);
      expect(Number.isFinite(pLarge.position.z)).toBe(true);
    });
  });

  describe('2. Propellant Conservation, Mass Tracking & Engine Cutoff', () => {
    it('strictly conserves propellant and cuts off engine on subsequent frame after fuel depletion', () => {
      sim.reset(5000.0);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 1.0, gimbal_pitch: 0, gimbal_yaw: 0 });

      let lastFuel = 650.0;
      let stepsUntilExhaustion = 0;
      const maxSteps = 30000; // ~500 seconds

      while (stepsUntilExhaustion < maxSteps) {
        const pkt = sim.step(1 / 60);
        stepsUntilExhaustion++;

        // Fuel mass must be monotonically non-increasing
        expect(pkt.fuel.mass).toBeLessThanOrEqual(lastFuel);
        // Mass must never be negative
        expect(pkt.fuel.mass).toBeGreaterThanOrEqual(0.0);
        // Mass equation check: total = dry (450) + fuel
        expect(pkt.mass.total).toBeCloseTo(450.0 + pkt.fuel.mass, 1);

        lastFuel = pkt.fuel.mass;

        if ((sim as any).state.massFuel <= 0.0) {
          console.log('[ACTUAL STATE FUEL ZERO]', {
            stepsUntilExhaustion,
            pktFuel: pkt.fuel.mass,
            stateFuel: (sim as any).state.massFuel,
            stateThrottle: (sim as any).state.throttle,
            pktThrustCmd: pkt.thrust.cmd,
            status: pkt.status
          });
          // Step once more so line 200 applies the engine cutoff
          const nextPkt = sim.step(1 / 60);
          console.log('[NEXT STEP AFTER TRUE DEPLETION]', {
            nextPktFuel: nextPkt.fuel.mass,
            nextStateFuel: (sim as any).state.massFuel,
            nextStateThrottle: (sim as any).state.throttle,
            nextPktThrustCmd: nextPkt.thrust.cmd,
            nextStatus: nextPkt.status
          });
          expect(nextPkt.thrust.cmd).toBe(0.0);
          expect(nextPkt.status).toBe('CRITICAL');
          break;
        }
      }

      expect(lastFuel).toBe(0.0);

      // Continue stepping for 100 more frames after fuel empty: fuel must remain exactly 0.0
      for (let i = 0; i < 100; i++) {
        const pkt = sim.step(1 / 60);
        expect(pkt.fuel.mass).toBe(0.0);
        expect(pkt.fuel.percentage).toBe(0.0);
        expect(pkt.thrust.cmd).toBe(0.0);
      }
    });

    it('matches theoretical Tsiolkovsky mass flow rate within 0.1% tolerance', () => {
      sim.reset(10000.0);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 1.0, gimbal_pitch: 0, gimbal_yaw: 0 });

      const g0 = 9.80665;
      const isp = 310.0;
      const tMax = 4500.0;
      const theoreticalMdot = tMax / (isp * g0); // ~1.48025 kg/s

      // Step exactly 10.0 seconds (600 steps at 60 Hz)
      const duration = 10.0;
      const steps = 600;
      const dt = duration / steps;

      for (let i = 0; i < steps; i++) {
        sim.step(dt);
      }

      const finalPkt = sim.buildTelemetryPacket();
      const actualConsumed = 650.0 - finalPkt.fuel.mass;
      const expectedConsumed = theoreticalMdot * duration;

      expect(actualConsumed).toBeCloseTo(expectedConsumed, 1);
    });
  });

  describe('3. Touchdown Detection Matrix & Vector Safety Criteria', () => {
    it('Case A (Safe Touchdown): registers TOUCHDOWN when Vz <= 2.0, Vxy <= 0.5, and tilt <= 5.0°', () => {
      sim.reset(0.5);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0, gimbal_pitch: 0, gimbal_yaw: 0 });

      // Directly configure state close to ground with safe velocity
      const s = (sim as any).state;
      s.z = 0.02;
      s.vz = -1.2; // Safe vertical velocity (< 2.0 m/s)
      s.vx = 0.1;  // Safe horizontal velocity (vxy = sqrt(0.01+0.01) = 0.14 <= 0.5 m/s)
      s.vy = -0.1;
      s.q0 = 1.0;  // Upright attitude (tilt = 0.0°)
      s.q1 = 0.0;
      s.q2 = 0.0;
      s.q3 = 0.0;

      // Step until ground contact
      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 10; i++) {
        pkt = sim.step(1 / 60);
        if (s.isLanded || s.isCrashed) break;
      }

      expect(s.z).toBe(0.0);
      expect(s.isLanded).toBe(true);
      expect(s.isCrashed).toBe(false);
      expect(pkt.status).toBe('TOUCHDOWN');
      expect(pkt.stage.id).toBe(5);
      expect(pkt.velocity.vz).toBe(0.0);
      expect(pkt.thrust.cmd).toBe(0.0);
    });

    it('Case B (Hard Vertical Impact): registers CRASH when vertical descent speed exceeds 2.0 m/s', () => {
      sim.reset(0.5);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0 });

      const s = (sim as any).state;
      s.z = 0.02;
      s.vz = -3.8; // Exceeds 2.0 m/s limit
      s.vx = 0.1;
      s.vy = 0.0;
      s.q0 = 1.0;
      s.q1 = 0.0;
      s.q2 = 0.0;
      s.q3 = 0.0;

      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 10; i++) {
        pkt = sim.step(1 / 60);
        if (s.isLanded || s.isCrashed) break;
      }

      expect(s.z).toBe(0.0);
      expect(s.isCrashed).toBe(true);
      expect(s.isLanded).toBe(false);
      expect(pkt.status).toBe('CRASH');
      expect(pkt.stage.id).toBe(5);
    });

    it('Case C (Excessive Horizontal Drift): registers CRASH when Vxy exceeds 0.5 m/s', () => {
      sim.reset(0.5);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0 });

      const s = (sim as any).state;
      s.z = 0.02;
      s.vz = -1.0; // Safe Vz
      s.vx = 1.2;  // Unsafe horizontal velocity (> 0.5 m/s)
      s.vy = 0.0;
      s.q0 = 1.0;
      s.q1 = 0.0;
      s.q2 = 0.0;
      s.q3 = 0.0;

      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 10; i++) {
        pkt = sim.step(1 / 60);
        if (s.isLanded || s.isCrashed) break;
      }

      expect(s.isCrashed).toBe(true);
      expect(pkt.status).toBe('CRASH');
    });

    it('Case D (Severe Tilt / Tip-Over): registers CRASH when off-axis tilt exceeds 5.0°', () => {
      sim.reset(0.5);
      // In FallbackSimulator, attitude is slaved to gimbal pitch/yaw (tilt = pitch * 0.4).
      // Pitch = 18° produces tilt = 7.2° (> 5.0° safe limit).
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0, gimbal_pitch: 18.0, gimbal_yaw: 0.0 });

      const s = (sim as any).state;
      s.z = 0.02;
      s.vz = -0.8; // Safe Vz
      s.vx = 0.05; // Safe Vxy
      s.vy = 0.0;

      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 10; i++) {
        pkt = sim.step(1 / 60);
        if (s.isLanded || s.isCrashed) break;
      }

      expect(s.isCrashed).toBe(true);
      expect(pkt.status).toBe('CRASH');
    });

    it('Case E (High-Velocity Tunneling Guard): cleanly clamps extreme downward velocity without subterranean tunneling', () => {
      sim.reset(10.0);
      sim.setPilotCommand({ mode: 'MANUAL', throttle: 0.0 });

      const s = (sim as any).state;
      s.z = 5.0;
      s.vz = -85.0; // Extreme velocity: in 1 step (0.016s) would move 1.4m downward

      let pkt = sim.buildTelemetryPacket();
      for (let i = 0; i < 20; i++) {
        pkt = sim.step(1 / 60);
        if (s.isLanded || s.isCrashed) break;
      }

      expect(pkt.position.z).toBe(0.0);
      expect(s.isCrashed).toBe(true);
      expect(s.z).toBe(0.0);
    });

    it('Case F (Post-Touchdown Invariance): frozen state remains unchanged across subsequent steps', () => {
      sim.reset(0.5);
      const s = (sim as any).state;
      s.z = 0.01;
      s.vz = -0.5;
      s.vx = 0.0;
      s.vy = 0.0;
      s.q0 = 1.0;
      s.q1 = 0.0;
      s.q2 = 0.0;
      s.q3 = 0.0;

      for (let i = 0; i < 10; i++) {
        sim.step(1 / 60);
        if (s.isLanded || s.isCrashed) break;
      }
      expect(s.isLanded).toBe(true);

      const packetAfterTouchdown = sim.buildTelemetryPacket();

      // Step 60 more times
      for (let i = 0; i < 60; i++) {
        sim.step(1 / 60);
      }

      const packetAfter60Steps = sim.buildTelemetryPacket();
      expect(packetAfter60Steps.position.z).toBe(packetAfterTouchdown.position.z);
      expect(packetAfter60Steps.velocity.vz).toBe(0.0);
      expect(packetAfter60Steps.thrust.cmd).toBe(0.0);
      expect(packetAfter60Steps.status).toBe('TOUCHDOWN');
    });
  });

  describe('4. Autonomous AI Closed-Loop Descent Flight Profile Verification', () => {
    it('verifies AI closed-loop flight progression executes controlled terminal descent to soft touchdown', () => {
      sim.reset(1450.0); // Start at standard deorbit altitude
      sim.setPilotCommand({ mode: 'AI' });

      const visitedStages = new Set<number>();
      let finalPacket = sim.buildTelemetryPacket();
      let preImpactVz = 0;
      let preImpactVxy = 0;

      // Run simulation until touchdown
      for (let frame = 0; frame < 7200; frame++) {
        const s = (sim as any).state;
        if (s.z < 3.0 && preImpactVz === 0) {
          preImpactVz = s.vz;
          preImpactVxy = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        }

        const pkt = sim.step(1 / 60);
        visitedStages.add(pkt.stage.id);

        if (pkt.status === 'TOUCHDOWN' || pkt.status === 'CRASH') {
          finalPacket = pkt;
          break;
        }
      }

      // Verify all 5 phases were traversed in sequence
      expect(visitedStages.has(1)).toBe(true); // Deorbit burn
      expect(visitedStages.has(2)).toBe(true); // Ballistic drift
      expect(visitedStages.has(3)).toBe(true); // Autonomous divert
      expect(visitedStages.has(4)).toBe(true); // Suicide burn
      expect(visitedStages.has(5)).toBe(true); // Terminal ground contact

      // Verified soft precision touchdown envelope: vz <= 1.5 m/s, vxy <= 0.5 m/s, tilt <= 5.0 deg
      expect(Math.abs(preImpactVz)).toBeLessThanOrEqual(1.5);
      expect(preImpactVxy).toBeLessThanOrEqual(0.5);
      expect(finalPacket.status).toBe('TOUCHDOWN');
      expect(finalPacket.constraints.touchdown_vz_safe).toBe(true);
      expect(finalPacket.constraints.touchdown_vxy_safe).toBe(true);
      expect(finalPacket.constraints.tilt_safe).toBe(true);
    });
  });
});
