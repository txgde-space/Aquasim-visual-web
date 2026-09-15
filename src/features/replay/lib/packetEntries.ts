import type { ReceiverStatus, ReplayNode, ReplayPacket, ReplayReceiver } from '@/shared/types/replay'
import { blockedReasonLabel, clampRatio, reasonLabel, timeDisplay } from './format'
import { earlierArrivalLate } from './geometry'

export type PacketTone = 'ok' | 'rxtx' | 'rxrx' | 'fail'

/** Single source of truth for the receiver tone mapping (was duplicated 3 times). */
export const statusTone = (status: ReceiverStatus, reason: string | null | undefined): PacketTone => {
  if (status === 'ok') return 'ok'
  if (reason === 'collision_rx_tx') return 'rxtx'
  if (reason === 'collision_rx_rx') return 'rxrx'
  return 'fail'
}

export const receiverPillClass = (receiver: Pick<ReplayReceiver, 'status' | 'reason'>): string => {
  const tone = statusTone(receiver.status, receiver.reason)
  if (tone === 'ok') return 'receiver-pill-ok'
  if (tone === 'rxtx') return 'receiver-pill-rxtx'
  if (tone === 'rxrx') return 'receiver-pill-rxrx'
  return 'receiver-pill-fail'
}

export const packetTagLabel = (kind: string): string => {
  if (kind === 'blocked') return '发送阻塞'
  if (kind === 'ok') return '全成功'
  if (kind === 'mixed') return '混合结果'
  return '全失败'
}

export const packetTagClass = (kind: string): string => {
  if (kind === 'blocked') return 'tag-fail'
  if (kind === 'ok') return 'tag-ok'
  if (kind === 'mixed') return 'tag-mixed'
  return 'tag-fail'
}

export interface PacketEntryContext {
  nodeById: Map<number, ReplayNode>
  packetMap: Map<string, ReplayPacket>
  currentTimeUs: number
  originalReceiverMap: Map<string, ReplayReceiver>
  packetRows: ReplayPacket[]
}

export const buildPacketEntries = (packets: ReplayPacket[], ctx: PacketEntryContext): Array<Record<string, unknown>> => packets.map((packet) => {
  const sourceNode = ctx.nodeById.get(packet.src)
  const receivers = packet.receivers.map((receiver) => {
    const dstNode = ctx.nodeById.get(receiver.dst)
    const overlapHint = receiver.status !== 'ok'
      && Array.isArray(receiver.with)
      && receiver.with.length > 0
      ? `（与 ${receiver.with.join(', ')} 重叠）`
      : ''
    const reason = receiver.status === 'ok' ? '成功' : `${reasonLabel(receiver.reason)}${overlapHint}`
    const tone = statusTone(receiver.status, receiver.reason)
    const original = ctx.originalReceiverMap.get(`${packet.eventId}:${receiver.dst}`)
    const originalChanged = Boolean(
      original
      && (original.status !== receiver.status || (original.reason || null) !== (receiver.reason || null)),
    )

    return {
      ...receiver,
      dstLabel: dstNode ? dstNode.name : `Node-${receiver.dst}`,
      reasonLabel: reason,
      tone,
      originalChanged,
      originalReasonLabel: original
        ? (original.status === 'ok' ? '成功' : reasonLabel(original.reason))
        : null,
    }
  })

  const okCount = receivers.filter((receiver) => receiver.status === 'ok').length
  const failCount = receivers.length - okCount
  const rxrxCount = receivers.filter((receiver) => receiver.reason === 'collision_rx_rx').length
  const rxtxCount = receivers.filter((receiver) => receiver.reason === 'collision_rx_tx').length
  const packetKind = !packet.tx_committed
    ? 'blocked'
    : failCount === 0
      ? 'ok'
      : (okCount > 0 ? 'mixed' : 'fail')
  const totalDurationUs = Math.max(1, packet.timeEnd - packet.tx_start_us)
  const progressPct = clampRatio((ctx.currentTimeUs - packet.tx_start_us) / totalDurationUs) * 100
  const blockedReasonText = packet.tx_committed ? null : blockedReasonLabel(packet.tx_blocked_reason)
  const outcomeSummary = packet.tx_committed
    ? `成功 ${okCount} / rx-rx ${rxrxCount} / rx-tx ${rxtxCount}`
    : `未发出 / 原因 ${blockedReasonText}`
  const timingWarn = Boolean(packet.simulated) && earlierArrivalLate(packet, ctx.packetRows)

  return {
    ...packet,
    sourceLabel: sourceNode ? sourceNode.name : `Node-${packet.src}`,
    receivers,
    okCount,
    failCount,
    rxrxCount,
    rxtxCount,
    packetKind,
    packetKindLabel: packetTagLabel(packetKind),
    packetKindClass: packetTagClass(packetKind),
    packetDurationLabel: timeDisplay(totalDurationUs),
    prettyTime: timeDisplay(packet.tx_start_us),
    progressPct,
    blockedReasonText,
    outcomeSummary,
    startUs: packet.tx_start_us,
    endUs: packet.timeEnd,
    timingWarn,
  }
})

export const buildLifecycleGroups = (packetEntries: Array<Record<string, unknown>>, currentTimeUs: number): Array<Record<string, unknown>> => {
  const groups = new Map<string, Record<string, unknown>>()
  for (const entry of packetEntries) {
    const key = String(entry.packet_id)
    const existing = groups.get(key) || {
      packet_id: key,
      sourceLabel: entry.sourceLabel,
      startUs: Number.POSITIVE_INFINITY,
      endUs: 0,
      segments: [] as Array<Record<string, unknown>>,
    }
    existing.startUs = Math.min(existing.startUs as number, entry.startUs as number)
    existing.endUs = Math.max(existing.endUs as number, entry.endUs as number)
    ;(existing.segments as Array<Record<string, unknown>>).push(entry)
    groups.set(key, existing)
  }

  return [...groups.values()]
    .map((group): Record<string, unknown> => {
      const sortedSegments = (group.segments as Array<Record<string, unknown>>).slice().sort((a, b) => (a.startUs as number) - (b.startUs as number))
      const allReceivers = sortedSegments.flatMap((segment) => segment.receivers as Array<Record<string, unknown>>)
      const okCount = allReceivers.filter((receiver) => receiver.status === 'ok').length
      const failCount = allReceivers.length - okCount
      const rxrxCount = allReceivers.filter((receiver) => receiver.reason === 'collision_rx_rx').length
      const rxtxCount = allReceivers.filter((receiver) => receiver.reason === 'collision_rx_tx').length
      const blockedCount = sortedSegments.filter((segment) => !segment.tx_committed).length
      const packetKind = blockedCount > 0
        ? 'blocked'
        : failCount === 0
          ? 'ok'
          : (okCount > 0 ? 'mixed' : 'fail')
      const totalDurationUs = Math.max(1, (group.endUs as number) - (group.startUs as number))
      const progressPct = clampRatio((currentTimeUs - (group.startUs as number)) / totalDurationUs) * 100

      return {
        ...group,
        segments: sortedSegments,
        blockedCount,
        okCount,
        failCount,
        rxrxCount,
        rxtxCount,
        packetKind,
        packetKindLabel: packetTagLabel(packetKind),
        packetKindClass: packetTagClass(packetKind),
        packetDurationLabel: timeDisplay(totalDurationUs),
        prettyTime: timeDisplay(group.startUs as number),
        progressPct,
      }
    })
    .sort((a, b) => (a.startUs as number) - (b.startUs as number))
}

export const buildLifecycleStages = (lifecyclePacket: Record<string, unknown> | null, currentTimeUs: number): Array<Record<string, unknown>> => {
  if (!lifecyclePacket) return []

  const stages: Array<Record<string, unknown>> = []
  for (const segment of lifecyclePacket.segments as Array<Record<string, unknown>>) {
    stages.push({
      eventId: `${segment.eventId}-tx`,
      type: 'tx',
      status: segment.tx_committed ? 'ok' : 'fail',
      title: segment.tx_committed ? `${segment.sourceLabel} 发射` : `${segment.sourceLabel} 发送被阻塞`,
      detail: segment.tx_committed
        ? `${lifecyclePacket.packet_id} · 段 ${segment.eventId} · 时长 ${timeDisplay(segment.tx_duration_us as number)}`
        : `${lifecyclePacket.packet_id} · 段 ${segment.eventId} · 未发出（${blockedReasonLabel(segment.tx_blocked_reason as string | null)}）`,
      startUs: segment.tx_start_us,
      endUs: segment.tx_end_us,
    })

    for (const receiver of segment.receivers as Array<Record<string, unknown>>) {
      stages.push({
        eventId: receiver.receiver_id,
        type: 'rx',
        status: statusTone(receiver.status as ReceiverStatus, receiver.reason as string | null),
        title: `${receiver.dstLabel} 接收`,
        detail: `${receiver.reasonLabel} · 段 ${segment.eventId} · 时长 ${timeDisplay(receiver.rx_duration_us as number)}`,
        startUs: receiver.rx_start_us,
        endUs: receiver.rx_end_us,
      })
    }
  }

  return stages
    .sort((a, b) => (a.startUs as number) - (b.startUs as number))
    .map((stage) => {
      const totalUs = Math.max(1, (stage.endUs as number) - (stage.startUs as number))
      const progressPct = clampRatio((currentTimeUs - (stage.startUs as number)) / totalUs) * 100
      return {
        ...stage,
        progressPct,
        active: currentTimeUs >= (stage.startUs as number) && currentTimeUs <= (stage.endUs as number),
      }
    })
}
