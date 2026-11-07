import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { App } from '../App';
import { TelemetryHUD } from '../components/TelemetryHUD';
import { MissionChecklist } from '../components/MissionChecklist';
import { FlightControls } from '../components/FlightControls';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { telemetryStore } from '../services/telemetryStore';
import { TelemetryPacket } from '../types/telemetry';

import * as fs from 'node:fs';
import * as path from 'node:path';


describe('CHALLENGER: Runtime Stability, Component Stress & Bundle Verification', () => {
  const dummyPacket: TelemetryPacket = {
    timestamp: 42.5,
    time_step: 2550,
    position: { x: -12.4, y: 5.6, z: 320.8 },
    velocity: { x: 1.2, y: -0.4, z: -1.4, vx: 1.2, vy: -0.4, vz: -1.4, v_xy: 0.35, v_total: 1.88 },
    quaternion: { q0: 0.999, q1: 0.01, q2: -0.02, q3: 0.01 },
    euler: { roll: 1.2, pitch: -2.3, yaw: 0.5, tilt: 2.6 },
    angular_velocity: { wx: 0.01, wy: -0.02, wz: 0.0 },
    fuel: { mass: 520.0, max_mass: 650.0, percentage: 80.0, flow_rate: 1.4 },
    mass: { dry: 450.0, total: 970.0 },
    thrust: { cmd: 0.45, percentage: 45.0, newtons: 2025, gimbal_pitch: 3.5, gimbal_yaw: -2.0 },
    rcs: { roll: 0.0, pitch: 0.0, yaw: 0.0, firing: false },
    stage: { id: 3, name: 'Autonomous Divert', description: 'Lateral hazard avoidance' },
    status: 'NOMINAL',
    constraints: {
      touchdown_vz_safe: true,
      touchdown_vxy_safe: true,
      tilt_safe: true,
      in_descent_cone: true
    },
    landing_site: { target_x: 0, target_y: 0, target_z: 0, distance_to_target: 321.1 },
    mode: 'AI'
  };

  describe('1. Full App & Subcomponent Mount Stress', () => {
    it('mounts full <App /> application tree without unhandled runtime exceptions', () => {
      telemetryStore.publishTelemetry(dummyPacket);
      const { unmount } = render(<App />);

      // Verify key UI text elements are rendered
      expect(screen.getByText(/DROPPER X/i)).toBeInTheDocument();
      expect(screen.getByText(/AUTONOMOUS LUNAR NAVIGATOR/i)).toBeInTheDocument();
      expect(screen.getByText(/MISSION FLIGHT CHECKLIST/i)).toBeInTheDocument();
      expect(screen.getByText(/FLIGHT & VISUAL CONTROLS/i)).toBeInTheDocument();

      // Clean unmount
      unmount();
    });

    it('toggles floating panels (Checklist, Trajectory, Controls) rapidly without crashing', () => {
      render(<App />);

      const checklistBtn = screen.getByTitle('Toggle Mission Checklist Panel');
      const trajectoryBtn = screen.getByTitle('Toggle Trajectory Descent Profile');
      const controlsBtn = screen.getByTitle('Toggle Flight Controls Panel');

      // Click to hide
      fireEvent.click(checklistBtn);
      fireEvent.click(trajectoryBtn);
      fireEvent.click(controlsBtn);

      // Click to re-open
      fireEvent.click(checklistBtn);
      fireEvent.click(trajectoryBtn);
      fireEvent.click(controlsBtn);

      expect(screen.getByText(/MISSION FLIGHT CHECKLIST/i)).toBeInTheDocument();
    });

    it('switches camera perspective modes and visual layer toggles in FlightControls', () => {
      const mockConfigChange = vi.fn();
      render(
        <FlightControls
          config={{
            cameraMode: 'CHASE',
            showTerrainWireframe: false,
            showSlopeHazards: true,
            showTrajectoryLine: true,
            showDustParticles: true,
            showPlume: true
          }}
          onConfigChange={mockConfigChange}
        />
      );

      // Click all 4 camera modes
      fireEvent.click(screen.getByRole('button', { name: 'COCKPIT' }));
      expect(mockConfigChange).toHaveBeenCalledWith({ cameraMode: 'COCKPIT' });

      fireEvent.click(screen.getByRole('button', { name: 'ORBIT' }));
      expect(mockConfigChange).toHaveBeenCalledWith({ cameraMode: 'ORBIT' });

      fireEvent.click(screen.getByRole('button', { name: 'PAD' }));
      expect(mockConfigChange).toHaveBeenCalledWith({ cameraMode: 'LANDING_PAD' });

      fireEvent.click(screen.getByRole('button', { name: 'CHASE' }));
      expect(mockConfigChange).toHaveBeenCalledWith({ cameraMode: 'CHASE' });
    });
  });

  describe('2. Adversarial Telemetry Ingestion (Fault Injection)', () => {
    it('survives zero and negative altitude without throwing runtime errors', () => {
      const negAltPacket: TelemetryPacket = {
        ...dummyPacket,
        position: { x: 0, y: 0, z: -99.9 }
      };

      telemetryStore.publishTelemetry(negAltPacket);
      render(<TelemetryHUD />);

      // Verify HUD doesn't crash and displays altitude
      expect(screen.getByText('RADAR ALTITUDE')).toBeInTheDocument();
      expect(screen.getByTestId('hud-altitude-readout')).toHaveTextContent('-99.9');
    });

    it('survives extreme high tilt angle (> 90 degrees) without throwing or crashing', () => {
      const extremeTiltPacket: TelemetryPacket = {
        ...dummyPacket,
        euler: { roll: 175.0, pitch: 89.0, yaw: -160.0, tilt: 135.5 }
      };

      telemetryStore.publishTelemetry(extremeTiltPacket);
      render(<TelemetryHUD />);

      // Look for off-axis tilt angle formatted
      expect(screen.getByText('135.5°')).toBeInTheDocument();
    });

    it('survives empty / 0 fuel mass without division-by-zero or crash', () => {
      const zeroFuelPacket: TelemetryPacket = {
        ...dummyPacket,
        fuel: { mass: 0.0, max_mass: 650.0, percentage: 0.0, flow_rate: 0.0 },
        thrust: { cmd: 0.0, percentage: 0.0, newtons: 0, gimbal_pitch: 0, gimbal_yaw: 0 },
        status: 'CRITICAL'
      };

      telemetryStore.publishTelemetry(zeroFuelPacket);
      render(<TelemetryHUD />);

      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.getByText('0.0 kg')).toBeInTheDocument();
      expect(screen.getByText('STATUS: CRITICAL')).toBeInTheDocument();
    });

    it('renders MissionChecklist in CRASH status displaying ABORT/CRASH', () => {
      const crashPacket: TelemetryPacket = {
        ...dummyPacket,
        stage: { id: 5, name: 'Touchdown', description: 'Structural failure on touchdown' },
        status: 'CRASH'
      };

      telemetryStore.publishTelemetry(crashPacket);
      render(<MissionChecklist />);

      expect(screen.getByText('ABORT/CRASH')).toBeInTheDocument();
    });

    it('renders ConnectionBadge in STANDALONE and WEBSOCKET modes safely', () => {
      telemetryStore.setConnectionStatus(false, 'STANDALONE');
      const { unmount } = render(<ConnectionBadge />);
      expect(screen.getByText('STANDALONE RK4 SIMULATOR')).toBeInTheDocument();
      unmount();

      telemetryStore.setConnectionStatus(true, 'WEBSOCKET');
      render(<ConnectionBadge />);
      expect(screen.getByText('WS 60Hz: CONNECTED')).toBeInTheDocument();
    });
  });

  describe('3. Production Bundle & Asset Packaging Verification', () => {
    const rootPath = process.cwd();
    const distPath = path.resolve(rootPath, 'dist');
    const publicPath = path.resolve(rootPath, 'public');

    it('verifies 3D model asset exists in public and dist directories', () => {
      const publicGlb = path.join(publicPath, 'assets', 'models', 'dropper_x.glb');
      expect(fs.existsSync(publicGlb)).toBe(true);
      expect(fs.statSync(publicGlb).size).toBeGreaterThan(2000000);

      if (fs.existsSync(distPath)) {
        const distGlb = path.join(distPath, 'assets', 'models', 'dropper_x.glb');
        expect(fs.existsSync(distGlb)).toBe(true);
        expect(fs.statSync(distGlb).size).toBeGreaterThan(2000000);
      }
    });

    it('verifies favicon asset exists in public and dist directories', () => {
      const publicFavicon = path.join(publicPath, 'favicon.svg');
      expect(fs.existsSync(publicFavicon)).toBe(true);

      if (fs.existsSync(distPath)) {
        const distFavicon = path.join(distPath, 'favicon.svg');
        expect(fs.existsSync(distFavicon)).toBe(true);
      }
    });

    it('verifies index.html structure and root mount container', () => {
      const targetHtmlPath = fs.existsSync(distPath)
        ? path.join(distPath, 'index.html')
        : path.join(rootPath, 'index.html');

      expect(fs.existsSync(targetHtmlPath)).toBe(true);
      const htmlContent = fs.readFileSync(targetHtmlPath, 'utf-8');
      expect(htmlContent).toContain('<div id="root"></div>');
    });

    it('verifies production script bundles when dist exists', () => {
      if (fs.existsSync(distPath)) {
        const htmlContent = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const scriptMatches = [...htmlContent.matchAll(/<script[^>]+src="([^"]+)"/g)];
        expect(scriptMatches.length).toBeGreaterThan(0);
        for (const match of scriptMatches) {
          const src = match[1];
          const relativeAssetPath = src.startsWith('/') ? src.slice(1) : src;
          const fullAssetPath = path.join(distPath, relativeAssetPath);
          expect(fs.existsSync(fullAssetPath)).toBe(true);
          const stats = fs.statSync(fullAssetPath);
          expect(stats.size).toBeGreaterThan(1000);
        }
      }
    });

    it('verifies production stylesheet bundles when dist exists', () => {
      if (fs.existsSync(distPath)) {
        const htmlContent = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const linkMatches = [...htmlContent.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)];
        expect(linkMatches.length).toBeGreaterThan(0);
        for (const match of linkMatches) {
          const href = match[1];
          const relativeAssetPath = href.startsWith('/') ? href.slice(1) : href;
          const fullAssetPath = path.join(distPath, relativeAssetPath);
          expect(fs.existsSync(fullAssetPath)).toBe(true);
          const stats = fs.statSync(fullAssetPath);
          expect(stats.size).toBeGreaterThan(100);
        }
      }
    });
  });
});
