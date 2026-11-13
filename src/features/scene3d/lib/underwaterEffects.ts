import { Mesh, MeshBuilder, Scene, ShaderMaterial, Vector3, VertexData, type ArcRotateCamera } from '@babylonjs/core'
import { OCEAN_VERTEX } from './oceanShaders'
import type { OceanPalette } from './themes3d'

const CAUSTIC_FRAGMENT = `
precision highp float;
varying vec3 vWorld;
uniform vec3 lightColor;
uniform vec3 cameraPosition;
uniform float clock;
void main(void) {
  vec2 p = vWorld.xz * 0.008;
  p += vec2(sin(p.y * 0.7 + clock * 0.18), cos(p.x * 0.6 - clock * 0.14)) * 0.8;
  float network = abs(sin(p.x + p.y * 0.36 + clock * 0.16) + cos(p.y - p.x * 0.27 - clock * 0.12));
  float gleam = pow(max(0.0, 1.0 - network * 0.65), 14.0);
  float fade = 1.0 - smoothstep(12000.0, 60000.0, distance(cameraPosition, vWorld));
  gl_FragColor = vec4(lightColor, gleam * 0.23 * fade);
}`
const VOLUME_FRAGMENT = `
precision highp float;
varying vec3 vWorld;
uniform vec3 cameraPosition;
uniform vec3 waterColor;
uniform vec3 lightColor;
uniform float clock;
uniform float immersion;
void main(void) {
  vec3 d = normalize(vWorld - cameraPosition);
  // Broad forward scattering has no periodic azimuth bands or pole/seam stripes.
  // Confine illumination to the upper hemisphere, keeping the lower view clean.
  float upper = smoothstep(0.08, 0.65, d.y);
  vec3 sun = normalize(vec3(-0.42, 0.76, 0.49));
  float lightWindow = pow(max(0.0, dot(d, sun)), 16.0);
  float shoulder = pow(max(0.0, dot(d, normalize(sun + vec3(0.18, -0.06, 0.12)))), 28.0);
  float gentleMotion = 0.85 + 0.15 * sin(clock * 0.11 + d.x * 2.0 + d.z * 1.7);
  float shafts = upper * lightWindow * gentleMotion * (0.75 + shoulder * 0.25);
  vec3 color = mix(waterColor, lightColor, shafts * 0.85);
  gl_FragColor = vec4(color, (0.12 + shafts * 0.10) * immersion);
}`
const PARTICLE_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 viewProjection;
uniform vec3 cameraPosition;
uniform float clock;
varying float opacity;
void main(void) {
  vec3 drift = vec3(clock * 2.0, clock * 1.4, sin(clock * 0.06) * 18.0);
  vec3 local = mod(position + drift - cameraPosition + 2400.0, 4800.0) - 2400.0;
  float radius = length(local);
  opacity = smoothstep(120.0, 550.0, radius) * (1.0 - smoothstep(1500.0, 2350.0, radius));
  gl_Position = viewProjection * vec4(cameraPosition + local, 1.0);
  gl_PointSize = clamp(3000.0 / max(radius, 100.0), 1.2, 3.8);
}`
const PARTICLE_FRAGMENT = `
precision highp float;
varying float opacity;
uniform vec3 lightColor;
uniform float immersion;
void main(void) {
  float radius = length(gl_PointCoord - 0.5);
  float alpha = (1.0 - smoothstep(0.1, 0.5, radius)) * opacity * immersion * 0.52;
  gl_FragColor = vec4(lightColor, alpha);
}`

/** Three bounded draws; no per-particle CPU updates, timers, or render targets. */
export const createUnderwaterEffects = (scene: Scene, palette: OceanPalette, seaLevel: number) => {
  let caustics: Mesh | null = null, volume: Mesh | null = null, particles: Mesh | null = null
  let enabled = false, immersion = 0
  const causticMaterial = new ShaderMaterial('ocean-caustic-material', scene, { vertexSource: OCEAN_VERTEX, fragmentSource: CAUSTIC_FRAGMENT }, {
    attributes: ['position'], uniforms: ['world', 'worldViewProjection', 'clock', 'cameraPosition', 'lightColor'], needAlphaBlending: true,
  })
  causticMaterial.disableDepthWrite = true; causticMaterial.zOffset = -2
  causticMaterial.setColor3('lightColor', palette.glint).setFloat('clock', 0).setVector3('cameraPosition', Vector3.Zero())
  const volumeMaterial = new ShaderMaterial('ocean-water-volume-material', scene, { vertexSource: OCEAN_VERTEX, fragmentSource: VOLUME_FRAGMENT }, {
    attributes: ['position'], uniforms: ['world', 'worldViewProjection', 'cameraPosition', 'waterColor', 'lightColor', 'clock', 'immersion'], needAlphaBlending: true,
  })
  volumeMaterial.backFaceCulling = false; volumeMaterial.disableDepthWrite = true
  volumeMaterial.setColor3('waterColor', palette.water.scale(0.75)).setColor3('lightColor', palette.glint)
    .setFloat('clock', 0).setFloat('immersion', 0).setVector3('cameraPosition', Vector3.Zero())
  const particleMaterial = new ShaderMaterial('ocean-suspended-particle-material', scene, { vertexSource: PARTICLE_VERTEX, fragmentSource: PARTICLE_FRAGMENT }, {
    attributes: ['position'], uniforms: ['viewProjection', 'cameraPosition', 'clock', 'lightColor', 'immersion'], needAlphaBlending: true,
  })
  particleMaterial.pointsCloud = true; particleMaterial.disableDepthWrite = true
  particleMaterial.setColor3('lightColor', palette.glint).setFloat('clock', 0).setFloat('immersion', 0).setVector3('cameraPosition', Vector3.Zero())
  const applyEnabled = () => {
    caustics?.setEnabled(enabled)
    volume?.setEnabled(enabled && immersion > 0)
    particles?.setEnabled(enabled && immersion > 0)
  }
  const own = (mesh: Mesh) => {
    mesh.isPickable = false; mesh.metadata = { oceanEnvironment: true, underwaterEffect: true }
    return mesh
  }
  const clear = () => {
    caustics?.dispose(); volume?.dispose(); particles?.dispose()
    caustics = volume = particles = null
  }
  return {
    syncBed: (bed: Mesh) => {
      clear()
      caustics = own(bed.clone('ocean-seabed-caustics', null, false)!)
      caustics.material = causticMaterial
      volume = own(MeshBuilder.CreateSphere('ocean-water-volume', { diameter: 180, segments: 12 }, scene))
      volume.material = volumeMaterial; volume.alwaysSelectAsActiveMesh = true
      particles = own(new Mesh('ocean-suspended-particles', scene))
      const positions: number[] = [], indices: number[] = []
      let seed = 31991
      for (let i = 0; i < 512; i++) {
        for (let axis = 0; axis < 3; axis++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) | 0
          positions.push((seed >>> 0) / 4294967296 * 4800 - 2400)
        }
        indices.push(i)
      }
      const data = new VertexData(); data.positions = positions; data.indices = indices; data.applyToMesh(particles)
      particles.material = particleMaterial; particles.alwaysSelectAsActiveMesh = true
      applyEnabled()
    },
    frame: (camera: ArcRotateCamera, seconds: number) => {
      if (!enabled) return
      immersion = Math.max(0, Math.min(1, (seaLevel - camera.position.y) / 150))
      volume?.position.copyFrom(camera.position)
      for (const material of [causticMaterial, volumeMaterial, particleMaterial]) {
        material.setVector3('cameraPosition', camera.position).setFloat('clock', seconds)
      }
      volumeMaterial.setFloat('immersion', immersion); particleMaterial.setFloat('immersion', immersion)
      applyEnabled()
    },
    setEnabled: (value: boolean) => { enabled = value; applyEnabled() },
    clear,
    dispose: () => { clear(); causticMaterial.dispose(); volumeMaterial.dispose(); particleMaterial.dispose() },
  }
}
