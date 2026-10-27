import type { NodeVisual, ReplayNode, ReplayPacket, ReplayReceiver } from '@/shared/types/replay'
import { clampRatio, durationForProgress, reasonLabel } from './format'

const RX_OK_HOLD_US = 180_000
const RX_FAIL_HOLD_US = 220_000

export type NodeRxEvent = ReplayReceiver & { collision_start_us: number; packet_id: string; src: number }

const makeVisual = (node: ReplayNode, patch: Partial<NodeVisual>): NodeVisual => ({
  node_id: node.node_id, mode: 'idle', fillProgress: 0, fade: 1,
  statusText: '空闲', packetId: null, overlay: null, ...patch,
})

/** One scan per node, preserving the old stable-sort/last-event tie rule. */
export const buildNodeVisual = (node: ReplayNode, txEvents: ReplayPacket[], rxEvents: NodeRxEvent[], time: number, fractionalTiming = false): NodeVisual => {
  let activeTx: ReplayPacket | null = null
  for (const packet of txEvents) {
    if (time >= packet.tx_start_us && time <= packet.tx_end_us
      && (!activeTx || packet.tx_start_us >= activeTx.tx_start_us)) activeTx = packet
  }
  let activeRxTxConflict: NodeRxEvent | null = null
  let activeRxRxConflict: NodeRxEvent | null = null
  let preCollisionReceive: NodeRxEvent | null = null
  let activeReceive: NodeRxEvent | null = null
  let recentSuccess: NodeRxEvent | null = null
  let recentFailure: NodeRxEvent | null = null
  for (const receiver of rxEvents) {
    if (time >= receiver.rx_start_us && time <= receiver.rx_end_us) {
      if (receiver.reason === 'collision_rx_tx'
        && (!activeRxTxConflict || receiver.rx_start_us >= activeRxTxConflict.rx_start_us)) activeRxTxConflict = receiver
      if (receiver.reason === 'collision_rx_rx') {
        if (time >= receiver.collision_start_us
          && (!activeRxRxConflict || receiver.rx_start_us >= activeRxRxConflict.rx_start_us)) activeRxRxConflict = receiver
        if (time < receiver.collision_start_us
          && (!preCollisionReceive || receiver.rx_start_us >= preCollisionReceive.rx_start_us)) preCollisionReceive = receiver
      }
      if (receiver.status === 'ok'
        && (!activeReceive || receiver.rx_start_us >= activeReceive.rx_start_us)) activeReceive = receiver
    }
    if (time > receiver.rx_end_us) {
      if (receiver.status === 'ok' && time - receiver.rx_end_us <= RX_OK_HOLD_US
        && (!recentSuccess || receiver.rx_end_us >= recentSuccess.rx_end_us)) recentSuccess = receiver
      if (receiver.status !== 'ok' && time - receiver.rx_end_us <= RX_FAIL_HOLD_US
        && (!recentFailure || receiver.rx_end_us >= recentFailure.rx_end_us)) recentFailure = receiver
    }
  }
  if (activeTx) return makeVisual(node, {
    mode: 'tx',
    fillProgress: clampRatio((time - activeTx.tx_start_us) / durationForProgress(activeTx.tx_duration_us, fractionalTiming)),
    statusText: activeRxTxConflict ? '发送中 / rx-tx 冲突' : '发送中',
    packetId: activeTx.packet_id,
    overlay: activeRxTxConflict ? { kind: 'collision_rx_tx', strength: 1, packetId: activeRxTxConflict.packet_id } : null,
  })
  if (activeRxRxConflict) return makeVisual(node, {
    mode: 'collision', fillProgress: 1, statusText: '接收冲突', packetId: activeRxRxConflict.packet_id,
    overlay: { kind: 'collision_rx_rx', strength: 1, packetId: activeRxRxConflict.packet_id },
  })
  const receiving = activeReceive || preCollisionReceive
  if (receiving) return makeVisual(node, {
    mode: 'rx',
    fillProgress: clampRatio((time - receiving.rx_start_us) / durationForProgress(receiving.rx_duration_us, fractionalTiming)),
    statusText: '接收中', packetId: receiving.packet_id,
  })
  if (recentFailure) {
    const fade = clampRatio(1 - ((time - recentFailure.rx_end_us) / RX_FAIL_HOLD_US))
    return makeVisual(node, {
      mode: 'collision-linger', fillProgress: 1, fade, statusText: reasonLabel(recentFailure.reason), packetId: recentFailure.packet_id,
      overlay: { kind: recentFailure.reason ?? 'fail', strength: fade, packetId: recentFailure.packet_id },
    })
  }
  if (recentSuccess) return makeVisual(node, {
    mode: 'rx-done', fillProgress: 1,
    fade: clampRatio(1 - ((time - recentSuccess.rx_end_us) / RX_OK_HOLD_US)),
    statusText: '接收成功', packetId: recentSuccess.packet_id,
  })
  return makeVisual(node, {})
}
