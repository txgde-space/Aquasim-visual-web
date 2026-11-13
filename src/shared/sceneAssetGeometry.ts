import { bottomCenter } from './modelAnchor'
import type { SceneAssetType } from './sceneAssets'

/** Local metres: X forward, Y across, Z up. The two renderers use the same hulls. */
export type AssetPoint = readonly [number, number, number]
export type AssetFinish = 'hull' | 'deck' | 'steel' | 'dark' | 'glass' | 'rust' | 'sand' | 'land' | 'concrete' | 'fish' | 'mark'
export interface AssetPart {
  shape: 'box' | 'ellipsoid' | 'cylinder' | 'prism' | 'terrain' | 'surface'
  at: AssetPoint
  size: AssetPoint
  finish: AssetFinish
  yaw?: number
  axis?: 'x' | 'z'
  outline?: readonly (readonly [number, number])[]
  surface?: readonly AssetPoint[]
  triangles?: readonly number[]
}
export const ASSET_FINISHES: Record<AssetFinish, { color: string; metallic: number; roughness: number }> = {
  hull: { color: '#586773', metallic: 0.5, roughness: 0.5 },
  deck: { color: '#424d50', metallic: 0.28, roughness: 0.75 },
  steel: { color: '#929fa3', metallic: 0.7, roughness: 0.35 },
  dark: { color: '#263138', metallic: 0.25, roughness: 0.65 },
  glass: { color: '#254750', metallic: 0.2, roughness: 0.16 },
  rust: { color: '#79604b', metallic: 0.18, roughness: 0.94 },
  sand: { color: '#c4b58b', metallic: 0, roughness: 0.98 },
  land: { color: '#74846a', metallic: 0, roughness: 1 },
  concrete: { color: '#929b94', metallic: 0, roughness: 0.9 },
  fish: { color: '#799da4', metallic: 0.36, roughness: 0.38 },
  mark: { color: '#d5d2b9', metallic: 0, roughness: 0.75 },
}

const makeParts = (type: SceneAssetType): readonly AssetPart[] => {
  const parts: AssetPart[] = []
  const box = (at: AssetPoint, size: AssetPoint, finish: AssetFinish, yaw = 0) => parts.push({ shape: 'box', at, size, finish, yaw })
  const oval = (at: AssetPoint, size: AssetPoint, finish: AssetFinish) => parts.push({ shape: 'ellipsoid', at, size, finish })
  const cylinder = (at: AssetPoint, size: AssetPoint, finish: AssetFinish, axis: 'x' | 'z' = 'z') => parts.push({ shape: 'cylinder', at, size, finish, axis })
  const prism = (outline: AssetPart['outline'], at: AssetPoint, height: number, finish: AssetFinish) => parts.push({ shape: 'prism', outline, at, size: [1, 1, height], finish })
  const hull = (length: number, width: number, height: number, finish: AssetFinish, at: AssetPoint = [0, 0, 0]) => {
    const l = length / 2, w = width / 2
    prism([[-l, -w * 0.8], [l * 0.36, -w], [l * 0.8, -w * 0.55], [l, 0], [l * 0.8, w * 0.55], [l * 0.36, w], [-l, w * 0.8]], at, height, finish)
  }
  // Smooth elliptical sections with closed noses/tails, rather than stretched spheres.
  const body = (stations: readonly (readonly [number, number, number, number])[], finish: AssetFinish, at: AssetPoint = [0, 0, 0]) => {
    const surface: AssetPoint[] = [], triangles: number[] = [], sides = 48
    for (const [x, w, h, z] of stations) for (let i = 0; i <= sides; i++) {
      const angle = i / sides * Math.PI * 2
      surface.push([x, Math.cos(angle) * w, z + Math.sin(angle) * h])
    }
    for (let row = 0; row < stations.length - 1; row++) for (let i = 0; i < sides; i++) {
      const a = row * (sides + 1) + i, b = a + 1, c = a + sides + 1
      triangles.push(a, c, b, b, c, c + 1)
    }
    parts.push({ shape: 'surface', at, size: [1, 1, 1], finish, surface, triangles,
      outline: [...stations.map(([x, w]) => [x, -w] as const), ...[...stations].reverse().map(([x, w]) => [x, w] as const)] })
  }
  const rail = (start: AssetPoint, end: AssetPoint, diameter = 0.06, finish: AssetFinish = 'steel') => {
    // A general thin 3D strut, shared by both renderers through an oriented surface.
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2]
    const length = Math.hypot(dx, dy, dz), horizontal = Math.hypot(dx, dy)
    const ux = horizontal ? -dy / horizontal : 1, uy = horizontal ? dx / horizontal : 0
    const vx = -dz * uy / length, vy = dz * ux / length, vz = -horizontal / length
    const surface: AssetPoint[] = [], triangles: number[] = []
    for (const point of [start, end]) for (let i = 0; i < 9; i++) {
      const c = Math.cos(i / 8 * Math.PI * 2) * diameter / 2, t = Math.sin(i / 8 * Math.PI * 2) * diameter / 2
      surface.push([point[0] + ux * c + vx * t, point[1] + uy * c + vy * t, point[2] + vz * t])
    }
    for (let i = 0; i < 8; i++) triangles.push(i, i + 9, i + 1, i + 1, i + 9, i + 10)
    parts.push({ shape: 'surface', at: [0, 0, 0], size: [1, 1, 1], finish, surface, triangles,
      outline: [[start[0] - diameter / 2, start[1]], [end[0], end[1] - diameter / 2], [end[0] + diameter / 2, end[1]], [start[0], start[1] + diameter / 2]] })
  }
  if (type === 'submarine') {
    body([[-57.5, 0, 0, 0], [-55, 1.2, 1.2, 0], [-49, 3, 3, 0], [-40, 4.6, 4.8, 0],
      [-28, 5.18, 5.18, 0], [28, 5.18, 5.18, 0], [42, 4.9, 4.9, 0], [50, 3.9, 3.9, 0], [55, 2.4, 2.4, 0], [57.5, 0, 0, 0]], 'dark')
    // Streamlined sail with flush doors, control planes, acoustic panels and masts.
    prism([[-14, -1.4], [-3, -1.8], [1, -1.2], [2.5, 0], [1, 1.2], [-3, 1.8], [-14, 1.4]], [-2, 0, 8], 7, 'hull')
    for (const x of [-13, -9, -5]) cylinder([x, 0, 14], [0.22, 0.22, 6], 'steel')
    cylinder([-6, 0.8, 12.5], [0.45, 0.45, 2.5], 'dark')
    for (const side of [-1, 1]) {
      prism([[-41, side * 1], [-45, side * 11], [-49, side * 11], [-47, side * 1]], [0, 0, 0], 0.45, 'hull')
      prism([[-10, side * 1], [-12, side * 6.2], [-15, side * 6.2], [-15, side * 1]], [0, 0, 8], 0.35, 'hull')
      for (let i = 0; i < 14; i++) box([-25 + i * 4.5, side * 4.97, -0.3], [0.05, 0.08, 1.2], 'hull')
      for (const x of [-34, 22, 30]) box([x, side * 4.45, -2.4], [4, 0.15, 1.2], 'deck')
    }
    box([-45, 0, 0], [7, 0.5, 17], 'hull')
    cylinder([-54, 0, 0], [1, 1, 6], 'steel', 'x')
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7
      rail([-56.5, Math.cos(angle) * 0.6, Math.sin(angle) * 0.6], [-56, Math.cos(angle + .35) * 3.2, Math.sin(angle + .35) * 3.2], .6, 'steel')
    }
    for (const x of [-27, -19, 17, 25]) {
      cylinder([x, 0, 5.18], [1.2, 1.2, 0.08], 'hull')
      box([x, 0, 5.24], [0.6, 0.12, 0.03], 'steel')
    }
  } else if (type === 'warship' || type === 'wreck') {
    const wreck = type === 'wreck', finish = wreck ? 'rust' : 'hull'
    if (wreck) {
      hull(68, 20, 10, finish, [-43, 0, 0])
      hull(77, 18, 9, finish, [40, 3, -1])
      hull(65, 19, 0.7, 'rust', [-43, 0, 5.4])
      hull(74, 17, 0.7, 'rust', [40, 3, 4])
    } else {
      const stations = [[-76, 8.5, -4.5, 5], [-60, 10.5, -5, 5.5], [-20, 10.6, -5, 5.5], [25, 9.8, -4.8, 6], [52, 7, -3.6, 7], [68, 3.6, -1.8, 8.5], [76, 0.12, 1, 9.5]]
      const surface: AssetPoint[] = [], triangles: number[] = []
      for (const [x, w, bottom, top] of stations) surface.push([x!, -w!, top!], [x!, w!, top!], [x!, w! * .76, bottom! + 1.5], [x!, w! * .32, bottom!], [x!, -w! * .32, bottom!], [x!, -w! * .76, bottom! + 1.5], [x!, -w!, top!])
      for (let row = 0; row < stations.length - 1; row++) for (let j = 0; j < 6; j++) {
        const a = row * 7 + j, c = a + 7
        triangles.push(a, c, a + 1, a + 1, c, c + 1)
      }
      // Close transom; the pointed bow converges at the last station.
      for (let j = 1; j < 5; j++) triangles.push(0, j + 1, j)
      const outline = [...stations.map(([x, w]) => [x!, -w!] as const), ...[...stations].reverse().map(([x, w]) => [x!, w!] as const)]
      parts.push({ shape: 'surface', at: [0, 0, 0], size: [152, 21.2, 15], finish, surface, triangles, outline })
      hull(145, 19.8, 0.35, 'deck', [-2, 0, 5.7])
    }
    if (wreck) {
      // Open cargo holds, exposed ribs and a broken, offset superstructure.
      for (const x of [-48, -25, 0, 24]) {
        box([x, 0, 5.9], [17, 13, 0.3], 'dark')
        for (const side of [-1, 1]) box([x, side * 7.2, 8.2], [0.7, 0.7, 6], 'rust')
      }
      box([-59, 2, 9], [21, 13, 8], 'rust', 0.14)
      box([-58, 2, 14], [20, 10, 1.5], 'deck', 0.14)
      box([44, 0, 7], [8, 14, 1], 'rust', -0.3)
      for (const x of [-65, -36, 12, 57]) oval([x, -7, -1], [13, 5, 8], 'rust')
      for (let i = 0; i < 20; i++) {
        const x = -72 + i * 7.2
        for (const side of [-1, 1]) rail([x, side * 8.9, 5.7], [x, side * 8, 8 + Math.sin(i * 2.3)], .16, 'rust')
      }
      for (let i = 0; i < 14; i++) box([-11 + Math.sin(i * 2.3) * 12, Math.cos(i * 1.7) * 13, -3 + i % 3], [2 + i % 4, .1, 1.2], 'rust', i * .7)
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) box([-66 + i * 2.8, side * 6.6, 10.8], [1.7, .1, 1.3], 'dark')
    } else {
      box([-8, 0, 10], [48, 15, 10], 'hull')
      box([9, 0, 17], [20, 13, 5], 'hull')
      for (let i = 0; i < 7; i++) for (const side of [-1, 1]) box([3.5 + i * 2.2, side * 6.55, 18], [1.65, 0.12, 1.15], 'glass')
      box([-18, 0, 17], [9, 8, 9], 'deck')
      box([-2, 0, 25], [3, 3, 15], 'hull')
      box([-2, 0, 33], [2, 15, 0.7], 'steel')
      box([-1, 0, 29], [6, 1, 7], 'hull')
      for (const y of [-5, 5]) box([22, y, 8], [15, 5.8, 2], 'hull')
      cylinder([49, 0, 7], [8, 8, 4], 'hull')
      box([55, 0, 9], [14, 0.7, 0.7], 'dark')
      box([-53, 0, 5.9], [28, 13, 0.2], 'hull')
      for (const y of [-5.5, 5.5]) box([-53, y, 6.1], [24, 0.3, 0.1], 'mark')
      box([-53, 0, 6.2], [0.3, 9, 0.1], 'mark')
      for (const x of [-64, -36, 0, 32, 59]) for (const y of [-8.7, 8.7]) cylinder([x, y, 6.5], [0.5, 0.5, 2.5], 'steel')
      for (const side of [-1, 1]) {
        for (let i = 0; i < 15; i++) {
          const x = -70 + i * 8
          rail([x, side * 9.1, 6], [x, side * 9.1, 7.1], .05)
        }
        for (const z of [6.55, 7.1]) rail([-70, side * 9.1, z], [42, side * 9.1, z], .04)
        for (const x of [-27, -17, -7, 9]) {
          box([x, side * 7.55, 9], [1, .12, 2], 'dark')
          box([x, side * 7.64, 9.45], [.65, .05, .6], 'glass')
        }
        for (let i = 0; i < 9; i++) box([-22 + i * .6, side * 4.1, 21], [.2, .2, 1.3], 'steel')
        // Ventilation grilles and enclosed boat bays.
        for (let i = 0; i < 10; i++) box([-22 + i * .6, side * 7.56, 12], [.25, .08, 2], 'deck')
        oval([-37, side * 6.8, 6.8], [7.5, 2.4, 1.3], 'dark')
        for (let i = 0; i < 4; i++) box([26 + i * 2.3, side * 4.5, 9.1], [1.8, 1.8, .1], 'dark')
      }
      // Radar panels, mast braces, exhaust vents, helicopter landing circle.
      for (const side of [-1, 1]) rail([-6, side * 2, 18], [-2, 0, 32], .18)
      for (let i = 0; i < 12; i++) box([-21 + i * .6, 0, 21.6], [.25, 6, .15], 'dark')
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2, b = (i + 1) / 32 * Math.PI * 2
        rail([-53 + Math.cos(a) * 5, Math.sin(a) * 5, 6.15], [-53 + Math.cos(b) * 5, Math.sin(b) * 5, 6.15], .12, 'mark')
      }

    }
  } else if (type === 'fish') {
    // Individual fish are 0.7–1.1 m, dispersed within a ~23 m school.
    for (let i = 0; i < 26; i++) {
      const x = Math.sin(i * 2.39) * 10, y = Math.cos(i * 1.73) * 6, z = Math.sin(i * 1.23) * 2
      const k = .7 + (i % 5) * .08
      body([[-.5 * k, 0, 0, 0], [-.28 * k, .07 * k, .16 * k, 0], [.05 * k, .1 * k, .18 * k, 0], [.35 * k, .05 * k, .1 * k, 0], [.5 * k, 0, 0, 0]], i % 3 ? 'fish' : 'steel', [x, y, z])
      // Vertical caudal fin, dorsal fin and paired pectoral fins.
      parts.push({ shape: 'surface', at: [x, y, z], size: [1, 1, 1], finish: 'fish',
        surface: [[-.45*k, 0, 0], [-.72*k, .015, -.23*k], [-.65*k, .015, .23*k]], triangles: [0, 1, 2, 2, 1, 0], outline: [[-.72*k, -.02],[-.45*k,.02],[-.65*k,.02]] })
      box([x, y, z + .18 * k], [.2 * k, .015, .13 * k], 'deck')
      for (const side of [-1, 1]) {
        oval([x + .32*k, y + side*.06*k, z + .04*k], [.035, .018, .035], 'dark')
        prism([[0,0],[-.19*k,side*.2*k],[-.05*k,0]], [x+.1*k,y,z-.04*k], .015, 'fish')
      }
    }
  } else if (type === 'drone') {
    // Industrial quadrotor, 1.6 m propeller envelope, not an aircraft-sized toy.
    body([[-.23,0,0,0],[-.2,.12,.065,0],[.13,.12,.065,0],[.23,.05,.04,0],[.24,0,0,0]], 'hull')
    box([-.04, 0, .07], [.32, .2, .07], 'deck')
    for (const side of [-1, 1]) box([-.02, side*.065, .12], [.22, .055, .03], 'dark')
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
      rail([x*.25,y*.25,.015], [x,y,.025], .028, 'dark')
      cylinder([x,y,.05], [.08,.08,.07], 'dark')
      cylinder([x,y,.095], [.04,.04,.025], 'steel')
      // Thin tapered opposing rotor blades.
      prism([[-.3,-.008],[-.09,-.028],[.02,-.012],[.3,.008],[.09,.028],[-.02,.012]], [x,y,.11], .004, 'dark')
      for (let i = 0; i < 6; i++) box([x-.025+i*.01,y,.086], [.004,.05,.004], 'steel')
      oval([x,y,.005], [.02,.02,.01], x>0?'mark':'glass')
    }
    for (const side of [-1,1]) {
      for (const x of [-.13,.13]) rail([x,side*.1,-.02],[x,side*.18,-.3],.015,'dark')
      rail([-.23,side*.18,-.31],[.23,side*.18,-.31],.02,'dark')
    }
    rail([.13,0,-.04],[.13,0,-.18],.025,'steel')
    oval([.13,0,-.21],[.1,.1,.1],'dark')
    cylinder([.18,0,-.21],[.055,.055,.015],'glass','x')
    for (const y of [-.07,.07]) cylinder([.21,y,.025],[.025,.025,.015],'glass','x')
  } else if (type === 'aircraft') {
    // 53 m strategic transport, 51.8 m wingspan, high swept wings and T-tail.
    body([[-26.5,0,0,1.3],[-24,.7,1.1,1.3],[-20,1.7,2.1,.5],[-15,2.7,2.9,0],[-8,3.45,3.45,0],
      [12,3.45,3.45,0],[19,3,2.8,.1],[23,2,1.9,.2],[25.3,.85,1,.2],[26.5,0,0,.2]], 'steel')
    for (const side of [-1,1]) {
      prism([[9,side*2.5],[-8,side*25.9],[-12.5,side*25.9],[-5,side*2.5]], [0,0,2.3], .38, 'hull')
      // Trailing edge flaps, panel joints, winglets and distinct pylon/nacelle assemblies.
      for (let i=0;i<5;i++) box([-6-i*.9,side*(6+i*3.4),2.53],[1.9,.035,.025],'deck',-.48*side)
      box([-10.2,side*25.7,3.2],[2.8,.15,2],'hull')
      for (const span of [9.5,18]) {
        const x=span>10?-5:0
        box([x-1.5,side*span,.3],[4.3,.4,3.8],'hull')
        body([[-3.2,.8,.8,0],[-2.8,1.4,1.4,0],[1.9,1.5,1.5,0],[2.5,1.35,1.35,0],[2.55,1.05,1.05,0],[1.9,.92,.92,0]],'hull',[x,side*span,-1.8])
        cylinder([x+2.51,side*span,-1.8],[2.25,2.25,.08],'dark','x')
        cylinder([x+2.58,side*span,-1.8],[.42,.42,.15],'steel','x')
        for(let blade=0;blade<18;blade++) {
          const a=blade/18*Math.PI*2
          rail([x+2.56,side*span+Math.cos(a)*.25,-1.8+Math.sin(a)*.25],[x+2.56,side*span+Math.cos(a+.2)*.98,-1.8+Math.sin(a+.2)*.98],.055,'steel')
        }
      }
      prism([[-18,side*.4],[-23.5,side*10.3],[-26,side*10.3],[-23,side*.4]], [0,0,10.2], .25, 'hull')
      for(let i=0;i<9;i++) oval([-10+i*3,side*3.38,.9],[.45,.06,.45],'glass')
      // Cockpit glazing confined to the forward upper fuselage.
      for(let i=0;i<3;i++) box([22.3+i*.65,side*(1.6-i*.26),1.55],[.55,.07,.6],'glass',-.35*side)
      box([14,side*3.16,-.25],[1.1,.06,1.8],'deck')
    }
    // Swept vertical stabilizer in a vertical plane, no solid rectangular tail.
    parts.push({shape:'surface',at:[0,0,0],size:[1,1,1],finish:'hull',
      surface:[[-15,0,2],[-21,0,11.8],[-25,0,11.8],[-26,0,1.3],[-15,.22,2],[-21,.22,11.8],[-25,.22,11.8],[-26,.22,1.3]],
      triangles:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,4,1,5,4,1,2,5,2,6,5,2,3,6,3,7,6],outline:[[-26,-.12],[-15,-.12],[-15,.34],[-26,.34]]})
    box([-19,0,-1.2],[6,4,.12],'deck')
  } else if (type === 'coast') {
    const outline = [[-1200, -700], [850, -700], [1200, -330], [1120, 200], [700, 620], [-200, 760], [-1200, 520]] as const
    prism(outline, [0, 0, -45], 150, 'sand')
    prism([[-1150, -650], [680, -650], [930, -260], [820, 180], [480, 430], [-240, 620], [-1150, 440]], [0, 0, 57], 55, 'land')
    const land = [[-1150, -650], [680, -650], [930, -260], [820, 180], [480, 430], [-240, 620], [-1150, 440]] as const
    const surface: AssetPoint[] = [], triangles: number[] = [], columns = 32, rows = 24
    const inside = (x: number, y: number) => {
      let hit = false
      for (let i = 0, j = land.length - 1; i < land.length; j = i++) {
        const a = land[i]!, b = land[j]!
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit
      }
      return hit
    }
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const x = -1150 + column / columns * 2080, y = -650 + row / rows * 1270
      const hill = (cx: number, cy: number, sx: number, sy: number, height: number) => height * Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))
      const road = 1 - Math.exp(-(((y + 280) / 65) ** 2))
      const elevation = 85 + road * (hill(-850, 140, 390, 230, 230) + hill(-240, 330, 500, 180, 120)
        + hill(280, -500, 420, 160, 100) + Math.sin(x / 137 + y / 193) * Math.cos(y / 87) * 8)
      surface.push([x, y, Math.max(85, elevation)])
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1
      if ([a, b, c, d].every(index => inside(surface[index]![0], surface[index]![1]))) triangles.push(a, c, b, b, c, d)
    }
    parts.push({ shape: 'terrain', at: [0, 0, 0], size: [2080, 1270, 300], finish: 'land', outline: land, surface, triangles })
    box([-200, -280, 86], [1400, 32, 3], 'deck')
    for (let i = 0; i < 18; i++) box([-820 + i * 70, -280, 88], [24, 1.4, 0.3], 'mark')
    for (const y of [40, 130]) {
      box([880, y, 20], [320, 30, 18], 'concrete')
      for (let i=0;i<11;i++) for(const side of [-1,1]) cylinder([740+i*27,y+side*13,30],[.6,.6,1.2],'dark')
    }
    for(let i=0;i<24;i++) oval([1040+Math.sin(i*2.3)*65,-220+i*23,18],[18+i%5,13+i%7,12+i%4],'concrete')
    for(let i=0;i<13;i++) { cylinder([-840+i*100,-258,92],[.25,.25,8],'steel'); box([-840+i*100,-259,96],[1.2,.5,.2],'mark') }
    for(let i=0;i<50;i++) { const x=-1100+i*31, y=440+Math.sin(i*2.3)*50; oval([x,y,112],[7+i%4,5+i%3,6+i%4],'concrete') }
  } else if (type === 'command') {
    box([0,0,-.2],[180,130,.4],'concrete')
    box([-18,0,4],[50,24,8],'concrete')
    box([-18,0,8.2],[51,25,.4],'deck')
    for(const side of [-1,1]) for(let i=0;i<12;i++) {
      for(const z of [2.1,5.6]) box([-40+i*4,side*12.04,z],[1.8,.08,1.4],'glass')
    }
    box([23,0,9],[8,8,18],'concrete')
    box([23,0,18],[10,10,2.6],'glass')
    box([23,0,19.6],[11,11,.5],'deck')
    cylinder([23,0,24],[.16,.16,9],'steel')
    box([23,0,28],[.4,4,.2],'hull')
    // Roof HVAC, antenna equipment and a small ground satellite dish.
    for(const x of [-30,-20,-10]) { box([x,0,9],[3,2,1.2],'hull'); for(let i=0;i<7;i++) box([x-1.2+i*.4,0,9.63],[.15,1.8,.04],'dark') }
    for(const side of [-1,1]) rail([-36,side*7,8.5],[-36,side*7,11],.08)
    cylinder([-55,25,5],[.25,.25,10],'steel')
    oval([-55,25,11],[4,.5,4],'steel')
    rail([-55,25,11],[-55,22.7,11],.05)
    box([-57,24,0.8],[3,2,1.6],'hull')
    for(let i=0;i<4;i++) {
      const x=-54+i*17
      box([x,-43,1.295],[12.2,2.44,2.59],'hull')
      for(let j=0;j<25;j++) for(const side of [-1,1]) box([x-5.8+j*.48,-43+side*1.24,1.3],[.08,.035,2.4],'steel')
      box([x+6.12,-43,1.3],[.05,2.1,2.3],'deck')
    }
    // Fence posts and two fine horizontal wires; service gate remains open.
    for(const side of [-1,1]) {
      for(let i=0;i<27;i++) rail([-84+i*6.5,side*60,0],[-84+i*6.5,side*60,2.4],.06)
      for(const z of [1.2,2.3]) rail([-84,side*60,z],[84,side*60,z],.035)
      for(let i=0;i<20;i++) rail([side*84,-60+i*6,0],[side*84,-60+i*6,2.4],.06)
      for(const z of [1.2,2.3]) rail([side*84,-60,z],[side*84,60,z],.035)
    }
    box([2,-12.1,1.3],[1.6,.12,2.6],'dark')
    for(let i=0;i<9;i++) box([48+i*3.2,-30,.03],[.12,6,.04],'mark')
    for(const x of [-65,65]) { cylinder([x,-30,4],[.12,.12,8],'steel'); box([x,-30,8],[1,.5,.2],'mark') }

  }
  return parts
}

export interface AssetBounds { min: AssetPoint; max: AssetPoint; size: AssetPoint }
const measureParts = (parts: readonly AssetPart[]): AssetBounds => {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const part of parts) {
    const [w, d, h] = part.size, length = part.axis === 'x' ? h : w, height = part.axis === 'x' ? w : h
    const points = part.surface ?? (part.outline ? part.outline.flatMap(([x,y]) => [[x,y,-height/2], [x,y,height/2]])
      : [-1,1].flatMap(x => [-1,1].flatMap(y => [-1,1].map(z => [x*length/2,y*d/2,z*height/2]))))
    const angle = part.yaw ?? 0
    for (const [x,y,z] of points) {
      const point = [part.at[0] + x! * Math.cos(angle) - y! * Math.sin(angle), part.at[1] + x! * Math.sin(angle) + y! * Math.cos(angle), part.at[2] + z!]
      for (let i=0;i<3;i++) { min[i] = Math.min(min[i]!,point[i]!); max[i] = Math.max(max[i]!,point[i]!) }
    }
  }
  return { min, max,
    size: [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!] }
}

// Normalize once, in shared geometry, so 2D drawing/picking and 3D use the same pivot.
const MODELS = new Map<SceneAssetType, { parts: readonly AssetPart[]; bounds: AssetBounds; anchor: AssetPoint }>((['wreck', 'fish', 'submarine', 'warship', 'drone', 'aircraft', 'coast', 'command'] as const).map(type => {
  const source = makeParts(type), bounds = measureParts(source)
  const anchor = bottomCenter(bounds.min, bounds.max, 2)
  const parts = source.map(part => ({ ...part,
    at: [part.at[0] - anchor[0], part.at[1] - anchor[1], part.at[2] - anchor[2]] as AssetPoint }))
  return [type, { parts, bounds: measureParts(parts), anchor }] as const
}))
export const sceneAssetParts = (type: SceneAssetType) => MODELS.get(type)!.parts
export const sceneAssetBounds = (type: SceneAssetType): AssetBounds => MODELS.get(type)!.bounds
/** Convert a point in the authored model (waterline/ground surface) to the base pivot. */
export const sceneAssetLocalPoint = (type: SceneAssetType, point: AssetPoint): AssetPoint => {
  const anchor = MODELS.get(type)!.anchor
  return [point[0] - anchor[0], point[1] - anchor[1], point[2] - anchor[2]]
}
export const sceneAssetSizeLabel = (type: SceneAssetType, scale = 1): string =>
  sceneAssetBounds(type).size.map(size => Number((size * scale).toFixed(2))).join(' × ') + ' m'
