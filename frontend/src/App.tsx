import React, { useEffect, useState } from 'react';
import { Canvas3D } from './components/Canvas3D';
import { TelemetryHUD } from './components/TelemetryHUD';
import { MissionChecklist } from './components/MissionChecklist';
import { TrajectoryPlot } from './components/TrajectoryPlot';
import { FlightControls } from './components/FlightControls';
import { ConnectionBadge } from './components/ConnectionBadge';
import { LilGuiOverlay } from './components/LilGuiOverlay';
import { wsClient } from './services/websocket';
import { VisualizerConfig } from './types/visualizer';
import { Rocket, Layers, Sliders, LineChart, LayoutTemplate } from 'lucide-react';

export const App: React.FC = () => {
  const [config, setConfig] = useState<VisualizerConfig>({
    cameraMode: 'ORBIT',
    showTerrainWireframe: false,
    showSlopeHazards: false,
    showTrajectoryLine: true,
    showDustParticles: true,
    showPlume: true,
    vehicleModel: 'SATURN_V',
    lightingMode: 'DAY'
  });

  const [viewMode, setViewMode] = useState<'SIMULATION_LAB' | 'AEROSPACE_HUD'>('SIMULATION_LAB');
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

      {/* 2. Photo 2 Simulation Lab Lil-GUI Overlay (Default & Active) */}
      {viewMode === 'SIMULATION_LAB' && (
        <LilGuiOverlay config={config} onConfigChange={handleConfigChange} />
      )}

      {/* 3. Top Mode Switcher Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-slate-900/85 backdrop-blur-md px-2 py-1 rounded-full border border-slate-700/80 z-40 shadow-xl pointer-events-auto">
        <button
          onClick={() => setViewMode('SIMULATION_LAB')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            viewMode === 'SIMULATION_LAB'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span>Simulation Lab (Photo 2)</span>
        </button>

        <button
          onClick={() => setViewMode('AEROSPACE_HUD')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            viewMode === 'AEROSPACE_HUD'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Aerospace HUD</span>
        </button>
      </div>

      {/* 4. Aerospace HUD Layer (Visible in AEROSPACE_HUD mode or accessible to tests) */}
      <div className={viewMode === 'AEROSPACE_HUD' ? 'block' : 'hidden'}>
        <TelemetryHUD />

        {/* Top Left Branding & Mission Title */}
        <div className="absolute top-3 left-4 flex items-center space-x-3 pointer-events-auto z-30">
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
          <ConnectionBadge />
        </div>

        {/* Floating Panel Toggles */}
        <div className="absolute top-3 right-4 flex items-center space-x-1.5 pointer-events-auto text-xs z-30">
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

        {/* Left Side: Mission Checklist Panel */}
        {showChecklist && (
          <div className="absolute left-4 top-48 pointer-events-auto transition-all z-20">
            <MissionChecklist />
          </div>
        )}

        {/* Right Side: Trajectory Plot and Controls Panels */}
        <div className="absolute right-4 top-48 flex flex-col space-y-3 pointer-events-auto z-20">
          {showTrajectory && <TrajectoryPlot />}
          {showControls && (
            <FlightControls
              config={config}
              onConfigChange={handleConfigChange}
            />
          )}
        </div>
      </div>

      {/* Bottom Subtle Watermark */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-400/80 font-mono pointer-events-none z-20">
        <span>ROCKET SIMULATION LAB | 3D GRAPHICS & FLIGHT DATA ENGINE</span>
      </div>
    </div>
  );
};

export default App;
