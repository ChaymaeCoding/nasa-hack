# NASA Space Apps Challenge 2026 — NASA-HACK

## Autonomous Lunar Landing Dynamics & Real-Time Mission Visualizer (Dropper X / Nova-C)

Welcome to the **NASA-HACK** repository for the **NASA Space Apps Challenge 2026** (*Track: Lunar Landing Site Navigator / Space Mission Design Game*).

This project integrates high-fidelity lunar flight dynamics, AI-driven guidance, navigation, and control (GNC), and a browser-native Three.js 3D visualizer and aerospace telemetry HUD for the **Dropper X** lunar lander mission to the Lunar South Pole (Shackleton Crater rim).

---

## Repository Structure

```
nasa/
├── frontend/                                   # Task 2: WebGL 3D Lunar Visualizer & Telemetry HUD
│   ├── public/
│   │   ├── assets/models/dropper_x.glb         # High-resolution 3D GLTF model of Dropper X lander
│   │   └── favicon.svg                         # Apollo / NASA mission vector icon
│   ├── src/
│   │   ├── components/                         # Aerospace HUD, checklist, charts, controls
│   │   │   ├── TelemetryHUD.tsx                # Primary Flight Display & telemetry tapes
│   │   │   ├── MissionChecklist.tsx            # Flight stage tracking & safety thresholds
│   │   │   ├── TrajectoryPlot.tsx              # Dynamic 2D descent profile & target trajectory
│   │   │   ├── FlightControls.tsx              # Autopilot / manual override & camera controls
│   │   │   └── ConnectionBadge.tsx             # Telemetry link & simulator status indicator
│   │   ├── graphics/                           # Three.js WebGL scene engine
│   │   │   ├── LunarSceneController.ts         # Multi-camera rendering loop (60 FPS)
│   │   │   ├── LunarLighting.ts                # South pole solar illumination & earthshine
│   │   │   ├── SkyboxEnvironment.ts            # Deep space void & 12,000 star field
│   │   │   ├── TerrainMesh.ts                  # Crater rim topography & slope hazard false-color shader
│   │   │   ├── LanderModel.ts                  # Dropper X loader & ±20° nozzle gimbaling
│   │   │   ├── VacuumPlumeShader.ts            # Underexpanded rocket exhaust plume shader
│   │   │   └── DustAgitationEmitter.ts         # Lunar regolith surface ejecta simulation
│   │   ├── services/                           # Telemetry bus & standalone offline physics
│   │   │   ├── telemetryStore.ts               # Observer store for 60 Hz reactive updates
│   │   │   ├── fallbackTelemetry.ts            # Standalone RK4 6-DOF lunar flight simulator
│   │   │   └── websocket.ts                    # Real-time WebSocket bridge (ws://localhost:8000/ws)
│   │   ├── test/                               # Comprehensive Vitest test suite
│   │   ├── types/                              # Strict TypeScript telemetry & flight schema
│   │   ├── App.tsx                             # Main dashboard application layout
│   │   └── main.tsx                            # React 18 DOM mount point
│   ├── index.html                              # High-DPI viewport entry
│   ├── package.json                            # Frontend dependencies & scripts
│   ├── tsconfig.json                           # TypeScript configuration
│   └── vite.config.ts                          # Vite build tool configuration
├── NASA Space Apps 2026 — Project Specification & Architecture (NASA-HACK).pdf
└── .gitignore                                  # Git exclusion configuration
```

---

## Key Features

### 1. 3D Lunar Visualizer & Deep Space Environment
- **Dropper X Lander CAD Asset**: High-detail GLB model with procedural fallback, featuring 2-axis nozzle gimbaling (clamped to ±20.0° pitch and yaw).
- **Lunar South Pole Lighting**: Sun elevation low on the horizon (1.5°–3.0°) casting elongated grazing shadows across craters, with collimated direct solar flux (1361 W/m²) and faint earthshine.
- **Vacuum Plume Shader**: Custom GLSL shader recreating the underexpanded vacuum blooming effect of bipropellant hypergolic engines in space.
- **Dynamic Terrain & Hazard Mapping**: 2 km x 2 km lunar south pole terrain with real-time false-color slope hazard detection (<5° green safe, 5°–15° amber caution, >15° red hazard).
- **Surface Dust Agitation**: Regolith dust ejecta particle simulation activating during terminal descent (<30 m altitude).

### 2. Aerospace Primary Flight Display (HUD)
- **Moving Tapes**: Altitude (m) and vertical descent rate (m/s) with color-coded safety margins.
- **Attitude Indicator & Pitch Ladder**: Artificial horizon displaying vehicle roll and pitch with off-axis tilt angle warning (safe threshold ≤ 5.0°).
- **Gimbal Reticle**: Real-time 2-axis nozzle deflection crosshairs.
- **Propellant & Thrust Gauges**: Live propellant percentage, consumed mass, and engine thrust in kilonewtons.
- **Dynamic Trajectory Chart**: Altitude vs downrange distance plotting current vehicle trajectory against nominal planned trajectory.

### 3. Mission Stage Progression & Live Checklist
- Step-by-step telemetry monitoring across 5 mission phases:
  1. *Deorbit Burn* (altitude ~15,000 m)
  2. *Ballistic Drift / Coast* (altitude ~8,000 m)
  3. *Autonomous Hazard Avoidance & Divert* (altitude ~2,000 m)
  4. *Suicide Burn / Terminal Deceleration* (altitude ~500 m)
  5. *Touchdown / Engine Cutoff* (altitude ≤ 0.5 m, $V_z \le 1.5\text{ m/s}$)

### 4. High-Fidelity Standalone Offline Simulator
- Built-in 6-DOF Runge-Kutta 4th-Order (RK4) physics engine operating under lunar gravity ($g = 1.62\text{ m/s}^2$) and vacuum ($\rho = 0$).
- Seamless fallback when the backend WebSocket (`ws://localhost:8000/ws`) is not connected, allowing standalone exploration, manual piloting, and autopilot demonstration.

---

## Getting Started

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### Installation & Execution
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run automated test suites
npm test

# Run production build
npm run build

# Start local development server
npm run dev
```

Open `http://localhost:5173` in any modern WebGL2-enabled web browser.

---

## Technical Specifications & Integration Contracts
- **Telemetry Schema**: Telemetry packets follow the NASA-HACK specification with 60 Hz streaming rate, transmitting timestamp, position $[x, y, z]$, velocity $[v_x, v_y, v_z]$, attitude $[\phi, \theta, \psi]$, angular velocities, propellant remaining, thrust, and gimbal angles.
- **WebSocket Protocol**: JSON stream connecting to `ws://localhost:8000/ws`.

---

## Authors & Credits
Developed for the **NASA Space Apps Challenge 2026** by Marwane Haddane & the NASA-HACK Engineering Team.
