import type { CanvasNodeRange } from '../../../shared/types/canvas'
import { parseQuantity } from '../../../shared/quantity'

export type NodeRangeSettings = CanvasNodeRange

export const DEFAULT_NODE_RANGE: Readonly<NodeRangeSettings> = {
  visible: false, radiusM: '', filled: true, showLabel: true, opacity: 0.14,
}

/** Blank uses model metadata; explicit distances accept m/km and bare meters. */
export const rangeRadius = (input: string, automatic: unknown): number | null => {
  const text = input.trim()
  if (!text) return typeof automatic === 'number' && Number.isFinite(automatic) && automatic > 0 ? automatic : null
  try {
    const { value } = parseQuantity(text, 'm')
    return value > 0 ? value : null
  } catch { return null }
}

export const rangeDistanceLabel = (meters: number): string => meters >= 1000
  ? `${Number((meters / 1000).toFixed(2))} km` : `${Number(meters.toFixed(2))} m`
