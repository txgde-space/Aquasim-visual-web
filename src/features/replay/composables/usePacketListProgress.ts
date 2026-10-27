import { watch, type Ref } from 'vue'
import type { PacketEntry } from '@/shared/types/replay'
import { clampRatio, durationForProgress } from '../lib/format'
import { changedPacketsBetween, indexPacketIntervals } from '../lib/packetTimeline'

interface PacketListProgressOptions {
  list: Ref<HTMLElement | null>
  getPackets: () => PacketEntry[]
  getTime: () => number
  isActive: () => boolean
  getFocus: () => string | null
  isEditMode: () => boolean
  fractionalTiming?: () => boolean
}

/**
 * Vue owns the static log content and focus state. This effect owns only the
 * time-dependent band transform and active class, so playback never renders the
 * entire list. A seek also updates any short events skipped between frames.
 */
export const usePacketListProgress = (options: PacketListProgressOptions) => {
  let renderedList: HTMLElement | null = null
  let renderedPackets: PacketEntry[] | null = null
  let index = indexPacketIntervals([])
  let lastTime: number | null = null
  const elements = new Map<PacketEntry, { row: HTMLElement; band: HTMLElement | null }>()

  watch([
    options.list, options.getPackets, options.getTime, options.isActive,
    options.getFocus, options.isEditMode,
    options.fractionalTiming ?? (() => false),
  ], ([list, packets, time, active, focus, editMode, fractionalTiming], previous) => {
    if (list !== renderedList || packets !== renderedPackets) {
      renderedList = list
      renderedPackets = packets
      lastTime = null
      elements.clear()
      index = indexPacketIntervals(packets)
      if (list) {
        const rows = list.querySelectorAll<HTMLElement>('.log-item[data-event-id]')
        for (let i = 0; i < packets.length; i++) {
          const row = rows[i]
          if (row) elements.set(packets[i], { row, band: row.querySelector<HTMLElement>('.event-band') })
        }
      }
    }
    if (!active || !list) return

    // A focus/edit render can rewrite Vue's class attribute; restore the active
    // class after that render too. Closed panels catch up when opened again.
    const reset = lastTime === null || !previous?.[3] || focus !== previous?.[4] || editMode !== previous?.[5] || fractionalTiming !== previous?.[6]
    const changed = reset ? packets : changedPacketsBetween(index, lastTime!, time)
    for (const packet of changed) {
      const element = elements.get(packet)
      if (!element) continue
      const transform = `scaleX(${clampRatio((time - packet.startUs) / durationForProgress(packet.endUs - packet.startUs, fractionalTiming))})`
      if (element.band && element.band.style.transform !== transform) element.band.style.transform = transform
      element.row.classList.toggle('log-item-active', time >= packet.startUs && time <= packet.endUs)
    }
    lastTime = time
  }, { flush: 'post', immediate: true })
}
