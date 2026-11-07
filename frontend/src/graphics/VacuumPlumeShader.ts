import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  uniform float uThrust;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normal;
    vec3 pos = position;

    // Vacuum underexpanded blooming:
    // Radial expansion grows dramatically along the plume axis (uv.y from 0 at nozzle to 1 at tip)
    float bloom = 1.0 + 3.2 * pow(uv.y, 1.4);
    float spread = (0.2 + 0.8 * uThrust);
    
    pos.x *= bloom * spread;
    pos.z *= bloom * spread;
    pos.y *= (0.25 + 0.95 * uThrust);

    vPosition = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uThrust;
  uniform vec3 uCoreColor;    // Cyan-white plasma
  uniform vec3 uMidColor;     // Recombination amber/orange
  uniform vec3 uOuterColor;   // Diffuse violet envelope
  varying vec2 vUv;
  varying vec3 vPosition;

  // Pseudo-random noise for exhaust turbulent advection
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    if (uThrust < 0.01) discard;

    float t = vUv.y; // 0.0 at nozzle exit to 1.0 at plume tip
    float r = length(vPosition.xz);

    // High velocity downstream flow advection
    float turbulence = noise(vec2(vUv.x * 12.0, t * 20.0 - uTime * 28.0));

    // Dynamic vacuum color transitions
    vec3 color = mix(uCoreColor, uMidColor, smoothstep(0.0, 0.35, t));
    color = mix(color, uOuterColor, smoothstep(0.35, 0.9, t));

    // Bright inner Mach disk / plasma core
    float coreGlow = exp(-r * 6.5) * 2.2 * (1.0 - smoothstep(0.0, 0.6, t));
    color += uCoreColor * coreGlow;

    // Vacuum radial expansion dissipation
    float alpha = (1.0 - pow(t, 1.25)) * exp(-r * 2.2) * (0.8 + 0.3 * turbulence);
    alpha *= clamp(uThrust * 1.2, 0.0, 1.0);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

export class VacuumPlume {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    // Inverted truncated cone mesh for rocket plume
    const geometry = new THREE.CylinderGeometry(
      0.02,  // top radius (attached to nozzle exit)
      0.45,  // bottom radius (blooming vacuum exhaust)
      1.2,   // plume length
      32,    // radial segments
      24,    // height segments
      true   // open-ended
    );
    // Align plume so top is at origin, pointing down along -Y
    geometry.translate(0, -0.6, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uThrust: { value: 0.0 },
        uCoreColor: { value: new THREE.Color(0.2, 0.9, 1.0) },    // Brilliant Cyan-White Hot Plasma
        uMidColor: { value: new THREE.Color(1.0, 0.55, 0.08) },   // Solar Recombination Amber
        uOuterColor: { value: new THREE.Color(0.55, 0.15, 0.85) } // Rarefied Vacuum Violet
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  public update(time: number, thrustCommand: number): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uThrust.value = THREE.MathUtils.clamp(thrustCommand, 0.0, 1.0);
    this.mesh.visible = thrustCommand > 0.01;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
