import { computed, type ComputedRef, type Ref } from 'vue'

export interface TooltipNode {
  node_id: number
  x: number
  y: number
  z?: number
  name?: string
}

export interface TooltipNodeVisual {
  mode?: string
  packetId?: number | string | null
}

export interface TooltipPacket {
  packet_id: number | string
  src: number
  receivers: Array<{
    dst: number
    status: string
    reason: string | null
  }>
}

export interface TooltipStats {
  modeLabel: string
  packetText: string
  txLinks: number
  rxLinks: number
  okCount: number
  collisionRxRxCount: number
  collisionRxTxCount: number
  failCount: number
  packetListText: string
  reasonText: string
}

const MODE_LABEL_MAP: Record<string, string> = {
  idle: 'IDLE',
  tx: 'TX',
  rx: 'RX',
  'rx-done': 'RX-DONE',
  collision: 'COLLISION',
  'collision-linger': 'COLLISION',
}

/** Viewport size below which the tooltip switches to the compact layout. */
const COMPACT_TOOLTIP_MAX_WIDTH_PX = 720
const COMPACT_TOOLTIP_MAX_HEIGHT_PX = 520
const TOOLTIP_COMPACT_WIDTH_PX = 280
const TOOLTIP_COMPACT_HEIGHT_PX = 180
const TOOLTIP_WIDTH_PX = 360
const TOOLTIP_HEIGHT_PX = 210
const TOOLTIP_MARGIN_PX = 8
const TOOLTIP_CURSOR_GAP_PX = 16
/** Fraction of tooltip height above the cursor the tooltip is anchored to. */
const TOOLTIP_ANCHOR_FRACTION = 0.46

interface NodeTooltipDeps {
  hoveredNodeId: Ref<number | null>
  nodeById: ComputedRef<Map<number, TooltipNode>>
  nodeVisualById: ComputedRef<Map<number, TooltipNodeVisual>>
  toScreenFn: (x: number, y: number) => { x: number; y: number }
  getVisiblePackets: () => TooltipPacket[]
  displayWidth: Ref<number>
  displayHeight: Ref<number>
  hoverCursor: Ref<{ x: number; y: number }>
}

export const useNodeTooltip = ({
  hoveredNodeId,
  nodeById,
  nodeVisualById,
  toScreenFn,
  getVisiblePackets,
  displayWidth,
  displayHeight,
  hoverCursor,
}: NodeTooltipDeps) => {
  const hoveredNode: ComputedRef<TooltipNode | null> = computed(() => {
    if (!hoveredNodeId.value) return null
    return nodeById.value.get(hoveredNodeId.value) || null
  })

  const hoveredNodePos = computed(() => {
    if (!hoveredNode.value) return null
    return toScreenFn(hoveredNode.value.x, hoveredNode.value.y)
  })

  const hoveredNodeVisual: ComputedRef<TooltipNodeVisual | null> = computed(() => {
    if (!hoveredNode.value) return null
    return nodeVisualById.value.get(hoveredNode.value.node_id) || null
  })

  const nodeLabel = (node: TooltipNode) => `Node ${node.node_id}`
  const nodeTitle = (node: TooltipNode) => (node.name ? `${nodeLabel(node)} · ${node.name}` : nodeLabel(node))

  const hoveredNodeStats: ComputedRef<TooltipStats | null> = computed(() => {
    const node = hoveredNode.value
    if (!node) return null
    const visual = hoveredNodeVisual.value

    let txLinks = 0
    let rxLinks = 0
    let okCount = 0
    let collisionRxRxCount = 0
    let collisionRxTxCount = 0
    let failCount = 0
    const packetIds = new Set<number | string>()
    const reasonSet = new Set<string>()

    for (const packet of getVisiblePackets()) {
      if (packet.src === node.node_id) {
        txLinks += packet.receivers.length
        packetIds.add(packet.packet_id)
      }
      for (const receiver of packet.receivers) {
        if (receiver.dst !== node.node_id) continue
        rxLinks += 1
        packetIds.add(packet.packet_id)
        if (receiver.status === 'ok') okCount += 1
        else {
          failCount += 1
          if (receiver.reason === 'collision_rx_rx') collisionRxRxCount += 1
          else if (receiver.reason === 'collision_rx_tx') collisionRxTxCount += 1
          if (receiver.reason) reasonSet.add(receiver.reason)
        }
      }
    }

    const packetList = [...packetIds]
    const reasonText = reasonSet.size ? [...reasonSet].join(' / ') : '无'
    return {
      modeLabel: MODE_LABEL_MAP[visual?.mode || ''] || 'IDLE',
      packetText: visual?.packetId ? String(visual.packetId) : '无',
      txLinks,
      rxLinks,
      okCount,
      collisionRxRxCount,
      collisionRxTxCount,
      failCount,
      packetListText: packetList.length ? packetList.join(', ') : '无',
      reasonText,
    }
  })

  /** Tooltip position clamped inside the viewport, flipping around the cursor. */
  const hoveredTooltipStyle: ComputedRef<{ left: string; top: string } | null> = computed(() => {
    if (!hoveredNodePos.value) return null
    const compact = displayWidth.value < COMPACT_TOOLTIP_MAX_WIDTH_PX || displayHeight.value < COMPACT_TOOLTIP_MAX_HEIGHT_PX
    const estimatedWidth = compact ? TOOLTIP_COMPACT_WIDTH_PX : TOOLTIP_WIDTH_PX
    const estimatedHeight = compact ? TOOLTIP_COMPACT_HEIGHT_PX : TOOLTIP_HEIGHT_PX
    const margin = TOOLTIP_MARGIN_PX
    const gap = TOOLTIP_CURSOR_GAP_PX
    const cursorX = hoverCursor.value.x
    const cursorY = hoverCursor.value.y
    let x = cursorX + gap
    let y = cursorY - (estimatedHeight * TOOLTIP_ANCHOR_FRACTION)

    if (x + estimatedWidth > (displayWidth.value - margin)) {
      x = cursorX - estimatedWidth - gap
    }
    if (x < margin) {
      x = margin
    }
    if (y + estimatedHeight > (displayHeight.value - margin)) {
      y = displayHeight.value - estimatedHeight - margin
    }
    if (y < margin) {
      y = margin
    }

    return {
      left: `${x}px`,
      top: `${y}px`,
    }
  })

  return {
    hoveredNode,
    hoveredNodePos,
    hoveredNodeVisual,
    hoveredNodeStats,
    hoveredTooltipStyle,
    nodeLabel,
    nodeTitle,
  }
}

export type NodeTooltip = ReturnType<typeof useNodeTooltip>
