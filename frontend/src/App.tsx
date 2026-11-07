import React, { useEffect, useState } from 'react';
import { Canvas3D } from './components/Canvas3D';
import { TelemetryHUD } from './components/TelemetryHUD';
import { MissionChecklist } from './components/MissionChecklist';
import { TrajectoryPlot } from './components/TrajectoryPlot';
import { FlightControls } from './components/FlightControls';
import { ConnectionBadge } from './components/ConnectionBadge';
import { wsClient } from './services/websocket';
import { VisualizerConfig } from './types/visualizer';
import { Rocket, Layers, Sliders, LineChart } from 'lucide-react';

export const App: React.FC = () => {
  const [config, setConfig] = useState<VisualizerConfig>({
    cameraMode: 'CHASE',
    showTerrainWireframe: false,
    showSlopeHazards: true,
    showTrajectoryLine: true,
    showDustParticles: true,
    showPlume: true
  });

  const [showChecklist, setShowChecklist] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);

  useEffect(() => {
    // Attempt WebSocket connection to backend, seamlessly starts Standalone Simulator if offline
    wsClient.connect();
    return () => {
      wsClient.disconnect();
    };
  }, []);

  const handleConfigChange = (newConfig: Partial<VisualizerConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-mono">
      {/* 1. Main 3D WebGL Canvas Layer */}
      <Canvas3D config={config} />

      {/* 2. Aerospace Real-Time Telemetry HUD Overlay */}
      <TelemetryHUD />

      {/* 3. Top Left Branding & Mission Title */}
      <div className="absolute top-3 left-4 flex items-center space-x-3 pointer-events-auto">
        <div className="aerospace-panel px-3.5 py-1.5 rounded-lg flex items-center space-x-2">
          <Rocket className="w-5 h-5 text-sky-400" />
          <div>
            <div className="text-xs font-bold text-white tracking-widest leading-none">
              DROPPER X
            </div>
            <div className="text-[9px] text-sky-400 font-medium tracking-tight">
              AUTONOMOUS LUNAR NAVIGATOR
            </div>
          </div>
        </div>

        {/* Live WebSocket / Standalone Simulator Status Badge */}
        <ConnectionBadge />
      </div>

      {/* 4. Top Right Floating Panel Toggles */}
      <div className="absolute top-3 right-4 flex items-center space-x-1.5 pointer-events-auto text-xs">
        <button
          onClick={() => setShowChecklist(!showChecklist)}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
            showChecklist
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Mission Checklist Panel"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CHECKLIST</span>
        </button>

        <button
          onClick={() => setShowTrajectory(!showTrajectory)}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
            showTrajectory
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Trajectory Descent Profile"
        >
          <LineChart className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">TRAJECTORY</span>
        </button>

        <button
          onClick={() => setShowControls(!showControls)}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
            showControls
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Flight Controls Panel"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CONTROLS</span>
        </button>
      </div>

      {/* 5. Left Side: Mission Checklist Panel */}
      {showChecklist && (
        <div className="absolute left-4 top-48 pointer-events-auto transition-all">
          <MissionChecklist />
        </div>
      )}

      {/* 6. Right Side: Trajectory Plot and Controls Panels */}
      <div className="absolute right-4 top-48 flex flex-col space-y-3 pointer-events-auto">
        {showTrajectory && <TrajectoryPlot />}
        {showControls && (
          <FlightControls
            config={config}
            onConfigChange={handleConfigChange}
          />
        )}
      </div>

      {/* 7. Bottom Subtle Watermark / South Pole Coordinates */}
      <div className="absolute bottom-2 left-4 text-[10px] text-slate-400 font-mono pointer-events-none">
        <span>LOC: SHACKLETON RIM (89.9°S, 0.0°E) | MOON TREK DEM | G: 1.62 m/s²</span>
      </div>
    </div>
  );
};

export default App;
