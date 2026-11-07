import * as THREE from 'three';

export class SkyboxEnvironment {
  public starsPoints: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  constructor(starCount = 12000, radius = 9000) {
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    // Color palette for stellar classification:
    // O/B (Blue-White), A/F (White), G (Solar Yellow-White), M (Red-Orange)
    const starPalette = [
      new THREE.Color(0.82, 0.90, 1.0),  // Type B/A Blue-white
      new THREE.Color(1.0, 1.0, 1.0),    // Type A Pure white
      new THREE.Color(1.0, 0.95, 0.8),   // Type G Solar yellow
      new THREE.Color(1.0, 0.80, 0.65),  // Type K Orange
      new THREE.Color(1.0, 0.65, 0.55),  // Type M Red Giant
    ];

    // Fibonacci sphere distribution for uniform celestial sphere coverage
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle ~2.3999 rad

    for (let i = 0; i < starCount; i++) {
      const y = 1 - (i / (starCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      // Add a slight radial jitter so it doesn't look like an artificial grid
      const r = radius * (0.95 + 0.1 * Math.random());
      const x = Math.cos(theta) * radiusAtY * r;
      const z = Math.sin(theta) * radiusAtY * r;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y * r;
      positions[i * 3 + 2] = z;

      // Assign realistic stellar spectral colors and magnitudes
      const colorIndex = Math.floor(Math.random() * starPalette.length);
      const baseColor = starPalette[colorIndex];
      // Brightness distribution (mostly faint stars, few bright ones)
      const brightness = Math.pow(Math.random(), 2.2) * 0.7 + 0.3;

      colors[i * 3] = baseColor.r * brightness;
      colors[i * 3 + 1] = baseColor.g * brightness;
      colors[i * 3 + 2] = baseColor.b * brightness;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: false, // Keep stars pin-sharp regardless of camera distance
      depthWrite: false
    });

    this.starsPoints = new THREE.Points(this.geometry, this.material);
    this.starsPoints.frustumCulled = false;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
