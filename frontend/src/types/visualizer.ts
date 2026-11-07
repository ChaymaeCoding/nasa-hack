export type CameraMode = 'CHASE' | 'COCKPIT' | 'ORBIT' | 'LANDING_PAD';

export interface VisualizerConfig {
  cameraMode: CameraMode;
  showTerrainWireframe: boolean;
  showSlopeHazards: boolean;
  showTrajectoryLine: boolean;
  showDustParticles: boolean;
  showPlume: boolean;
}
