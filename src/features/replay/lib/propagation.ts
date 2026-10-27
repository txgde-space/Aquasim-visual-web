import { DEFAULT_RADIO_PROPAGATION_SPEED_MPS, DEFAULT_SOUND_SPEED_MPS } from '@/shared/constants'
import type { LogMeta } from '@/shared/types/log'

/** Precision is a log capability. The medium fallback only supports older RF logs. */
export const usesFractionalTiming = (meta: LogMeta): boolean => (
  (typeof meta.time_precision_us === 'number' && Number.isFinite(meta.time_precision_us)
    && meta.time_precision_us > 0 && meta.time_precision_us < 1) || meta.medium === 'radio'
)

export const propagationSpeedFromMeta = (meta: LogMeta): number => {
  const speed = meta.propagation_speed_mps
  if (typeof speed === 'number' && Number.isFinite(speed) && speed > 0) return speed
  return meta.medium === 'radio' ? DEFAULT_RADIO_PROPAGATION_SPEED_MPS : DEFAULT_SOUND_SPEED_MPS
}
