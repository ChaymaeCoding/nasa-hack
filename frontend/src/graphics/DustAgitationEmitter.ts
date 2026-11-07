import * as THREE from 'three';

interface DustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

export class DustAgitationEmitter {
  public points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private particles: DustParticle[];
  private maxParticles: number;
  private positions: Float32Array;
  private colors: Float32Array;

  constructor(maxParticles = 1200) {
    this.maxParticles = maxParticles;
    this.particles = [];
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  public update(
    dt: number,
    landerPosition: THREE.Vector3,
    altitude: number,
    thrustCommand: number
  ): void {
    const isEjecting = altitude < 30.0 && thrustCommand > 0.05;

    // Spawn new ejecta particles when in ground proximity under thrust
    if (isEjecting) {
      const spawnCount = Math.floor(thrustCommand * 35 * (1.0 - altitude / 30.0));
      for (let i = 0; i < spawnCount && this.particles.length < this.maxParticles; i++) {
        // High speed radial ejecta cone
        const angle = Math.random() * Math.PI * 2;
        const radialSpeed = (12.0 + Math.random() * 28.0) * thrustCommand;
        const verticalSpeed = (1.5 + Math.random() * 4.5) * (1.0 - altitude / 30.0);

        this.particles.push({
          x: landerPosition.x + (Math.random() - 0.5) * 0.8,
          y: Math.max(0.05, landerPosition.y - altitude * 0.95), // near ground level
          z: landerPosition.z + (Math.random() - 0.5) * 0.8,
          vx: Math.cos(angle) * radialSpeed,
          vy: verticalSpeed,
          vz: Math.sin(angle) * radialSpeed,
          life: 0,
          maxLife: 1.2 + Math.random() * 1.5,
          size: 1.0 + Math.random() * 2.0
        });
      }
    }

    // Step physics under lunar gravity (g = 1.62 m/s²) with zero air drag (vacuum)
    const gLunar = 1.62;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= gLunar * dt; // Lunar gravity

      // Simple ground bounce / settle
      if (p.y < 0.02) {
        p.y = 0.02;
        p.vy = -p.vy * 0.2; // inelastic regolith collision
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
    }

    // Write to GPU buffer attributes
    const activeCount = this.particles.length;
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < activeCount) {
        const p = this.particles[i];
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;

        const alpha = Math.max(0.0, 1.0 - p.life / p.maxLife);
        // Regolith gray-amber dust color
        this.colors[i * 3] = 0.65 * alpha;
        this.colors[i * 3 + 1] = 0.60 * alpha;
        this.colors[i * 3 + 2] = 0.52 * alpha;
      } else {
        // Hide inactive particles far below scene
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -9999;
        this.positions[i * 3 + 2] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
