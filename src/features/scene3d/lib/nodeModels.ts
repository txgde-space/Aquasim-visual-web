import { Mesh, MeshBuilder, PBRMaterial, Quaternion, Vector3, type Scene, type TransformNode } from '@babylonjs/core'
import { NODE_MODEL_DIMENSIONS, type NodeModelType } from '@/shared/nodeModel'
import { bottomCenter } from '@/shared/modelAnchor'
import type { NodeModelPalette } from './themes3d'

type Finish = keyof NodeModelPalette
type Point = readonly [number, number, number]
type AxialProfile = readonly (readonly [number, number])[]
interface ModelGeometry { base: Mesh; details: Mesh[] }

const SURFACES: Record<Finish, { metallic: number; roughness: number; glow?: number }> = {
  yellow: { metallic: 0.12, roughness: 0.42 },
  yellowLight: { metallic: 0.08, roughness: 0.5 },
  orange: { metallic: 0.12, roughness: 0.45 },
  white: { metallic: 0.12, roughness: 0.52 },
  steel: { metallic: 0.68, roughness: 0.34 },
  darkMetal: { metallic: 0.6, roughness: 0.44 },
  rubber: { metallic: 0, roughness: 0.85 },
  glass: { metallic: 0.08, roughness: 0.13 },
  deck: { metallic: 0.18, roughness: 0.76 },
  solar: { metallic: 0.25, roughness: 0.22 },
  lens: { metallic: 0.05, roughness: 0.12 },
  lamp: { metallic: 0, roughness: 0.22, glow: 0.12 },
}

/** One private material set per node. Static parts are batched by finish after assembly. */
const assembly = (scene: Scene, nodeId: number, root: TransformNode, palette: NodeModelPalette) => {
  const parts: Mesh[] = []
  const materials = new Map<Finish, PBRMaterial>()
  const name = (part: string) => `node-${nodeId}-${part}`
  const add = (mesh: Mesh, finish: Finish, position: Point = [0, 0, 0]): Mesh => {
    let material = materials.get(finish)
    if (!material) {
      const surface = SURFACES[finish]
      material = new PBRMaterial(name(`model-${finish}`), scene)
      material.albedoColor = palette[finish].clone()
      material.metallic = surface.metallic
      material.roughness = surface.roughness
      if (surface.glow) material.emissiveColor = palette[finish].scale(surface.glow)
      materials.set(finish, material)
    }
    mesh.material = material
    mesh.parent = root
    mesh.position.set(...position)
    mesh.metadata = { nodeId }
    parts.push(mesh)
    return mesh
  }
  const box = (part: string, size: Point, position: Point, finish: Finish) =>
    add(MeshBuilder.CreateBox(name(part), { width: size[0], height: size[1], depth: size[2] }, scene), finish, position)
  const cylinder = (part: string, diameter: number, height: number, position: Point, finish: Finish, axis: 'x' | 'y' | 'z' = 'y') => {
    const mesh = add(MeshBuilder.CreateCylinder(name(part), { diameter, height, tessellation: 32 }, scene), finish, position)
    if (axis === 'x') mesh.rotation.z = -Math.PI / 2
    if (axis === 'z') mesh.rotation.x = Math.PI / 2
    return mesh
  }
  const sphere = (part: string, diameter: number, position: Point, finish: Finish, scale: Point = [1, 1, 1]) => {
    const mesh = add(MeshBuilder.CreateSphere(name(part), { diameter, segments: 24 }, scene), finish, position)
    mesh.scaling.set(...scale)
    return mesh
  }
  const torus = (part: string, diameter: number, thickness: number, position: Point, finish: Finish, axis: 'x' | 'y' | 'z' = 'y') => {
    const mesh = add(MeshBuilder.CreateTorus(name(part), { diameter, thickness, tessellation: 32 }, scene), finish, position)
    if (axis === 'x') mesh.rotation.z = -Math.PI / 2
    if (axis === 'z') mesh.rotation.x = Math.PI / 2
    return mesh
  }
  const tube = (part: string, path: readonly Point[], radius: number, finish: Finish) =>
    add(MeshBuilder.CreateTube(name(part), { path: path.map((p) => new Vector3(...p)), radius, tessellation: 8, cap: Mesh.CAP_ALL }, scene), finish)
  const rod = (part: string, start: Point, end: Point, radius: number, finish: Finish) => {
    const a = new Vector3(...start), b = new Vector3(...end)
    const mesh = cylinder(part, radius * 2, Vector3.Distance(a, b), a.add(b).scale(0.5).asArray() as [number, number, number], finish)
    mesh.rotationQuaternion = Quaternion.Identity()
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), b.subtract(a).normalize(), mesh.rotationQuaternion)
    return mesh
  }
  const lathe = (part: string, profile: AxialProfile, finish: Finish, axis: 'x' | 'y' = 'y', position: Point = [0, 0, 0]) => {
    const first = profile[0], last = profile[profile.length - 1]
    const closedProfile = first[0] === last[0] && first[1] === last[1]
    const mesh = add(MeshBuilder.CreateLathe(name(part), {
      shape: profile.map(([axial, radius]) => new Vector3(radius, axial, 0)), tessellation: 64,
      cap: closedProfile ? Mesh.NO_CAP : Mesh.CAP_ALL,
    }, scene), finish, position)
    if (axis === 'x') mesh.rotation.z = -Math.PI / 2
    return mesh
  }
  const finish = (base: Mesh): ModelGeometry => {
    const batches = new Map<PBRMaterial, Mesh[]>()
    for (const part of parts) {
      const material = part.material as PBRMaterial
      const batch = batches.get(material) ?? []
      batch.push(part)
      batches.set(material, batch)
    }
    const meshes: Mesh[] = []
    let mergedBase = base
    for (const [material, batch] of batches) {
      const containsBase = batch.includes(base)
      // Roots are still at the origin here, so merging bakes only equipment-local geometry.
      const merged = batch.length === 1 ? batch[0] : Mesh.MergeMeshes(batch, true, true, undefined, false, false)!
      merged.name = `${material.name}-mesh`
      merged.parent = root
      merged.metadata = { nodeId }
      meshes.push(merged)
      if (containsBase) mergedBase = merged
    }
    return { base: mergedBase, details: meshes.filter((mesh) => mesh !== mergedBase) }
  }
  return { name, add, box, cylinder, sphere, torus, tube, rod, lathe, finish }
}

type Assembly = ReturnType<typeof assembly>

const addDuctedPropeller = (a: Assembly, part: string, center: Point, diameter: number, length: number, axis: 'x' | 'y' = 'x') => {
  const outer = diameter / 2, inner = outer - 4
  a.lathe(`${part}-duct`, [[-length / 2, outer - 2], [length / 2, outer], [length / 2, inner], [-length / 2, inner - 2], [-length / 2, outer - 2]], 'darkMetal', axis, center)
  a.cylinder(`${part}-hub`, diameter * 0.2, length * 0.65, center, 'steel', axis)
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI * 2 / 3
    const half = diameter * 0.2
    const position: Point = axis === 'x'
      ? [center[0], center[1] + Math.cos(angle) * half, center[2] + Math.sin(angle) * half]
      : [center[0] + Math.cos(angle) * half, center[1], center[2] + Math.sin(angle) * half]
    const mesh = a.box(`${part}-blade-${blade}`, axis === 'x' ? [4, diameter * 0.38, 9] : [diameter * 0.38, 4, 9], position, 'steel')
    if (axis === 'x') mesh.rotation.x = angle
    else mesh.rotation.y = -angle
  }
}

const buildAuv = (a: Assembly, scene: Scene): ModelGeometry => {
  const body = a.lathe('auv-pressure-hull', [[-125, 26], [-110, 34], [-80, 36], [85, 36], [125, 30]], 'yellow', 'x')
  a.lathe('auv-nose-fairing', [[125, 30], [136, 28], [146, 22], [152, 14], [155, 0]], 'rubber', 'x')
  a.lathe('auv-tail-cone', [[-195, 10], [-178, 17], [-151, 23], [-125, 26]], 'darkMetal', 'x')
  for (const x of [-109, 66]) a.torus(`auv-shell-seam-${x}`, 72, 1.7, [x, 0, 0], 'darkMetal', 'x')
  a.torus('auv-forward-flange', 60, 3, [125, 0, 0], 'steel', 'x')
  a.box('auv-service-hatch', [74, 2, 18], [12, 35, 0], 'darkMetal')
  a.box('auv-navigation-fin', [35, 15, 5], [28, 43, 0], 'rubber')
  a.cylinder('auv-antenna', 3, 22, [15, 58, 0], 'darkMetal')
  for (let index = 0; index < 4; index++) {
    const fin = a.add(MeshBuilder.ExtrudeShape(a.name(`auv-tail-fin-${index}`), {
      shape: [new Vector3(0, 18, 0), new Vector3(-44, 69, 0), new Vector3(-72, 69, 0), new Vector3(-57, 18, 0)],
      path: [new Vector3(0, 0, -2), new Vector3(0, 0, 2)], closeShape: true, cap: Mesh.CAP_ALL,
    }, scene), 'yellow', [-111, 0, 0])
    fin.rotation.x = index * Math.PI / 2
  }
  a.cylinder('auv-tail-shaft', 12, 25, [-202, 0, 0], 'steel', 'x')
  addDuctedPropeller(a, 'auv-propeller', [-220, 0, 0], 61, 26)
  a.cylinder('auv-forward-instrument-port', 14, 8, [153, 0, 0], 'darkMetal', 'x')
  a.cylinder('auv-forward-optical-window', 10, 2, [158, 0, 0], 'lens', 'x')
  for (const x of [-100, -50, 0, 50, 95]) {
    for (const z of [-8, 8]) a.cylinder(`auv-hatch-fastener-${x}-${z}`, 2.5, 1.2, [x, 36.2, z], 'steel')
  }
  for (const z of [-34.5, 34.5]) {
    a.box(`auv-side-scan-array-${z}`, [88, 11, 2], [-30, -4, z], 'rubber')
    for (let i = 0; i < 9; i++) a.box(`auv-array-element-${z}-${i}`, [1, 8, 0.5], [-66 + i * 9, -4, z * 1.015], 'darkMetal')
  }
  a.box('auv-identification', [24, 1.1, 14], [-68, 36, 0], 'white')
  return a.finish(body)
}

const buildRov = (a: Assembly): ModelGeometry => {
  const body = a.box('rov-port-buoyancy', [234, 36, 56], [-8, 90, -62], 'yellow')
  a.box('rov-starboard-buoyancy', [234, 36, 56], [-8, 90, 62], 'yellow')
  for (const z of [-62, 62]) {
    a.box(`rov-float-end-${z}`, [15, 36.8, 56.8], [-118, 90, z], 'yellowLight')
    for (const x of [-85, 65]) a.box(`rov-float-strap-${x}-${z}`, [6, 39, 59], [x, 90, z], 'darkMetal')
  }
  for (const x of [-124, 124]) {
    for (const z of [-87, 87]) a.rod(`rov-post-${x}-${z}`, [x, -74, z], [x, 75, z], 4, 'steel')
    for (const y of [-74, 74]) a.rod(`rov-crossbar-${x}-${y}`, [x, y, -91], [x, y, 91], 4, 'steel')
  }
  for (const z of [-87, 87]) {
    for (const y of [-74, 74]) a.rod(`rov-side-rail-${y}-${z}`, [-128, y, z], [128, y, z], 4, 'steel')
    a.tube(`rov-skid-${z}`, [[-155, -88, z], [-140, -101, z], [134, -101, z], [155, -88, z]], 6, 'darkMetal')
    a.rod(`rov-skid-strut-${z}`, [-110, -74, z], [-110, -99, z], 4, 'steel')
  }
  a.cylinder('rov-electronics-pressure-vessel', 63, 179, [-8, 8, 0], 'steel', 'x')
  for (const x of [-101, 85]) a.cylinder(`rov-vessel-end-${x}`, 66, 9, [x, 8, 0], 'darkMetal', 'x')
  for (const x of [-65, 51]) a.torus(`rov-vessel-clamp-${x}`, 66, 5, [x, 8, 0], 'darkMetal', 'x')
  for (const z of [-59, 59]) a.cylinder(`rov-battery-pod-${z}`, 37, 148, [-20, 5, z], 'darkMetal', 'x')
  for (const x of [-85, 85]) {
    for (const z of [-116, 116]) addDuctedPropeller(a, `rov-thruster-${x}-${z}`, [x, -5, z], 56, 40)
  }
  addDuctedPropeller(a, 'rov-vertical-thruster', [15, 60, 0], 58, 28, 'y')
  a.cylinder('rov-camera-housing', 33, 24, [105, 31, 0], 'darkMetal', 'x')
  a.cylinder('rov-camera-window', 25, 2, [118, 31, 0], 'glass', 'x')
  a.cylinder('rov-camera-lens', 12, 3, [120, 31, 0], 'lens', 'x')
  for (const z of [-46, 46]) {
    a.cylinder(`rov-light-housing-${z}`, 19, 23, [99, 34, z], 'steel', 'x')
    a.cylinder(`rov-light-lens-${z}`, 15, 2, [112, 34, z], 'lamp', 'x')
  }
  a.cylinder('rov-arm-shoulder', 26, 26, [101, -37, 26], 'darkMetal', 'z')
  a.rod('rov-arm-upper', [102, -37, 26], [169, -65, 26], 7, 'steel')
  a.cylinder('rov-arm-elbow', 24, 22, [169, -65, 26], 'darkMetal', 'z')
  a.rod('rov-arm-forearm', [170, -64, 26], [224, -35, 26], 6, 'steel')
  a.cylinder('rov-arm-wrist', 17, 18, [226, -35, 26], 'darkMetal', 'x')
  for (const side of [-1, 1]) a.tube(`rov-gripper-${side}`, [[232, -35, 26 + side * 6], [253, -35, 26 + side * 18], [266, -35, 26 + side * 10]], 3, 'steel')
  a.tube('rov-arm-hydraulic-line', [[89, -25, 42], [132, -34, 42], [164, -54, 42], [215, -26, 42]], 2.5, 'rubber')
  a.tube('rov-electrical-harness', [[-101, 30, 0], [-121, 40, 0], [-115, 62, 34], [-69, 73, 34]], 3, 'rubber')
  for (const x of [-101, 85]) for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    a.cylinder(`rov-flange-bolt-${x}-${i}`, 3.2, 3, [x + 5, 8 + Math.cos(angle) * 27, Math.sin(angle) * 27], 'steel', 'x')
  }
  for (const z of [-87, 87]) for (const x of [-105, 0, 105]) {
    a.box(`rov-frame-junction-${x}-${z}`, [14, 16, 11], [x, 73, z], 'darkMetal')
    a.cylinder(`rov-junction-bolt-${x}-${z}`, 4, 3, [x, 83, z], 'steel')
  }
  a.box('rov-junction-box', [42, 28, 33], [-68, 51, 0], 'darkMetal')
  for (const x of [-84, -70, -56]) a.cylinder(`rov-cable-connector-${x}`, 6, 12, [x, 72, 0], 'rubber')
  a.torus('rov-lifting-eye' , 26, 4, [-45, 118, 0], 'steel', 'z')
  return a.finish(body)
}

const buildVessel = (a: Assembly, scene: Scene): ModelGeometry => {
  const stations = [
    { x: -220, w: 62, top: 42, bottom: -28 }, { x: -160, w: 75, top: 45, bottom: -38 },
    { x: 35, w: 72, top: 49, bottom: -34 }, { x: 145, w: 49, top: 61, bottom: -18 },
    { x: 226, w: 2, top: 83, bottom: 9 },
  ]
  const hull = a.add(MeshBuilder.CreateRibbon(a.name('vessel-hull'), {
    pathArray: stations.map(({ x, w, top, bottom }) => [
      new Vector3(x, top, -w), new Vector3(x, top, w), new Vector3(x, bottom + 13, w * 0.82),
      new Vector3(x, bottom, w * 0.42), new Vector3(x, bottom, -w * 0.42), new Vector3(x, bottom + 13, -w * 0.82),
    ]), closePath: true, sideOrientation: Mesh.DOUBLESIDE,
  }, scene), 'white')
  a.box('vessel-transom', [3, 62, 121], [-220, 11, 0], 'white')
  a.add(MeshBuilder.CreateRibbon(a.name('vessel-working-deck'), {
    pathArray: [-1, 1].map((side) => stations.map(({ x, w, top }) => new Vector3(x, top + 1, side * (w - 1)))), sideOrientation: Mesh.DOUBLESIDE,
  }, scene), 'deck')
  for (const side of [-1, 1]) {
    a.tube(`vessel-rubbing-strake-${side}`, stations.map(({ x, w, top }) => [x, top - 12, side * w] as Point), 3.5, 'rubber')
    const rail = [
      [-202, 44, side * 66], [-132, 47, side * 73], [-52, 49, side * 73],
      [28, 51, side * 70], [112, 59, side * 55], [174, 71, side * 32],
    ] as Point[]
    rail.forEach(([x, y, z], i) => a.rod(`vessel-stanchion-${side}-${i}`, [x, y, z], [x, y + 25, z], 1.8, 'steel'))
    for (const height of [13, 26]) a.tube(`vessel-guardrail-${side}-${height}`, rail.map(([x, y, z]) => [x, y + height, z] as Point), 1.6, 'steel')
  }
  a.tube('vessel-bow-rail', [[174, 97, -32], [221, 109, 0], [174, 97, 32]], 1.6, 'steel')
  a.box('vessel-deckhouse', [139, 72, 91], [-101, 84, 0], 'white')
  a.box('vessel-cabin-roof', [150, 6, 101], [-101, 123, 0], 'white')
  a.box('vessel-wheelhouse', [106, 35, 79], [-91, 143, 0], 'white')
  a.box('vessel-wheelhouse-roof', [119, 5, 89], [-91, 163, 0], 'white')
  for (const side of [-1, 1]) {
    for (const x of [-148, -106, -64]) a.box(`vessel-cabin-window-${side}-${x}`, [28, 23, 2], [x, 99, side * 46], 'glass')
    for (const x of [-118, -76]) a.box(`vessel-bridge-window-${side}-${x}`, [32, 22, 2], [x, 144, side * 40], 'glass')
    a.box(`vessel-side-door-${side}`, [22, 48, 2], [-169, 77, side * 46], 'deck')
    a.rod(`vessel-door-handle-${side}`, [-165, 78, side * 48], [-165, 85, side * 48], 1.5, 'steel')
  }
  a.box('vessel-forward-windows', [2, 22, 66], [-37, 145, 0], 'glass')
  a.box('vessel-front-window-divider', [3, 24, 3], [-35, 145, 0], 'white')
  a.box('vessel-deck-hatch', [78, 6, 63], [55, 55, 0], 'steel')
  a.cylinder('vessel-winch-drum', 27, 36, [125, 78, 0], 'darkMetal', 'z')
  for (const z of [-24, 24]) a.box(`vessel-winch-mount-${z}`, [27, 26, 6], [125, 68, z], 'steel')
  a.rod('vessel-mast', [-98, 166, 0], [-98, 247, 0], 3, 'steel')
  a.rod('vessel-mast-brace', [-127, 166, 0], [-98, 215, 0], 2, 'steel')
  a.box('vessel-radar-scanner', [64, 5, 9], [-98, 235, 0], 'white')
  a.cylinder('vessel-mast-lamp', 8, 11, [-98, 252, 0], 'lamp')
  a.rod('vessel-radio-antenna', [-48, 166, 22], [-48, 221, 22], 1.2, 'darkMetal')
  for (const side of [-1, 1]) {
    a.cylinder(`vessel-bollard-${side}`, 8, 15, [-194, 52, side * 42], 'darkMetal')
    a.cylinder(`vessel-fender-${side}`, 14, 52, [-58, 17, side * 78], 'rubber')
  }
  // Boarding ladder, vents, deck fittings and an aft propulsion unit.
  for (let i = 0; i < 6; i++) a.rod(`vessel-ladder-rung-${i}`, [-171, 56 + i * 10, -49], [-148, 56 + i * 10, -49], 1, 'steel')
  for (const x of [-171, -148]) a.rod(`vessel-ladder-side-${x}`, [x, 50, -49], [x, 114, -49], 1.4, 'steel')
  for (let i = 0; i < 7; i++) a.box(`vessel-vent-louvre-${i}`, [25, 1.5, 1.8], [-96, 66 + i * 3, 46.5], 'darkMetal')
  for (const z of [-27, 27]) {
    a.torus(`vessel-lifebuoy-${z}`, 20, 5, [-172, 99, z], 'orange', 'x')
    a.rod(`vessel-drive-shaft-${z}`, [-194, -29, z], [-222, -29, z], 2.2, 'steel')
    addDuctedPropeller(a, `vessel-propeller-${z}`, [-224, -29, z], 22, 10)
  }
  return a.finish(hull)
}

const buildBuoy = (a: Assembly): ModelGeometry => {
  const body = a.lathe('buoy-float-shell', [[-65, 0], [-65, 39], [-48, 62], [-8, 78], [26, 76], [43, 46], [43, 0]], 'orange')
  // Match the shell's 32 angular facets and taper. A lower-resolution cylinder cuts
  // through those facets even when its nominal radius is slightly larger.
  const shellRadiusAt = (y: number) => 78 - ((y + 8) * 2 / 34)
  const lower = shellRadiusAt(-5), upper = shellRadiusAt(7)
  a.lathe('buoy-warning-band', [
    [-5, lower + 0.5], [7, upper + 0.5], [7, upper + 0.2],
    [-5, lower + 0.2], [-5, lower + 0.5],
  ], 'yellow')
  a.cylinder('buoy-top-platform', 100, 6, [0, 47, 0], 'darkMetal')
  a.lathe('buoy-ballast-stem', [[-105, 12], [-66, 15]], 'steel')
  a.torus('buoy-mooring-eye', 29, 5, [0, -121, 0], 'steel', 'z')
  for (let index = 0; index < 3; index++) a.torus(`buoy-chain-link-${index}`, 22, 4, [0, -143 - index * 16, 0], 'darkMetal', index % 2 === 0 ? 'x' : 'z')
  for (const x of [-24, 24]) {
    for (const z of [-24, 24]) a.rod(`buoy-lantern-frame-${x}-${z}`, [x, 49, z], [x * 0.64, 161, z * 0.64], 2.5, 'steel')
  }
  for (const y of [78, 128]) {
    const half = y === 78 ? 22 : 18
    a.tube(`buoy-frame-crossbar-${y}`, [[-half, y, -half], [half, y, -half], [half, y, half], [-half, y, half], [-half, y, -half]], 2, 'steel')
  }
  for (const side of [-1, 1]) {
    const frame = a.box(`buoy-solar-frame-${side}`, [74, 4, 57], [0, 91, side * 49], 'steel')
    frame.rotation.x = side * 0.58
    const panel = a.box(`buoy-solar-panel-${side}`, [69, 2, 52], [0, 94, side * 50], 'solar')
    panel.rotation.x = side * 0.58
    for (const x of [-22, 0, 22]) {
      const bus = a.box(`buoy-solar-grid-${side}-${x}`, [0.8, 1, 50], [x, 95.3, side * 50], 'steel')
      bus.rotation.x = side * 0.58
    }
  }
  a.cylinder('buoy-lantern-base', 41, 8, [0, 164, 0], 'darkMetal')
  a.cylinder('buoy-lantern-glass', 26, 24, [0, 180, 0], 'lamp')
  for (const y of [170, 178, 186]) a.torus(`buoy-lantern-ridge-${y}`, 28, 1.2, [0, y, 0], 'lens')
  a.cylinder('buoy-lantern-cap', 38, 5, [0, 195, 0], 'darkMetal')
  a.rod('buoy-antenna', [16, 155, 8], [16, 233, 8], 1.4, 'darkMetal')
  a.torus('buoy-lifting-eye', 15, 3, [-34, 53, 0], 'steel', 'z')
  return a.finish(body)
}

const buildSensor = (a: Assembly): ModelGeometry => {
  const body = a.cylinder('sensor-pressure-canister', 78, 160, [0, -1, 0], 'steel')
  for (const y of [-84, 84]) {
    a.cylinder(`sensor-end-flange-${y}`, 89, 9, [0, y, 0], 'steel')
    a.torus(`sensor-seal-${y}`, 81, 3, [0, y + (y > 0 ? -6 : 6), 0], 'rubber')
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3
      a.cylinder(`sensor-cap-bolt-${y}-${index}`, 5, 4, [Math.cos(angle) * 37, y + 6, Math.sin(angle) * 37], 'darkMetal')
    }
  }
  a.cylinder('sensor-acoustic-head', 45, 43, [0, 112, 0], 'rubber')
  a.sphere('sensor-acoustic-dome', 45, [0, 135, 0], 'rubber', [1, 0.3, 1])
  a.torus('sensor-head-collar', 48, 3, [0, 92, 0], 'darkMetal')
  for (let index = 0; index < 3; index++) {
    const angle = index * Math.PI * 2 / 3
    const x = Math.cos(angle), z = Math.sin(angle)
    a.rod(`sensor-tripod-leg-${index}`, [x * 31, -61, z * 31], [x * 121, -139, z * 121], 5, 'darkMetal')
    a.rod(`sensor-tripod-brace-${index}`, [x * 28, -15, z * 28], [x * 80, -104, z * 80], 3, 'steel')
    a.cylinder(`sensor-tripod-foot-${index}`, 43, 6, [x * 121, -144, z * 121], 'steel')
  }
  a.box('sensor-connector-box', [25, 42, 32], [48, 26, 0], 'darkMetal')
  a.cylinder('sensor-cable-gland', 10, 13, [48, 52, 0], 'steel')
  a.tube('sensor-instrument-cable', [[48, 57, 0], [59, 67, 5], [57, 95, 22], [28, 105, 32], [18, 106, 19]], 2.5, 'rubber')
  a.torus('sensor-handling-eye', 21, 4, [-28, 104, 0], 'steel', 'z')
  a.box('sensor-identification-plate', [31, 28, 1.5], [0, 10, -39], 'white')
  return a.finish(body)
}

/** Bake every equipment model into the same world-metre system as scene assets.
 * The node coordinate is the bottom-centre pivot; never rewrite topology. */
export const buildNodeModel = (scene: Scene, nodeId: number, kind: NodeModelType, root: TransformNode, palette: NodeModelPalette): ModelGeometry => {
  const a = assembly(scene, nodeId, root, palette)
  const model = kind === 'auv' ? buildAuv(a, scene) : kind === 'rov' ? buildRov(a)
    : kind === 'vessel' ? buildVessel(a, scene) : kind === 'buoy' ? buildBuoy(a) : buildSensor(a)
  const meshes = [model.base, ...model.details]
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const mesh of meshes) {
    // A single unmerged part can still have a local transform.
    mesh.bakeCurrentTransformIntoVertices()
    const bounds = mesh.getBoundingInfo().boundingBox
    min.minimizeInPlace(bounds.minimum); max.maximizeInPlace(bounds.maximum)
  }
  const span = max.subtract(min), size = NODE_MODEL_DIMENSIONS[kind]
  const scale = new Vector3(size.length / span.x, size.height / span.y, size.width / span.z)
  const anchor = bottomCenter(min.asArray(), max.asArray(), 1)
  for (const mesh of meshes) {
    mesh.scaling.copyFrom(scale)
    mesh.position.set(-anchor[0] * scale.x, -anchor[1] * scale.y, -anchor[2] * scale.z)
    mesh.bakeCurrentTransformIntoVertices()
  }
  return model
}
