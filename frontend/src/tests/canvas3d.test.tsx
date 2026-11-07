import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Canvas3D } from '../components/Canvas3D';
import { VisualizerConfig } from '../types/visualizer';

describe('<Canvas3D /> WebGL Viewport Component', () => {
  const defaultConfig: VisualizerConfig = {
    cameraMode: 'CHASE',
    showTerrainWireframe: false,
    showSlopeHazards: true,
    showTrajectoryLine: true,
    showDustParticles: true,
    showPlume: true
  };

  it('mounts canvas container into DOM and initializes WebGL canvas', () => {
    const { unmount } = render(<Canvas3D config={defaultConfig} />);
    const container = screen.getByTestId('canvas-3d-container');
    expect(container).toBeInTheDocument();

    // Verify canvas child exists
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Unmount cleanly without errors
    unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
