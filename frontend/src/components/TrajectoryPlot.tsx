import React, { useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';
import { telemetryStore } from '../services/telemetryStore';
import { TrajectoryPoint } from '../types/telemetry';

export const TrajectoryPlot: React.FC = () => {
  const [points, setPoints] = useState<TrajectoryPoint[]>([]);

  useEffect(() => {
    // Sample trajectory at ~10 Hz for SVG chart rendering efficiency
    const interval = setInterval(() => {
      setPoints([...telemetryStore.getTrajectoryHistory()]);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Chart coordinates mapping:
  // Downrange X range: -500m to 100m
  // Altitude Z range: 0m to 1500m
  const svgWidth = 260;
  const svgHeight = 120;
  const padding = 20;

  const minX = -500;
  const maxX = 100;
  const minZ = 0;
  const maxZ = 1500;

  const mapX = (x: number) => {
    const clampedX = Math.max(minX, Math.min(maxX, x));
    return padding + ((clampedX - minX) / (maxX - minX)) * (svgWidth - 2 * padding);
  };

  const mapZ = (z: number) => {
    const clampedZ = Math.max(minZ, Math.min(maxZ, z));
    return svgHeight - padding - ((clampedZ - minZ) / (maxZ - minZ)) * (svgHeight - 2 * padding);
  };

  // Generate nominal trajectory path: parabolic descent to pad (0, 0)
  const nominalPoints: [number, number][] = [];
  for (let x = -480; x <= 0; x += 30) {
    // Parabolic profile: z = 1500 * (x / -480)^1.8
    const z = 1450 * Math.pow(Math.abs(x) / 480, 1.8);
    nominalPoints.push([mapX(x), mapZ(z)]);
  }
  const nominalPathD = nominalPoints.length > 0
    ? `M ${nominalPoints[0][0]} ${nominalPoints[0][1]} ` +
      nominalPoints.slice(1).map(p => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
    : '';

  // Real-time actual trajectory path
  const actualPathD = points.length > 0
    ? `M ${mapX(points[0].x)} ${mapZ(points[0].altitude)} ` +
      points.slice(1).map(p => `L ${mapX(p.x).toFixed(1)} ${mapZ(p.altitude).toFixed(1)}`).join(' ')
    : '';

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div className="aerospace-panel rounded-lg p-2.5 text-xs font-mono text-slate-300 w-72">
      <div className="flex items-center justify-between border-b border-sky-500/20 pb-1.5 mb-2">
        <div className="flex items-center space-x-1.5 text-sky-400 font-semibold">
          <LineChart className="w-3.5 h-3.5" />
          <span>DESCENT PROFILE (Z vs X)</span>
        </div>
        <span className="text-[10px] text-slate-400">AGL: 0-1.5km</span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-28 overflow-visible"
        >
          {/* Grid lines */}
          <line
            x1={padding}
            y1={svgHeight - padding}
            x2={svgWidth - padding}
            y2={svgHeight - padding}
            stroke="rgba(56, 189, 248, 0.3)"
            strokeWidth="1"
          />
          <line
            x1={mapX(0)}
            y1={padding}
            x2={mapX(0)}
            y2={svgHeight - padding}
            stroke="rgba(16, 185, 129, 0.4)"
            strokeDasharray="2 2"
            strokeWidth="1"
          />

          {/* Planned Nominal Curve */}
          <path
            d={nominalPathD}
            fill="none"
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Actual Flight Track */}
          {actualPathD && (
            <path
              d={actualPathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
            />
          )}

          {/* Current Lander Position Marker */}
          {lastPoint && (
            <circle
              cx={mapX(lastPoint.x)}
              cy={mapZ(lastPoint.altitude)}
              r="3.5"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="1.5"
              className="animate-pulse"
            />
          )}

          {/* Target Landing Pad Marker */}
          <rect
            x={mapX(0) - 4}
            y={mapZ(0) - 2}
            width="8"
            height="4"
            fill="#10b981"
          />
        </svg>

        <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
          <span>Downrange: -500m</span>
          <span className="text-emerald-400 font-bold">PAD (0m)</span>
          <span>+100m</span>
        </div>
      </div>
    </div>
  );
};
