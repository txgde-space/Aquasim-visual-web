export interface SnapPoint { x: number; y: number }
export interface SnapNode extends SnapPoint { node_id: number }
export interface SnapOptions { enabled: boolean; grid: boolean; alignment: boolean; spacing: boolean }
export interface SnapGuide {
  kind: 'grid' | 'alignment' | 'spacing'
  from: SnapPoint
  to: SnapPoint
  label?: string
}

export const SNAP_THRESHOLD_PX = 4
const GRID_GUIDE_HALF_LENGTH_PX = 24
// World-coordinate noise only: zoom must not turn different rows into one row.
const COORD_EPSILON = 1e-6
const DISTANCE_EPSILON = 1e-9
type Axis = 'x' | 'y'
type Kind = SnapGuide['kind']
const otherAxis = (axis: Axis): Axis => axis === 'x' ? 'y' : 'x'
const priority: Record<Kind, number> = { alignment: 0, spacing: 1, grid: 2 }
interface AxisTarget { value: number; positions: number[] }
interface SpacingTarget extends SnapPoint { axis: Axis; a: number; b: number; order: number }
interface SpacingTree {
  point: SpacingTarget
  left: SpacingTree | null
  right: SpacingTree | null
  minX: number; maxX: number; minY: number; maxY: number
}
export interface SnapSession {
  readonly anchors: readonly SnapNode[]
  readonly xTargets: readonly AxisTarget[]
  readonly yTargets: readonly AxisTarget[]
  readonly spacingTree: SpacingTree | null
}

const finitePoint = (point: SnapPoint): boolean => Number.isFinite(point.x) && Number.isFinite(point.y)
const distanceLabel = (distance: number): string => {
  const meters = Math.round(Math.abs(distance) * 100) / 100
  return meters >= 1000 ? `${Number((meters / 1000).toFixed(2))} km` : `${meters} m`
}
const lowerBound = <T>(items: readonly T[], value: number, get: (item: T) => number): number => {
  let low = 0
  let high = items.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (get(items[middle]!) < value) low = middle + 1
    else high = middle
  }
  return low
}

const axisTargets = (nodes: readonly SnapNode[], axis: Axis): AxisTarget[] => {
  const perpendicular = otherAxis(axis)
  const sorted = [...nodes].sort((a, b) => a[axis] - b[axis] || a[perpendicular] - b[perpendicular])
  const targets: AxisTarget[] = []
  for (const node of sorted) {
    const previous = targets.at(-1)
    if (previous && previous.value === node[axis]) {
      if (previous.positions.at(-1) !== node[perpendicular]) previous.positions.push(node[perpendicular])
    } else targets.push({ value: node[axis], positions: [node[perpendicular]] })
  }
  return targets
}

const spacingTargets = (nodes: readonly SnapNode[], axis: Axis): SpacingTarget[] => {
  const perpendicular = otherAxis(axis)
  const sorted = [...nodes].sort((a, b) => a[perpendicular] - b[perpendicular] || a[axis] - b[axis])
  const targets: SpacingTarget[] = []
  for (let start = 0; start < sorted.length;) {
    const lane = sorted[start]![perpendicular]
    let end = start + 1
    while (end < sorted.length && sorted[end]![perpendicular] - lane <= COORD_EPSILON) end += 1
    const coordinates = [...new Set(sorted.slice(start, end).map((node) => node[axis]))].sort((a, b) => a - b)
    // Consecutive reference nodes define local spacing; never enumerate all pairs.
    for (let index = 1; index < coordinates.length; index += 1) {
      const a = coordinates[index - 1]!
      const b = coordinates[index]!
      if (b - a <= COORD_EPSILON) continue
      for (const value of [a + (b - a) / 2, a - (b - a), b + (b - a)]) {
        const point = axis === 'x' ? { x: value, y: lane } : { x: lane, y: value }
        if (finitePoint(point)) targets.push({ ...point, axis, a, b, order: 0 })
      }
    }
    start = end
  }
  return targets
}

const buildSpacingTree = (points: SpacingTarget[], depth = 0): SpacingTree | null => {
  if (!points.length) return null
  const axis: Axis = depth % 2 ? 'y' : 'x'
  const sorted = points.sort((a, b) => a[axis] - b[axis] || a.order - b.order)
  const middle = sorted.length >>> 1
  const point = sorted[middle]!
  const left = buildSpacingTree(sorted.slice(0, middle), depth + 1)
  const right = buildSpacingTree(sorted.slice(middle + 1), depth + 1)
  return {
    point, left, right,
    minX: Math.min(point.x, left?.minX ?? point.x, right?.minX ?? point.x),
    maxX: Math.max(point.x, left?.maxX ?? point.x, right?.maxX ?? point.x),
    minY: Math.min(point.y, left?.minY ?? point.y, right?.minY ?? point.y),
    maxY: Math.max(point.y, left?.maxY ?? point.y, right?.maxY ?? point.y),
  }
}

/** One immutable-by-convention geometry snapshot per drag; no Vue or live node references. */
export const createSnapSession = (nodes: readonly SnapNode[], selectedIds: readonly number[], anchorId: number): SnapSession => {
  const selected = new Set(selectedIds)
  const anchors: SnapNode[] = []
  const references: SnapNode[] = []
  for (const node of nodes) {
    const copy = { node_id: Number(node.node_id), x: node.x, y: node.y }
    if (!Number.isFinite(copy.node_id) || !finitePoint(copy)) continue
    ;(selected.has(copy.node_id) ? anchors : references).push(copy)
  }
  anchors.sort((a, b) => Number(b.node_id === anchorId) - Number(a.node_id === anchorId) || a.node_id - b.node_id)
  const spacing = [...spacingTargets(references, 'x'), ...spacingTargets(references, 'y')]
  spacing.forEach((point, order) => { point.order = order })
  return { anchors, xTargets: axisTargets(references, 'x'), yTargets: axisTargets(references, 'y'), spacingTree: buildSpacingTree(spacing) }
}

interface AxisMatch { correction: number; kind: 'grid' | 'alignment'; anchor: SnapNode; target: AxisTarget }
interface Proposal { correction: SnapPoint; x: boolean; y: boolean; rank: number; anchor?: SnapNode; spacing?: SpacingTarget }
const sameCorrection = (a: number, b: number): boolean => Math.abs(a - b) <= DISTANCE_EPSILON
const lengthSquared = (point: SnapPoint): number => point.x ** 2 + point.y ** 2

const nearestSpacing = (tree: SpacingTree | null, point: SnapPoint, radius: number, fixed?: { axis: Axis; value: number }): SpacingTarget | null => {
  let best: SpacingTarget | null = null
  let distance = Infinity
  const bounds = {
    minX: point.x - radius, maxX: point.x + radius,
    minY: point.y - radius, maxY: point.y + radius,
  }
  if (fixed?.axis === 'x') { bounds.minX = fixed.value - DISTANCE_EPSILON; bounds.maxX = fixed.value + DISTANCE_EPSILON }
  if (fixed?.axis === 'y') { bounds.minY = fixed.value - DISTANCE_EPSILON; bounds.maxY = fixed.value + DISTANCE_EPSILON }
  const visit = (branch: SpacingTree | null) => {
    if (!branch || branch.maxX < bounds.minX || branch.minX > bounds.maxX || branch.maxY < bounds.minY || branch.minY > bounds.maxY) return
    const dx = Math.max(branch.minX - point.x, 0, point.x - branch.maxX)
    const dy = Math.max(branch.minY - point.y, 0, point.y - branch.maxY)
    if (dx * dx + dy * dy > distance + DISTANCE_EPSILON) return
    const candidate = branch.point
    const next = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (candidate.x >= bounds.minX && candidate.x <= bounds.maxX && candidate.y >= bounds.minY && candidate.y <= bounds.maxY
      && (next < distance - DISTANCE_EPSILON || (Math.abs(next - distance) <= DISTANCE_EPSILON && candidate.order < (best?.order ?? Infinity)))) {
      best = candidate
      distance = next
    }
    // Visit the nearer side first so the other subtree can usually be pruned.
    const leftDistance = branch.left ? (branch.left.point.x - point.x) ** 2 + (branch.left.point.y - point.y) ** 2 : Infinity
    const rightDistance = branch.right ? (branch.right.point.x - point.x) ** 2 + (branch.right.point.y - point.y) ** 2 : Infinity
    visit(leftDistance <= rightDistance ? branch.left : branch.right)
    visit(leftDistance <= rightDistance ? branch.right : branch.left)
  }
  visit(tree)
  return best
}

/** Return one translation for the entire selection. rawDelta always starts at the drag origin. */
export const snapNodeDrag = (
  session: SnapSession,
  rawDelta: SnapPoint,
  options: SnapOptions & { scale: number; gridStep: number },
): { delta: SnapPoint; guides: SnapGuide[] } => {
  const unchanged = { delta: { ...rawDelta }, guides: [] as SnapGuide[] }
  if (!options.enabled || !Number.isFinite(options.scale) || options.scale <= 0 || !finitePoint(rawDelta) || !session.anchors.length) return unchanged
  const radius = SNAP_THRESHOLD_PX / options.scale
  if (!Number.isFinite(radius)) return unchanged
  const matches: Record<Axis, AxisMatch | null> = { x: null, y: null }
  for (const axis of ['x', 'y'] as const) {
    const targets = axis === 'x' ? session.xTargets : session.yTargets
    const consider = (match: AxisMatch) => {
      const difference = Math.abs(match.correction)
      const previous = matches[axis]
      if (difference > radius) return
      if (!previous || difference < Math.abs(previous.correction) - DISTANCE_EPSILON
        || (Math.abs(difference - Math.abs(previous.correction)) <= DISTANCE_EPSILON && priority[match.kind] < priority[previous.kind])) matches[axis] = match
    }
    for (const anchor of session.anchors) {
      const position = anchor[axis] + rawDelta[axis]
      if (options.alignment) {
        const index = lowerBound(targets, position, (target) => target.value)
        for (const candidate of [targets[index - 1], targets[index]]) {
          if (candidate) consider({ correction: candidate.value - position, kind: 'alignment', anchor, target: candidate })
        }
      }
      if (options.grid && Number.isFinite(options.gridStep) && options.gridStep > 0) {
        const value = Math.round(position / options.gridStep) * options.gridStep
        if (Number.isFinite(value)) consider({ correction: value - position, kind: 'grid', anchor, target: { value, positions: [] } })
      }
    }
  }
  const base: Proposal | null = matches.x || matches.y ? {
    correction: { x: matches.x?.correction ?? 0, y: matches.y?.correction ?? 0 },
    x: !!matches.x, y: !!matches.y,
    rank: Math.min(matches.x ? priority[matches.x.kind] : Infinity, matches.y ? priority[matches.y.kind] : Infinity),
  } : null
  let best = base
  if (options.spacing) {
    for (const anchor of session.anchors) {
      const point = { x: anchor.x + rawDelta.x, y: anchor.y + rawDelta.y }
      const candidates = [nearestSpacing(session.spacingTree, point, radius)]
      // A spacing constraint may add the missing axis without undoing an existing snap.
      if (base && base.x !== base.y) {
        const axis = base.x ? 'x' : 'y'
        candidates.push(nearestSpacing(session.spacingTree, point, radius, { axis, value: point[axis] + base.correction[axis] }))
      }
      for (const spacing of candidates) {
        if (!spacing) continue
        const correction = { x: spacing.x - point.x, y: spacing.y - point.y }
        if (Math.abs(correction.x) > radius || Math.abs(correction.y) > radius) continue
        const extendsExisting = best && best.x !== best.y
          && sameCorrection(correction[best.x ? 'x' : 'y'], best.correction[best.x ? 'x' : 'y'])
        const distanceDifference = lengthSquared(correction) - (best ? lengthSquared(best.correction) : Infinity)
        if (!best || extendsExisting || distanceDifference < -DISTANCE_EPSILON
          || (Math.abs(distanceDifference) <= DISTANCE_EPSILON && priority.spacing < best.rank)) {
          best = { correction, x: true, y: true, rank: priority.spacing, anchor, spacing }
        }
      }
    }
  }
  if (!best) return unchanged
  const delta = { x: rawDelta.x + best.correction.x, y: rawDelta.y + best.correction.y }
  const guides: SnapGuide[] = []
  if (best.spacing) {
    const { axis, a, b } = best.spacing
    const lane = best.spacing[otherAxis(axis)]
    const coordinates = [a, b, best.spacing[axis]].sort((left, right) => left - right)
    const point = (value: number) => axis === 'x' ? { x: value, y: lane } : { x: lane, y: value }
    const label = distanceLabel(coordinates[1]! - coordinates[0]!)
    guides.push({ kind: 'spacing', from: point(coordinates[0]!), to: point(coordinates[1]!), label },
      { kind: 'spacing', from: point(coordinates[1]!), to: point(coordinates[2]!), label })
  } else {
    for (const axis of ['x', 'y'] as const) {
      const match = matches[axis]
      if (!match) continue
      const perpendicular = otherAxis(axis)
      const position = match.anchor[perpendicular] + delta[perpendicular]
      const point = (value: number) => axis === 'x' ? { x: match.target.value, y: value } : { x: value, y: match.target.value }
      if (match.kind === 'grid') {
        // The short crosshair is only a screen-space hint; label the actual
        // grid interval, never its zoom-dependent decorative line length.
        const padding = GRID_GUIDE_HALF_LENGTH_PX / options.scale
        guides.push({ kind: 'grid', from: point(position - padding), to: point(position + padding), label: `网格 ${distanceLabel(options.gridStep)}` })
        continue
      }
      // Dimension real adjacent node positions, including group members that
      // share this alignment. Screen padding must not enter these distances.
      const positions = [...match.target.positions, ...session.anchors
        .filter((anchor) => Math.abs(anchor[axis] + delta[axis] - match.target.value) <= COORD_EPSILON)
        .map((anchor) => anchor[perpendicular] + delta[perpendicular])]
        .sort((a, b) => a - b)
      let previous = positions[0]
      for (const current of positions.slice(1)) {
        if (previous === undefined || current - previous <= COORD_EPSILON) continue
        guides.push({ kind: 'alignment', from: point(previous), to: point(current), label: distanceLabel(current - previous) })
        previous = current
      }
    }
  }
  return { delta, guides }
}
