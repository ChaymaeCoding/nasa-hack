import {
  TelemetryPacket,
  FlightControlMode,
  PilotCommand,
  MissionPhaseId,
  MissionPhaseName,
  FlightStatus
} from '../types/telemetry';

export interface SimulatorState {
  time: number;
  timeStep: number;
  // Position [x, y, z] (z = altitude)
  x: number;
  y: number;
  z: number;
  // Velocity [vx, vy, vz]
  vx: number;
  vy: number;
  vz: number;
  // Attitude quaternion [q0, q1, q2, q3] (w, x, y, z)
  q0: number;
  q1: number;
  q2: number;
  q3: number;
  // Angular rates [wx, wy, wz] (rad/s)
  wx: number;
  wy: number;
  wz: number;
  // Mass properties
  massDry: number;   // 450 kg
  massFuel: number;  // Initial 650 kg
  // Actuator states
  throttle: number;      // 0.0 to 1.0
  gimbalPitch: number;   // degrees
  gimbalYaw: number;     // degrees
  rcsRoll: number;
  rcsPitch: number;
  rcsYaw: number;
  rcsFiring: boolean;
  // Flight phase & status
  stageId: MissionPhaseId;
  status: FlightStatus;
  mode: FlightControlMode;
  isLanded: boolean;
  isCrashed: boolean;
  // Touchdown fidelity tracking
  impactVz: number;
  impactVxy: number;
  impactTilt: number;
}

const G_LUNAR = 1.62;         // m/s^2 downward along -Z
const G0 = 9.80665;           // standard gravity for Isp
const ISP = 310.0;            // seconds
const T_MAX = 4500.0;         // Newtons max thrust
const DRY_MASS = 450.0;       // kg
const INITIAL_FUEL = 650.0;   // kg

export class FallbackLunarSimulator {
  private state: SimulatorState;
  private disturbanceVector: [number, number] = [0.0, 0.0];
  private timerId: number | null = null;
  private onPacketCallback: ((packet: TelemetryPacket) => void) | null = null;

  constructor() {
    this.state = this.getInitialState();
  }

  public getInitialState(): SimulatorState {
    return {
      time: 0.0,
      timeStep: 0,
      x: -450.0,
      y: 120.0,
      z: 1450.0, // Initial altitude AGL: 1450m
      vx: 32.0,
      vy: -8.0,
      vz: -18.0, // Downward velocity
      q0: 1.0,
      q1: 0.0,
      q2: 0.0,
      q3: 0.0,
      wx: 0.0,
      wy: 0.0,
      wz: 0.0,
      massDry: DRY_MASS,
      massFuel: INITIAL_FUEL,
      throttle: 0.15,
      gimbalPitch: 0.0,
      gimbalYaw: 0.0,
      rcsRoll: 0.0,
      rcsPitch: 0.0,
      rcsYaw: 0.0,
      rcsFiring: false,
      stageId: 1,
      status: 'NOMINAL',
      mode: 'AI',
      isLanded: false,
      isCrashed: false,
      impactVz: 0.0,
      impactVxy: 0.0,
      impactTilt: 0.0
    };
  }

  public reset(dropAltitude = 1450.0): void {
    this.state = this.getInitialState();
    this.state.z = dropAltitude;
    this.updateStageProgression();
  }

  public setDisturbanceVector(wx: number, wy: number): void {
    this.disturbanceVector = [wx, wy];
  }

  public setPilotCommand(cmd: PilotCommand): void {
    if (cmd.mode) this.state.mode = cmd.mode;
    if (cmd.disturbance_vector) this.disturbanceVector = cmd.disturbance_vector;

    if (this.state.mode === 'MANUAL') {
      if (cmd.throttle !== undefined) this.state.throttle = Math.max(0.0, Math.min(1.0, cmd.throttle));
      if (cmd.gimbal_pitch !== undefined) this.state.gimbalPitch = Math.max(-20.0, Math.min(20.0, cmd.gimbal_pitch));
      if (cmd.gimbal_yaw !== undefined) this.state.gimbalYaw = Math.max(-20.0, Math.min(20.0, cmd.gimbal_yaw));
      if (cmd.rcs_roll !== undefined) this.state.rcsRoll = Math.max(-1.0, Math.min(1.0, cmd.rcs_roll));
    }
  }

  /**
   * Universal flight stage progression based on vehicle altitude AGL
   * Decoupled from AI guidance so Mission Checklist progresses in both AI and MANUAL modes
   */
  private updateStageProgression(): void {
    const s = this.state;
    if (s.isLanded || s.isCrashed) {
      s.stageId = 5;
      return;
    }
    if (s.z > 950.0) {
      s.stageId = 1; // Deorbit Burn: Retrograde deceleration
    } else if (s.z > 550.0) {
      s.stageId = 2; // Ballistic Drift: Coasting and Lidar scanning
    } else if (s.z > 180.0) {
      s.stageId = 3; // Autonomous Divert: Lateral alignment with target pad (0, 0)
    } else if (s.z > 0.05) {
      s.stageId = 4; // Suicide Burn / Terminal Deceleration
    } else {
      s.stageId = 5; // Touchdown
    }
  }

  /**
   * Autonomous GNC Guidance logic (Task 1 & Task 3 specifications)
   */
  private updateAIGuidance(_dt: number): void {
    const s = this.state;
    if (s.isLanded || s.isCrashed) {
      s.throttle = 0.0;
      s.gimbalPitch = 0.0;
      s.gimbalYaw = 0.0;
      return;
    }

    const totalMass = s.massDry + s.massFuel;

    if (s.stageId === 1) {
      // Stage 1: Deorbit burn: Moderate retrograde thrust to shape trajectory & brake initial speed
      s.throttle = 0.38;
      s.gimbalPitch = THREE_clamp(-s.vx * 0.8, -18.0, 18.0);
      s.gimbalYaw = THREE_clamp(-s.vy * 0.8, -18.0, 18.0);
    } else if (s.stageId === 2) {
      // Stage 2: Ballistic drift: Controlled coast with attitude alignment
      s.throttle = 0.22;
      s.gimbalPitch = THREE_clamp(-s.vx * 0.5, -12.0, 12.0);
      s.gimbalYaw = THREE_clamp(-s.vy * 0.5, -12.0, 12.0);
    } else if (s.stageId === 3) {
      // Stage 3: Autonomous Divert: Kill horizontal velocity towards landing site (0, 0)
      const targetVx = THREE_clamp(-s.x * 0.02, -4.0, 4.0);
      const targetVy = THREE_clamp(-s.y * 0.02, -4.0, 4.0);
      const errVx = s.vx - targetVx;
      const errVy = s.vy - targetVy;

      // Bring vertical descent rate to ~ -14 m/s before Stage 4 handover
      const targetVz = -14.0;
      const speedErrZ = targetVz - s.vz;
      const reqAccZ = G_LUNAR + (speedErrZ * 0.8);
      s.throttle = THREE_clamp((reqAccZ * totalMass) / T_MAX, 0.30, 0.85);

      s.gimbalPitch = THREE_clamp(-errVx * 2.0, -18.0, 18.0);
      s.gimbalYaw = THREE_clamp(-errVy * 2.0, -18.0, 18.0);
    } else if (s.stageId === 4) {
      // Stage 4: Terminal Suicide Burn Deceleration
      // Dynamic parabolic braking envelope down to 15m, then linear flare to -1.0 m/s
      let vzSafeTarget: number;
      if (s.z > 15.0) {
        vzSafeTarget = -Math.min(15.0, Math.max(2.5, Math.sqrt(2.0 * 0.95 * s.z)));
      } else {
        vzSafeTarget = -1.0 - (s.z / 15.0) * 1.5;
      }

      // Closed-loop PID vertical throttle: falling faster than target increases throttle up to 1.0
      const speedError = vzSafeTarget - s.vz;
      const requiredAcc = G_LUNAR + (speedError * 2.2);
      const reqThrust = requiredAcc * totalMass;
      s.throttle = THREE_clamp(reqThrust / T_MAX, 0.12, 1.0);

      // Lateral stabilization: cancel all horizontal velocity
      // When z < 5m, clamp gimbal to <= 5 deg to guarantee off-axis tilt <= 2.0° (well below 5.0°)
      const maxGimbal = s.z < 5.0 ? 5.0 : (s.z < 20.0 ? 10.0 : 16.0);
      s.gimbalPitch = THREE_clamp(-s.vx * 3.5, -maxGimbal, maxGimbal);
      s.gimbalYaw = THREE_clamp(-s.vy * 3.5, -maxGimbal, maxGimbal);
    }

    // RCS stabilization
    s.rcsFiring = Math.abs(s.gimbalPitch) > 5.0 || Math.abs(s.gimbalYaw) > 5.0;
  }

  /**
   * Runge-Kutta 4th Order (RK4) step for 6-DOF translation and mass depletion
   */
  public step(dt = 1 / 60): TelemetryPacket {
    const s = this.state;

    if (!s.isLanded && !s.isCrashed) {
      // 1. Universal stage progression (applies in both AI and MANUAL flight modes)
      this.updateStageProgression();

      // 2. Autonomous guidance calculation
      if (s.mode === 'AI') {
        this.updateAIGuidance(dt);
      }

      // 3. Pre-burn fuel depletion guard
      if (s.massFuel <= 0.0) {
        s.massFuel = 0.0;
        s.throttle = 0.0;
        s.status = 'CRITICAL';
      }

      const totalMass = s.massDry + s.massFuel;
      const thrustN = s.throttle * T_MAX;

      // Fuel mass depletion: dM/dt = -T / (Isp * g0)
      const mdot = thrustN / (ISP * G0);
      s.massFuel = Math.max(0.0, s.massFuel - mdot * dt);

      // 4. Immediate propellant flameout cutoff
      if (s.massFuel <= 0.0) {
        s.massFuel = 0.0;
        s.throttle = 0.0;
        s.status = 'CRITICAL';
      }

      // Gimbal thrust acceleration in local coordinates
      const pitchRad = (s.gimbalPitch * Math.PI) / 180.0;
      const yawRad = (s.gimbalYaw * Math.PI) / 180.0;

      // Thrust direction vector in world space:
      // Gimbal deflection vector relative to vehicle vertical +Z
      const fxThrust = thrustN * Math.sin(pitchRad);
      const fyThrust = thrustN * Math.sin(yawRad);
      const fzThrust = thrustN * Math.cos(pitchRad) * Math.cos(yawRad);

      // Compute Accelerations
      // Environmental: Lunar Gravity along -Z + Wind Disturbance
      const ax = (fxThrust / totalMass) + (this.disturbanceVector[0] * 0.05);
      const ay = (fyThrust / totalMass) + (this.disturbanceVector[1] * 0.05);
      const az = (fzThrust / totalMass) - G_LUNAR;

      // RK4 Translational Integration
      // f(r, v) = [v, a]
      const k1_v = [ax * dt, ay * dt, az * dt];
      const k1_r = [s.vx * dt, s.vy * dt, s.vz * dt];

      const k2_v = [ax * dt, ay * dt, az * dt];
      const k2_r = [(s.vx + 0.5 * k1_v[0]) * dt, (s.vy + 0.5 * k1_v[1]) * dt, (s.vz + 0.5 * k1_v[2]) * dt];

      const k3_v = [ax * dt, ay * dt, az * dt];
      const k3_r = [(s.vx + 0.5 * k2_v[0]) * dt, (s.vy + 0.5 * k2_v[1]) * dt, (s.vz + 0.5 * k2_v[2]) * dt];

      const k4_v = [ax * dt, ay * dt, az * dt];
      const k4_r = [(s.vx + k3_v[0]) * dt, (s.vy + k3_v[1]) * dt, (s.vz + k3_v[2]) * dt];

      s.vx += (k1_v[0] + 2 * k2_v[0] + 2 * k3_v[0] + k4_v[0]) / 6.0;
      s.vy += (k1_v[1] + 2 * k2_v[1] + 2 * k3_v[1] + k4_v[1]) / 6.0;
      s.vz += (k1_v[2] + 2 * k2_v[2] + 2 * k3_v[2] + k4_v[2]) / 6.0;

      s.x += (k1_r[0] + 2 * k2_r[0] + 2 * k3_r[0] + k4_r[0]) / 6.0;
      s.y += (k1_r[1] + 2 * k2_r[1] + 2 * k3_r[1] + k4_r[1]) / 6.0;
      s.z += (k1_r[2] + 2 * k2_r[2] + 2 * k3_r[2] + k4_r[2]) / 6.0;

      // Attitude dynamics: Vehicle leans slightly to vector thrust towards horizontal target
      const targetRoll = (-s.gimbalYaw * 0.4);
      const targetPitch = (s.gimbalPitch * 0.4);
      const targetYaw = 0.0;

      const eulerRad = [
        (targetRoll * Math.PI) / 180.0,
        (targetPitch * Math.PI) / 180.0,
        (targetYaw * Math.PI) / 180.0
      ];

      // Convert Euler to Quaternion
      const c1 = Math.cos(eulerRad[0] / 2);
      const s1 = Math.sin(eulerRad[0] / 2);
      const c2 = Math.cos(eulerRad[1] / 2);
      const s2 = Math.sin(eulerRad[1] / 2);
      const c3 = Math.cos(eulerRad[2] / 2);
      const s3 = Math.sin(eulerRad[2] / 2);

      s.q0 = c1 * c2 * c3 + s1 * s2 * s3;
      s.q1 = s1 * c2 * c3 - c1 * s2 * s3;
      s.q2 = c1 * s2 * c3 + s1 * c2 * s3;
      s.q3 = c1 * c2 * s3 - s1 * s2 * c3;

      // Touchdown Ground Contact Logic
      if (s.z <= 0.0) {
        s.z = 0.0;
        const vxy = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const vzTouch = Math.abs(s.vz);
        const tiltAngle = calculateTilt(s.q0, s.q1, s.q2, s.q3);

        // Record impact kinematics for telemetry constraint fidelity
        s.impactVz = vzTouch;
        s.impactVxy = vxy;
        s.impactTilt = tiltAngle;

        // Verification of safety criteria
        const isSafeVz = vzTouch <= 2.0;
        const isSafeVxy = vxy <= 0.5;
        const isSafeTilt = tiltAngle <= 5.0;

        if (isSafeVz && isSafeVxy && isSafeTilt) {
          s.isLanded = true;
          s.status = 'TOUCHDOWN';
          s.stageId = 5;
        } else {
          s.isCrashed = true;
          s.status = 'CRASH';
          s.stageId = 5;
        }

        s.vx = 0.0;
        s.vy = 0.0;
        s.vz = 0.0;
        s.throttle = 0.0;
        s.gimbalPitch = 0.0;
        s.gimbalYaw = 0.0;
      }

      s.time += dt;
      s.timeStep++;
    }

    return this.buildTelemetryPacket();
  }

  public buildTelemetryPacket(): TelemetryPacket {
    const s = this.state;
    const v_xy = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    const v_total = Math.sqrt(s.vx * s.vx + s.vy * s.vy + s.vz * s.vz);
    const totalMass = s.massDry + s.massFuel;
    const thrustN = s.throttle * T_MAX;
    const mdot = thrustN / (ISP * G0);

    const tilt = calculateTilt(s.q0, s.q1, s.q2, s.q3);
    const euler = quaternionToEulerDegrees(s.q0, s.q1, s.q2, s.q3);

    const stageNames: Record<MissionPhaseId, MissionPhaseName> = {
      1: 'Deorbit Burn',
      2: 'Ballistic Drift',
      3: 'Autonomous Divert',
      4: 'Suicide Burn',
      5: 'Touchdown'
    };

    const stageDescs: Record<MissionPhaseId, string> = {
      1: 'Perilune orbit transfer retrograde deceleration',
      2: 'Unpowered ballistic coast and onboard Lidar mapping',
      3: 'Autonomous hazard avoidance and pad intercept vectoring',
      4: 'Terminal suicide burn deceleration down to vertical touchdown',
      5: s.isCrashed
        ? 'Structural failure on touchdown — velocity/tilt exceeded'
        : 'Soft precision touchdown achieved — engine cutoff complete'
    };

    const evalVz = (s.isLanded || s.isCrashed) ? s.impactVz : Math.abs(s.vz);
    const evalVxy = (s.isLanded || s.isCrashed) ? s.impactVxy : v_xy;
    const evalTilt = (s.isLanded || s.isCrashed) ? s.impactTilt : tilt;

    const packet: TelemetryPacket = {
      timestamp: Number(s.time.toFixed(3)),
      time_step: s.timeStep,
      position: {
        x: Number(s.x.toFixed(2)),
        y: Number(s.y.toFixed(2)),
        z: Math.max(0.0, Number(s.z.toFixed(2)))
      },
      velocity: {
        x: Number(s.vx.toFixed(2)),
        y: Number(s.vy.toFixed(2)),
        z: Number(s.vz.toFixed(2)),
        vx: Number(s.vx.toFixed(2)),
        vy: Number(s.vy.toFixed(2)),
        vz: Number(s.vz.toFixed(2)),
        v_xy: Number(v_xy.toFixed(2)),
        v_total: Number(v_total.toFixed(2))
      },
      quaternion: {
        q0: Number(s.q0.toFixed(4)),
        q1: Number(s.q1.toFixed(4)),
        q2: Number(s.q2.toFixed(4)),
        q3: Number(s.q3.toFixed(4))
      },
      euler: {
        roll: Number(euler.roll.toFixed(1)),
        pitch: Number(euler.pitch.toFixed(1)),
        yaw: Number(euler.yaw.toFixed(1)),
        tilt: Number(tilt.toFixed(2))
      },
      angular_velocity: {
        wx: Number(s.wx.toFixed(3)),
        wy: Number(s.wy.toFixed(3)),
        wz: Number(s.wz.toFixed(3))
      },
      fuel: {
        mass: Number(s.massFuel.toFixed(1)),
        max_mass: INITIAL_FUEL,
        percentage: Number(((s.massFuel / INITIAL_FUEL) * 100).toFixed(1)),
        flow_rate: Number(mdot.toFixed(2))
      },
      mass: {
        dry: DRY_MASS,
        total: Number(totalMass.toFixed(1))
      },
      thrust: {
        cmd: Number(s.throttle.toFixed(3)),
        percentage: Number((s.throttle * 100).toFixed(1)),
        newtons: Number(thrustN.toFixed(0)),
        gimbal_pitch: Number(s.gimbalPitch.toFixed(1)),
        gimbal_yaw: Number(s.gimbalYaw.toFixed(1))
      },
      rcs: {
        roll: Number(s.rcsRoll.toFixed(2)),
        pitch: Number(s.rcsPitch.toFixed(2)),
        yaw: Number(s.rcsYaw.toFixed(2)),
        firing: s.rcsFiring
      },
      stage: {
        id: s.stageId,
        name: stageNames[s.stageId],
        description: stageDescs[s.stageId]
      },
      status: s.status,
      constraints: {
        touchdown_vz_safe: evalVz <= 2.0,
        touchdown_vxy_safe: evalVxy <= 0.5,
        tilt_safe: evalTilt <= 5.0,
        in_descent_cone: evalTilt <= 15.0
      },
      landing_site: {
        target_x: 0.0,
        target_y: 0.0,
        target_z: 0.0,
        distance_to_target: Number(Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z).toFixed(1))
      },
      mode: s.mode
    };

    return packet;
  }

  public start(onPacket: (packet: TelemetryPacket) => void, fps = 60): void {
    this.onPacketCallback = onPacket;
    if (this.timerId !== null) return;

    const intervalMs = 1000 / fps;
    this.timerId = window.setInterval(() => {
      const packet = this.step(1 / fps);
      if (this.onPacketCallback) {
        this.onPacketCallback(packet);
      }
    }, intervalMs);
  }

  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

// Math Utility Functions
function THREE_clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function calculateTilt(_q0: number, q1: number, q2: number, _q3: number): number {
  // Rotate unit vertical vector [0, 0, 1] by quaternion to find vehicle body Z axis
  const bodyZ_z = 1.0 - 2.0 * (q1 * q1 + q2 * q2);
  const cosTilt = THREE_clamp(bodyZ_z, -1.0, 1.0);
  return (Math.acos(cosTilt) * 180.0) / Math.PI;
}

export function quaternionToEulerDegrees(q0: number, q1: number, q2: number, q3: number): { roll: number; pitch: number; yaw: number } {
  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (q0 * q1 + q2 * q3);
  const cosr_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
  const roll = (Math.atan2(sinr_cosp, cosr_cosp) * 180) / Math.PI;

  // Pitch (y-axis rotation)
  const sinp = 2 * (q0 * q2 - q3 * q1);
  let pitch = 0;
  if (Math.abs(sinp) >= 1) {
    pitch = (Math.sign(sinp) * Math.PI) / 2; // out of range
  } else {
    pitch = Math.asin(sinp);
  }
  pitch = (pitch * 180) / Math.PI;

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (q0 * q3 + q1 * q2);
  const cosy_cosp = 1 - 2 * (q2 * q2 + q3 * q3);
  const yaw = (Math.atan2(siny_cosp, cosy_cosp) * 180) / Math.PI;

  return { roll, pitch, yaw };
}

export const fallbackSimulator = new FallbackLunarSimulator();
