import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VacuumPlume } from './VacuumPlumeShader';

export class LanderModel {
  public group: THREE.Group;
  public nozzlePivot: THREE.Group;
  public plume: VacuumPlume;
  public isGltfLoaded = false;
  private gltfRoot: THREE.Object3D | null = null;
  private gltfNozzlePivot: THREE.Object3D | null = null;
  private proceduralRoot: THREE.Group;

  constructor() {
    this.group = new THREE.Group();

    // Gimbal pivot group for nozzle articulation
    this.nozzlePivot = new THREE.Group();
    // In Build_Dropper.py, gimbal hinge is at z ≈ 0.25m above base
    this.nozzlePivot.position.set(0, 0.25, 0);

    // Initialize Vacuum Plume Shader
    this.plume = new VacuumPlume();
    // Plume attaches to nozzle exit (~0.18m in CAD coordinate, pointing down)
    this.plume.mesh.position.set(0, -0.07, 0);
    this.nozzlePivot.add(this.plume.mesh);

    // Build procedural fallback first so something is immediately visible
    this.proceduralRoot = this.buildProceduralDropper();
    this.group.add(this.proceduralRoot);

    // Asynchronously attempt to load exported GLB asset
    this.loadGltfAsset('/assets/models/dropper_x.glb');
  }

  private loadGltfAsset(url: string): void {
    try {
      let targetUrl = url;
      if (typeof window !== 'undefined' && window.location && window.location.href) {
        try {
          targetUrl = new URL(url, window.location.href).href;
        } catch {
          // fallback to original
        }
      }

      const loader = new GLTFLoader();
      loader.load(
        targetUrl,
        (gltf) => {
          this.gltfRoot = gltf.scene;
          // Search for nozzle bell node to articulate
          let foundNozzle: THREE.Object3D | null = null;
          this.gltfRoot.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
            if (child.name.toLowerCase().includes('nozzle') || child.name.toLowerCase().includes('gimbal')) {
              if (!foundNozzle) foundNozzle = child;
            }
          });

          // If nozzle found, wrap it in a gimbal pivot or attach plume
          if (foundNozzle) {
            this.gltfNozzlePivot = foundNozzle;
          }

          // Replace procedural model with loaded GLTF
          this.group.remove(this.proceduralRoot);
          this.group.add(this.gltfRoot);

          // Re-parent plume to the GLTF model's nozzle
          if (this.gltfNozzlePivot) {
            this.gltfNozzlePivot.add(this.plume.mesh);
            this.plume.mesh.position.set(0, -0.06, 0);
          } else {
            this.gltfRoot.add(this.nozzlePivot);
          }

          this.isGltfLoaded = true;
        },
        undefined,
        () => {
          // GLTF load failed, procedural fallback remains active
        }
      );
    } catch {
      // Procedural fallback active
    }
  }

  /**
   * Translates geometry definitions from Build_Dropper.py into Three.js primitives
   */
  private buildProceduralDropper(): THREE.Group {
    const root = new THREE.Group();

    // Materials
    const goldMLI = new THREE.MeshStandardMaterial({
      color: 0xd49b28,
      metalness: 0.85,
      roughness: 0.32
    });
    const frameMetal = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.35
    });
    const darkComposite = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.5,
      roughness: 0.3
    });
    const solarBlue = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.75,
      roughness: 0.2
    });
    const nozzleGraphite = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.4
    });
    const moroccoRed = new THREE.MeshStandardMaterial({
      color: 0xc9182b,
      roughness: 0.6
    });

    // 1. Hexagonal Frame Rims (top and bottom)
    for (const y of [0.28, 0.55]) {
      const hexGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.015, 6);
      const hexMesh = new THREE.Mesh(hexGeo, frameMetal);
      hexMesh.position.y = y;
      hexMesh.castShadow = true;
      root.add(hexMesh);
    }

    // 2. Corner Longerons & MLI Gold Panels (6 faces)
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = 0.168 * Math.cos(angle);
      const z = 0.168 * Math.sin(angle);

      // Vertical longeron rod
      const rodGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.27, 8);
      const rodMesh = new THREE.Mesh(rodGeo, frameMetal);
      rodMesh.position.set(x, 0.415, z);
      rodMesh.castShadow = true;
      root.add(rodMesh);

      // Gold MLI Face
      const midAngle = angle + Math.PI / 6;
      const mx = 0.152 * Math.cos(midAngle);
      const mz = 0.152 * Math.sin(midAngle);
      const panelGeo = new THREE.BoxGeometry(0.16, 0.25, 0.006);
      const panelMesh = new THREE.Mesh(panelGeo, goldMLI);
      panelMesh.position.set(mx, 0.415, mz);
      panelMesh.rotation.y = -midAngle + Math.PI / 2;
      panelMesh.castShadow = true;
      root.add(panelMesh);
    }

    // 3. Identification Panel & Moroccan Flag
    const idPanelGeo = new THREE.BoxGeometry(0.14, 0.16, 0.008);
    const idPanel = new THREE.Mesh(idPanelGeo, darkComposite);
    idPanel.position.set(0, 0.415, -0.158);
    root.add(idPanel);

    const flagGeo = new THREE.BoxGeometry(0.06, 0.04, 0.002);
    const flagMesh = new THREE.Mesh(flagGeo, moroccoRed);
    flagMesh.position.set(0, 0.385, -0.163);
    root.add(flagMesh);

    // 4. Avionics Equipment Decks & Propellant Tank
    const deckGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.005, 6);
    const deck1 = new THREE.Mesh(deckGeo, frameMetal);
    deck1.position.y = 0.33;
    const deck2 = new THREE.Mesh(deckGeo, frameMetal);
    deck2.position.y = 0.46;
    root.add(deck1, deck2);

    // Spherical Propellant Tank
    const tankGeo = new THREE.SphereGeometry(0.06, 24, 24);
    tankGeo.scale(1.0, 1.35, 1.0);
    const tankMesh = new THREE.Mesh(tankGeo, frameMetal);
    tankMesh.position.set(0, 0.39, 0.045);
    root.add(tankMesh);

    // 5. Gimbal Assembly & Engine Bell
    const gimbalBossGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16);
    const gimbalBoss = new THREE.Mesh(gimbalBossGeo, darkComposite);
    gimbalBoss.position.set(0, 0.264, 0);
    root.add(gimbalBoss);

    // Attach nozzle bell mesh into the nozzlePivot
    const chamberGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.024, 16);
    const chamber = new THREE.Mesh(chamberGeo, frameMetal);
    chamber.position.set(0, -0.01, 0);

    const nozzleGeo = new THREE.ConeGeometry(0.035, 0.05, 32, 1, true);
    nozzleGeo.rotateX(Math.PI); // wide cone opening downward
    const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleGraphite);
    nozzleMesh.position.set(0, -0.04, 0);
    nozzleMesh.castShadow = true;

    this.nozzlePivot.add(chamber);
    this.nozzlePivot.add(nozzleMesh);
    root.add(this.nozzlePivot);

    // 6. Four Articulated Inverted-Tripod Landing Gear Legs
    for (let i = 0; i < 4; i++) {
      const legAngle = Math.PI / 4 + (i * Math.PI) / 2;
      const legPivot = new THREE.Group();
      legPivot.position.set(0.142 * Math.cos(legAngle), 0.33, 0.142 * Math.sin(legAngle));
      legPivot.rotation.y = -legAngle;

      // Primary strut
      const strutGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.22, 12);
      const strut = new THREE.Mesh(strutGeo, darkComposite);
      strut.position.set(0.08, -0.10, 0);
      strut.rotation.z = -0.65;
      strut.castShadow = true;
      legPivot.add(strut);

      // Damper piston
      const pistonGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 12);
      const piston = new THREE.Mesh(pistonGeo, frameMetal);
      piston.position.set(0.19, -0.25, 0);
      piston.rotation.z = -0.75;
      piston.castShadow = true;
      legPivot.add(piston);

      // Landing Footpad contact disc
      const footpadGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.01, 32);
      const footpad = new THREE.Mesh(footpadGeo, frameMetal);
      footpad.position.set(0.244, -0.32, 0);
      footpad.castShadow = true;
      legPivot.add(footpad);

      root.add(legPivot);
    }

    // 7. Deployable Solar Panels (Left & Right)
    for (const side of [-1, 1]) {
      const solarGroup = new THREE.Group();
      solarGroup.position.set(side * 0.176, 0.54, 0);

      const panelSubstrateGeo = new THREE.BoxGeometry(0.22, 0.006, 0.155);
      const substrate = new THREE.Mesh(panelSubstrateGeo, darkComposite);
      substrate.position.set(side * 0.11, 0, 0);
      solarGroup.add(substrate);

      // Solar Silicon Blue Cells
      const cellGeo = new THREE.BoxGeometry(0.20, 0.002, 0.14);
      const cell = new THREE.Mesh(cellGeo, solarBlue);
      cell.position.set(side * 0.11, 0.004, 0);
      solarGroup.add(cell);

      root.add(solarGroup);
    }

    // 8. Sensors: LiDAR Dome and Dual Cameras
    const lidarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16);
    const lidar = new THREE.Mesh(lidarGeo, darkComposite);
    lidar.position.set(0, 0.59, 0);
    root.add(lidar);

    const cameraGeo = new THREE.BoxGeometry(0.035, 0.03, 0.03);
    const camLeft = new THREE.Mesh(cameraGeo, frameMetal);
    camLeft.position.set(-0.04, 0.50, -0.165);
    const camRight = new THREE.Mesh(cameraGeo, frameMetal);
    camRight.position.set(0.04, 0.50, -0.165);
    root.add(camLeft, camRight);

    return root;
  }

  /**
   * Applies vehicle telemetry attitude, position, nozzle gimbaling, and plume scaling
   */
  public updateTelemetry(
    x: number,
    y: number,
    z: number,
    q0: number, // w
    q1: number, // x
    q2: number, // y
    q3: number, // z
    gimbalPitchDeg: number,
    gimbalYawDeg: number,
    thrustCmd: number,
    simTime: number
  ): void {
    // 1. Position in Three.js coordinate space: X = downrange, Y = altitude AGL, Z = -crossrange
    // In Build_Dropper, footpads rest at ~ -0.32m when vehicle root is at 0.
    // Offset vehicle root by +0.32 so when telemetry altitude = 0, footpads rest on the lunar surface!
    this.group.position.set(x, z + 0.32, -y);

    // 2. Unit Quaternion Attitude
    this.group.quaternion.set(q1, q2, q3, q0);

    // 3. Dynamic 2-Axis Engine Nozzle Gimbaling (clamped to ±20.0 degrees)
    const pitchClamped = THREE.MathUtils.clamp(gimbalPitchDeg, -20.0, 20.0);
    const yawClamped = THREE.MathUtils.clamp(gimbalYawDeg, -20.0, 20.0);
    const pitchRad = THREE.MathUtils.degToRad(pitchClamped);
    const yawRad = THREE.MathUtils.degToRad(yawClamped);

    // Apply rotation to nozzle pivot
    if (this.gltfNozzlePivot) {
      this.gltfNozzlePivot.rotation.set(pitchRad, 0, yawRad);
    } else {
      this.nozzlePivot.rotation.set(pitchRad, 0, yawRad);
    }

    // 4. Update Vacuum Plume Particle Shader
    this.plume.update(simTime, thrustCmd);
  }

  public dispose(): void {
    this.plume.dispose();
  }
}
