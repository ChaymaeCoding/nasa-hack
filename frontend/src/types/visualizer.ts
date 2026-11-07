export type CameraMode = 'CHASE' | 'COCKPIT' | 'ORBIT' | 'LANDING_PAD';
export type VehicleModelType = 'SATURN_V' | 'DROPPER_X';
export type EnvironmentLightingMode = 'DAY' | 'NIGHT' | 'LUNAR';

export interface VisualizerConfig {
  cameraMode: CameraMode;
  showTerrainWireframe: boolean;
  showSlopeHazards: boolean;
  showTrajectoryLine: boolean;
  showDustParticles: boolean;
  showPlume: boolean;
  vehicleModel?: VehicleModelType;
  lightingMode?: EnvironmentLightingMode;
}
