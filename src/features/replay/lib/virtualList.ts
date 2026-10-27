/** Mutable measurements with logarithmic prefix sums; no DOM or Vue dependency. */
export class RowHeightIndex {
  readonly count: number
  private readonly heights: number[]
  private readonly tree: number[]

  constructor(count: number, estimatedHeight: number) {
    this.count = Math.max(0, Math.floor(count))
    const height = Number.isFinite(estimatedHeight) && estimatedHeight > 0 ? estimatedHeight : 128
    this.heights = Array(this.count).fill(height)
    this.tree = Array(this.count + 1).fill(0)
    for (let i = 1; i <= this.count; i++) this.tree[i] = height * (i & -i)
  }

  height(index: number): number { return this.heights[index] ?? 0 }

  offset(index: number): number {
    let sum = 0
    for (let i = Math.max(0, Math.min(this.count, Math.floor(index))); i > 0; i -= i & -i) sum += this.tree[i]
    return sum
  }

  total(): number { return this.offset(this.count) }

  set(index: number, height: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.count || !Number.isFinite(height) || height <= 0) return false
    const delta = height - this.heights[index]
    if (Math.abs(delta) < 0.25) return false
    this.heights[index] = height
    for (let i = index + 1; i <= this.count; i += i & -i) this.tree[i] += delta
    return true
  }

  /** A boundary belongs to the following row; offsets after the end clamp to the last row. */
  indexAt(offset: number): number {
    if (!this.count) return 0
    const target = Math.max(0, offset)
    let index = 0
    let sum = 0
    let step = 1
    while (step * 2 <= this.count) step *= 2
    for (; step; step >>= 1) {
      const next = index + step
      if (next <= this.count && sum + this.tree[next] <= target) {
        index = next
        sum += this.tree[next]
      }
    }
    return Math.min(index, this.count - 1)
  }
}

export interface VirtualListRange {
  start: number
  end: number
  top: number
  bottom: number
}

export const virtualListRange = (heights: RowHeightIndex, scrollTop: number, viewportHeight: number, overscan = 6): VirtualListRange => {
  if (!heights.count) return { start: 0, end: 0, top: 0, bottom: 0 }
  const extra = Math.max(0, Math.floor(overscan))
  const top = Math.max(0, scrollTop)
  const start = Math.max(0, heights.indexAt(top) - extra)
  const end = Math.min(heights.count, heights.indexAt(top + Math.max(1, viewportHeight)) + 1 + extra)
  return { start, end, top: heights.offset(start), bottom: Math.max(0, heights.total() - heights.offset(end)) }
}
