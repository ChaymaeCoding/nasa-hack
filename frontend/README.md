# NASA Space Apps Challenge 2026 — Dropper X Lunar Landing Visualizer

**NASA-HACK Frontend**: Browser-native 3D lunar landing visualization and aerospace telemetry platform developed for the 2026 NASA Space Apps Challenge (*Track: Lunar Landing Site Navigator / Space Mission Design Game*).

---

## Architecture Overview

- **3D Graphics Engine (`src/graphics/`)**:
  - `LunarSceneController.ts`: Encapsulated WebGL engine running at 60 FPS with multiple camera modes (`CHASE`, `COCKPIT`, `ORBIT`, `LANDING_PAD`).
  - `SkyboxEnvironment.ts`: 12,000 star particles on a spherical shell using Fibonacci sphere sampling in a pure black deep space vacuum void (#000000, zero atmosphere).
  - `LunarLighting.ts`: Solar lighting calibrated to Lunar South Pole conditions: low grazing sun elevation (1.5°–3.0°), collimated 1361 W/m² direct solar flux with PCF soft shadows, regolith ambient bounce, and faint earthshine.
  - `TerrainMesh.ts`: 2000m x 2000m Shackleton Crater rim elevation mesh with concentric landing pad target rings and real-time GLSL slope hazard false-color mapping (<5° emerald safe, 5°–15° amber caution, >15° red tip-over hazard).
  - `LanderModel.ts`: Dropper X / Nova-C lunar drone hopper vehicle loader (`/assets/models/dropper_x.glb` exported from Blender 4.3 CAD + rich procedural Three.js fallback). Features dynamic 2-axis nozzle gimbaling clamped to ±20.0° pitch and yaw.
  - `VacuumPlumeShader.ts`: Custom GLSL ShaderMaterial simulating underexpanded vacuum plume blooming flare (cyan-white plasma core fading into amber/violet gas) scaling dynamically with engine throttle.
  - `DustAgitationEmitter.ts`: Radial regolith ejecta particle agitation active during close ground proximity (altitude < 30m) under engine thrust.

- **Aerospace UI/UX Components (`src/components/`)**:
  - `TelemetryHUD.tsx`: Primary Flight Display overlay with moving altitude tape, vertical velocity with green/amber/red safety brackets (safe ≤ 1.5 m/s), horizontal velocity (≤ 0.5 m/s), propellant percentage & mass, thrust in kN, 2-axis gimbal reticle crosshair (±20°), artificial horizon with pitch ladder and off-axis tilt angle (safe ≤ 5.0°).
  - `MissionChecklist.tsx`: 5 flight stages (1. Deorbit Burn, 2. Ballistic Drift, 3. Autonomous Divert, 4. Suicide Burn, 5. Touchdown) with live status tags and pass/fail constraint monitors.
  - `TrajectoryPlot.tsx`: Dynamic SVG descent trajectory chart plotting planned nominal descent vs real-time actual flight track.
  - `FlightControls.tsx`: Manual Pilot vs AI Autopilot authority toggle, manual throttle/gimbal sliders, lateral disturbance vector injection slider, camera perspective selector.
  - `ConnectionBadge.tsx`: WebSocket (60 Hz) vs Standalone Simulator live status indicator with simulation reset button.

- **Services & Standalone Offline Simulator (`src/services/`)**:
  - `fallbackTelemetry.ts`: High-fidelity standalone 6-DOF Runge-Kutta 4th Order (RK4) Lunar Descent Physics Simulator running at 60 Hz under lunar gravity ($g = 1.62\text{ m/s}^2$) and vacuum ($\rho = 0$). Automatically activates whenever backend is offline so the web application is 100% interactive standalone!
  - `websocket.ts`: 60 Hz WebSocket client connecting to `ws://localhost:8000/ws` with exponential backoff auto-reconnect.
  - `telemetryStore.ts`: High-performance observer store distributing state updates with zero React re-render overhead.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in any modern WebGL2-compatible browser.

### 3. Run Automated Test Suite
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```
Generates optimized static assets in `dist/`.
