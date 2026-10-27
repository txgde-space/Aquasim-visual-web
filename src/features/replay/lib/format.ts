export const normalizeTime = (value: unknown): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export const clampRatio = (value: unknown): number => Math.max(0, Math.min(1, Number(value) || 0))

/** Guard only the denominator for precise logs; never enlarge their event times. */
export const durationForProgress = (us: number, fractionalTiming = false): number => (
  fractionalTiming && us > 0 ? us : Math.max(1, us)
)

export const timeDisplay = (us: number, fractionalTiming = false): string => {
  if (fractionalTiming) {
    if (us >= 1_000_000) return `${Number((us / 1_000_000).toFixed(9))} s`
    if (us >= 1000) return `${Number((us / 1000).toFixed(6))} ms`
    return `${Number(us.toFixed(3))} μs`
  }
  if (us >= 1_000_000) return `${(us / 1_000_000).toFixed(2)} s`
  return `${(us / 1000).toFixed(2)} ms`
}

export const reasonLabel = (reason: string | null | undefined): string => {
  if (reason === 'collision_rx_rx') return 'rx-rx 冲突'
  if (reason === 'collision_rx_tx') return 'rx-tx 冲突'
  if (reason === 'below_rx_thresh') return '门限不足（信号低于接收阈值）'
  return '接收失败'
}

export const blockedReasonLabel = (reason: string | null | undefined): string => {
  if (reason === 'busy') return 'PHY busy'
  return reason ? String(reason) : '未知原因'
}
