import { Color3, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, PBRMaterial, RawTexture, Scene, ShaderMaterial, Texture, Vector3, VertexData, type ArcRotateCamera } from '@babylonjs/core'
import { createUnderwaterEffects } from './underwaterEffects'
import { SEABED_LEVEL_METERS, SEABED_RELIEF_METERS, seabedElevationMeters } from './seabedTerrain'
import { OCEAN_VERTEX, SKY_VERTEX, SKY_FRAGMENT, WATER_FRAGMENT } from './oceanShaders'
import { DEPTH_SCALE, type OceanPalette } from './themes3d'

import { SEA_LEVEL_METERS } from './oceanCoordinates'
export { SEA_LEVEL_METERS } from './oceanCoordinates'

interface OceanNode { x: number; y: number; z?: number }
export interface OceanLayout {
  centerX: number
  centerZ: number
  width: number
  depth: number
  floorY: number
  relief: number
  nodeMinY: number
  span: number
}

/** Environmental geometry is independent of simulation coordinates and bathymetry. */
export const oceanLayoutFor = (nodes: readonly OceanNode[]): OceanLayout | null => {
  const valid = nodes.filter((node) => [node.x, node.y, node.z ?? 0].every(Number.isFinite))
  if (!valid.length) return null
  const minX = Math.min(...valid.map((node) => node.x)), maxX = Math.max(...valid.map((node) => node.x))
  const minZ = Math.min(...valid.map((node) => node.y)), maxZ = Math.max(...valid.map((node) => node.y))
  const nodeMinY = Math.min(SEA_LEVEL_METERS * DEPTH_SCALE, ...valid.map((node) => (node.z ?? 0) * DEPTH_SCALE))
  const span = Math.max(maxX - minX, maxZ - minZ, 4000)
  const padding = Math.max(14000, span * 1.2)
  const relief = SEABED_RELIEF_METERS * DEPTH_SCALE
  return {
    centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
    width: maxX - minX + padding * 2, depth: maxZ - minZ + padding * 2,
    floorY: SEABED_LEVEL_METERS * DEPTH_SCALE, relief, nodeMinY, span,
  }
}

export const oceanLayoutNeedsRefresh = (previous: OceanLayout | null, next: OceanLayout | null): boolean => {
  if (!previous || !next) return previous !== next
  const tolerance = Math.max(180, previous.span * 0.08)
  return Math.max(Math.abs(previous.centerX - next.centerX), Math.abs(previous.centerZ - next.centerZ),
    Math.abs(previous.width - next.width), Math.abs(previous.depth - next.depth), Math.abs(previous.floorY - next.floorY)) > tolerance
}

export const seabedHeightAt = (x: number, z: number, layout: OceanLayout): number => {
  return layout.floorY + (seabedElevationMeters(x, z) - SEABED_LEVEL_METERS) * DEPTH_SCALE
}

const makeSedimentTexture = (scene: Scene): RawTexture => {
  const size = 512, pixels = new Uint8Array(size * size * 4)
  let seed = 15731
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      const grain = (seed >>> 24) / 255
      const ripple = Math.sin(z * 0.58 + Math.sin(x * 0.1) * 1.3) * 0.035
      const shade = Math.round((0.8 + grain * 0.15 + ripple) * 255)
      const index = (z * size + x) * 4
      const patch = Math.sin(x * 0.045) * Math.cos(z * 0.039) * 0.5 + 0.5
      const caustic = Math.pow(Math.max(0, 1 - Math.abs(Math.sin(x * 0.11 + Math.sin(z * 0.073) * 2) + Math.cos(z * 0.14 - x * 0.06)) * 0.65), 14) * 12
      pixels[index] = Math.min(255, shade * (0.88 + patch * 0.1) + caustic)
      pixels[index + 1] = Math.min(255, shade * (0.91 + patch * 0.07) + caustic)
      pixels[index + 2] = Math.min(255, shade * (0.81 + patch * 0.12) + caustic); pixels[index + 3] = 255
    }
  }
  const texture = RawTexture.CreateRGBATexture(pixels, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE)
  texture.name = 'ocean-sediment-grain'
  texture.wrapU = Texture.WRAP_ADDRESSMODE; texture.wrapV = Texture.WRAP_ADDRESSMODE
  return texture
}

/** Geometry is built on stable bounds; frame only updates uniforms, sky position and haze. */
export const createOceanEnvironment = (scene: Scene, palette: OceanPalette) => {
  let layout: OceanLayout | null = null
  let meshes: Mesh[] = []
  let sky: Mesh | null = null
  let enabled = true
  let disposed = false
  let ambientSeconds = 0
  const underwaterEffects = createUnderwaterEffects(scene, palette, SEA_LEVEL_METERS * DEPTH_SCALE)
  const originalFog = { mode: scene.fogMode, color: scene.fogColor.clone(), start: scene.fogStart, end: scene.fogEnd, density: scene.fogDensity }
  const sediment = makeSedimentTexture(scene)
  const bedMaterial = new PBRMaterial('ocean-seabed-material', scene)
  bedMaterial.albedoColor = Color3.White(); bedMaterial.albedoTexture = sediment
  bedMaterial.emissiveColor = palette.seabed.scale(0.08); bedMaterial.emissiveTexture = sediment
  bedMaterial.maxSimultaneousLights = 6; bedMaterial.metallic = 0; bedMaterial.roughness = 0.96
  const rockMaterial = new PBRMaterial('ocean-rock-material', scene)
  rockMaterial.albedoColor = palette.rock.clone(); rockMaterial.emissiveColor = palette.rock.scale(0.06); rockMaterial.maxSimultaneousLights = 6; rockMaterial.metallic = 0; rockMaterial.roughness = 0.93
  const waterMaterial = new ShaderMaterial('ocean-surface-material', scene, { vertexSource: OCEAN_VERTEX, fragmentSource: WATER_FRAGMENT }, {
    attributes: ['position'], uniforms: ['worldViewProjection', 'world', 'cameraPosition', 'waterColor', 'glintColor', 'oceanCenter', 'oceanSize', 'clock'], needAlphaBlending: true,
  })
  waterMaterial.backFaceCulling = false; waterMaterial.disableDepthWrite = true
  waterMaterial.setColor3('waterColor', palette.water).setColor3('glintColor', palette.glint).setFloat('clock', 0)
  waterMaterial.setVector3('cameraPosition', Vector3.Zero())

  const vegetationMaterial = new PBRMaterial('ocean-seagrass-material', scene)
  vegetationMaterial.albedoColor = palette.vegetation.clone(); vegetationMaterial.maxSimultaneousLights = 6; vegetationMaterial.roughness = 0.9; vegetationMaterial.metallic = 0
  vegetationMaterial.emissiveColor = palette.vegetation.scale(0.15); vegetationMaterial.backFaceCulling = false
  const coralMaterial = new PBRMaterial('ocean-coral-material', scene)
  coralMaterial.albedoColor = palette.coral.clone(); coralMaterial.maxSimultaneousLights = 6; coralMaterial.roughness = 0.95; coralMaterial.metallic = 0
  const skyMaterial = new ShaderMaterial('ocean-daylight-sky-material', scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, {
    attributes: ['position'], uniforms: ['worldViewProjection', 'world', 'zenithColor', 'horizonColor', 'sunColor', 'hazeColor', 'underwater', 'clock'],
  })
  skyMaterial.backFaceCulling = false; skyMaterial.disableDepthWrite = true
  skyMaterial.setColor3('zenithColor', palette.skyZenith).setColor3('horizonColor', palette.skyHorizon)
    .setColor3('sunColor', palette.sunlight).setColor3('hazeColor', palette.haze).setFloat('underwater', 1).setFloat('clock', 0)
  const fillLight = new HemisphericLight('ocean-daylight-fill', Vector3.Up(), scene)
  fillLight.diffuse = palette.skyHorizon.clone(); fillLight.groundColor = palette.haze.scale(0.65); fillLight.intensity = 0.35
  const sunLight = new DirectionalLight('ocean-sunlight', new Vector3(0.42, -0.76, -0.49).normalize(), scene)
  sunLight.diffuse = palette.sunlight.clone(); sunLight.intensity = 0.38

  fillLight.setEnabled(false); sunLight.setEnabled(false)

  const restoreFog = () => {
    scene.fogMode = originalFog.mode; scene.fogColor.copyFrom(originalFog.color)
    scene.fogStart = originalFog.start; scene.fogEnd = originalFog.end; scene.fogDensity = originalFog.density
  }
  const applyEnabled = () => {
    underwaterEffects.setEnabled(enabled && layout !== null)
    for (const mesh of meshes) mesh.setEnabled(enabled)
    fillLight.setEnabled(enabled && layout !== null); sunLight.setEnabled(enabled && layout !== null)
    if (!enabled || !layout) restoreFog()
  }
  const disposeGeometry = () => { underwaterEffects.clear(); for (const mesh of meshes) mesh.dispose(); meshes = []; sky = null }
  const own = (mesh: Mesh) => {
    mesh.isPickable = false; mesh.metadata = { oceanEnvironment: true }; mesh.freezeWorldMatrix(); meshes.push(mesh)
    return mesh
  }

  const sync = (nodes: readonly OceanNode[]): boolean => {
    if (disposed) return false
    const next = oceanLayoutFor(nodes)
    if (!oceanLayoutNeedsRefresh(layout, next)) return false
    disposeGeometry(); layout = next
    if (!layout) { applyEnabled(); return true }
    // Preserve the original 192-cell local detail, then extend with a coarse
    // outer band. Close cameras looking toward the seabed must not look past
    // the old 14 km edge into empty sky. No overlapping terrain/depth fighting.
    const localDivisions = 192, outerDivisions = 32, divisions = localDivisions + outerDivisions * 2
    const positions: number[] = [], indices: number[] = [], uvs: number[] = [], normals: number[] = []
    const terrainCoordinate = (index: number, center: number, size: number) => {
      const inner = size / 2, outer = Math.max(200000, inner + 60000)
      if (index < outerDivisions) return center - outer + (outer-inner) * index / outerDivisions
      if (index <= outerDivisions+localDivisions) return center - inner + size * (index-outerDivisions) / localDivisions
      return center + inner + (outer-inner) * (index-outerDivisions-localDivisions) / outerDivisions
    }
    for (let row = 0; row <= divisions; row++) {
      for (let col = 0; col <= divisions; col++) {
        const x = terrainCoordinate(col, layout.centerX, layout.width)
        const z = terrainCoordinate(row, layout.centerZ, layout.depth)
        positions.push(x, seabedHeightAt(x, z, layout), z)
        uvs.push(x / 1800, z / 1800)
        if (row < divisions && col < divisions) {
          const index = row * (divisions + 1) + col
          // Babylon's default left-handed winding must face +Y, like CreateGround.
          indices.push(index, index + 1, index + divisions + 1, index + 1, index + divisions + 2, index + divisions + 1)
        }
      }
    }
    VertexData.ComputeNormals(positions, indices, normals)
    const colors: number[] = []
    for (let index = 0; index < positions.length; index += 3) {
      const slope = 1 - normals[index + 1]!
      const rockMix = Math.min(0.85, slope * 3)
      const color = Color3.Lerp(palette.seabed, palette.rock, rockMix)
      // Broad sediment basins contrast with exposed rock on steep slopes.
      const shade = 0.88 + Math.min(0.16, Math.max(0, (positions[index + 1]! - layout.floorY) / layout.relief) * 0.16)
      colors.push(color.r * shade, color.g * shade, color.b * shade, 1)
    }
    const data = new VertexData(); data.colors = colors; data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs
    const bed = new Mesh('ocean-seabed', scene); data.applyToMesh(bed); bed.material = bedMaterial; own(bed)
    underwaterEffects.syncBed(bed)
    let seed = 49391
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296 }
    const rocks: Mesh[] = []
    for (let index = 0; index < 72; index++) {
      const angle = random() * Math.PI * 2
      const patchSpan = index % 3 === 0 ? layout.width * 0.78 : layout.span * 1.65
      const x = layout.centerX + (random() - 0.5) * patchSpan
      const z = layout.centerZ + (random() - 0.5) * patchSpan
      const rock = MeshBuilder.CreateIcoSphere(`ocean-rock-${index}`, { radius: 1, subdivisions: 2, flat: false }, scene)
      const size = 20 + random() * 125
      rock.position.set(x, seabedHeightAt(x, z, layout) + size * 0.12, z)
      rock.scaling.set(size * (1.1 + random()), size * (0.4 + random() * 0.4), size)
      rock.rotation.set(random() * 0.4, angle, random() * 0.25); rock.material = rockMaterial
      rocks.push(rock)
    }
    const rockField = Mesh.MergeMeshes(rocks, true, true, undefined, false, false)!
    rockField.name = 'ocean-rock-field'; own(rockField)
    const grass: Mesh[] = [], coral: Mesh[] = []
    for (let patch = 0; patch < 100; patch++) {
      const patchSpan = patch % 4 === 0 ? layout.width * 0.8 : layout.span * 1.6
      const x = layout.centerX + (random() - 0.5) * patchSpan
      const z = layout.centerZ + (random() - 0.5) * patchSpan
      for (let blade = 0; blade < 5; blade++) {
        const bx = x + (random() - 0.5) * 110, bz = z + (random() - 0.5) * 110
        const height = 25 + random() * 65
        const plant = MeshBuilder.CreateGround('seagrass-blade', { width: 5 + random() * 8, height }, scene)
        plant.rotation.set(Math.PI / 2 - 0.25, random() * Math.PI, random() * 0.3)
        plant.position.set(bx, seabedHeightAt(bx, bz, layout) + height * 0.44, bz)
        plant.material = vegetationMaterial; grass.push(plant)
      }
      if (patch % 4 === 0) {
        for (let branch = 0; branch < 4; branch++) {
          const height = 30 + random() * 45
          const twig = MeshBuilder.CreateCylinder('coral-branch', { height, diameterTop: 3, diameterBottom: 12, tessellation: 5 }, scene)
          twig.position.set(x + branch * 9, seabedHeightAt(x, z, layout) + height * 0.4, z + branch * 5)
          twig.rotation.z = (random() - 0.5) * 0.8; twig.material = coralMaterial; coral.push(twig)
        }
      }
    }
    const grassField = Mesh.MergeMeshes(grass, true, true)!
    grassField.name = 'ocean-seagrass-field'; own(grassField)
    const coralField = Mesh.MergeMeshes(coral, true, true)!
    coralField.name = 'ocean-coral-field'; own(coralField)
    const waterWidth = Math.max(600000, layout.width * 2), waterDepth = Math.max(600000, layout.depth * 2)
    const surface = MeshBuilder.CreateGround('ocean-surface', { width: waterWidth, height: waterDepth, subdivisions: 1 }, scene)
    surface.position.set(layout.centerX, SEA_LEVEL_METERS * DEPTH_SCALE, layout.centerZ); surface.material = waterMaterial; own(surface)
    waterMaterial.setVector3('oceanCenter', new Vector3(layout.centerX, SEA_LEVEL_METERS * DEPTH_SCALE, layout.centerZ))
    waterMaterial.setVector3('oceanSize', new Vector3(waterWidth / 2, waterDepth / 2, layout.span))
    sky = MeshBuilder.CreateSphere('ocean-daylight-sky', { diameter: 300000, segments: 16 }, scene)
    sky.material = skyMaterial; own(sky); sky.unfreezeWorldMatrix()
    sky.alwaysSelectAsActiveMesh = true
    applyEnabled()
    return true
  }
  const frame = (camera: ArcRotateCamera, _replayTimeSeconds: number) => {
    if (disposed || !enabled || !layout) return
    ambientSeconds += Math.min(0.05, Math.max(0, scene.getEngine().getDeltaTime() / 1000 || 0))
    underwaterEffects.frame(camera, ambientSeconds)
    waterMaterial.setVector3('cameraPosition', camera.position)
    waterMaterial.setFloat('clock', ambientSeconds)
    if (sky) sky.position.copyFrom(camera.position)
    skyMaterial.setFloat('clock', ambientSeconds)
    skyMaterial.setFloat('underwater', camera.position.y < SEA_LEVEL_METERS * DEPTH_SCALE ? 1 : 0)
    scene.fogMode = Scene.FOGMODE_LINEAR; scene.fogColor.copyFrom(palette.haze)
    scene.fogStart = Math.max(30000, camera.radius * 1.5)
    scene.fogEnd = Math.max(140000, camera.radius * 6, layout.span * 8)
  }
  return {
    sync, frame,
    setEnabled: (value: boolean) => { enabled = value; applyEnabled() },
    getLayout: () => layout,
    dispose: () => {
      if (disposed) return
      disposed = true; disposeGeometry(); restoreFog(); sediment.dispose()
      bedMaterial.dispose(); rockMaterial.dispose(); waterMaterial.dispose()
      vegetationMaterial.dispose(); coralMaterial.dispose(); skyMaterial.dispose(); fillLight.dispose(); sunLight.dispose(); underwaterEffects.dispose()
    },
  }
}

export type OceanEnvironment = ReturnType<typeof createOceanEnvironment>
