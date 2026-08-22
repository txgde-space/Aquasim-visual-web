export const DEFAULT_SOUND_SPEED_MPS = 1500

export const distanceMeters = (a, b) => {
  const dx = (a?.x ?? 0) - (b?.x ?? 0)
  const dy = (a?.y ?? 0) - (b?.y ?? 0)
  const dz = (a?.z ?? 0) - (b?.z ?? 0)
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
}

export const propagateDelayUs = (src, dst, soundSpeedMps) => {
  const speed = Math.max(1, Number(soundSpeedMps) || DEFAULT_SOUND_SPEED_MPS)
  return Math.round((distanceMeters(src, dst) / speed) * 1_000_000)
}

const intervalsOverlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1

export const recomputeReceiversFromGeometry = (packets, nodes, soundSpeedMps) => {
  const nodeMap = new Map(nodes.map((node) => [node.node_id, node]))
  const txWindowsByNode = new Map()

  for (const packet of packets) {
    if (!packet.tx_committed) continue
    const list = txWindowsByNode.get(packet.src) || []
    list.push({
      start: packet.tx_start_us,
      end: packet.tx_end_us,
      packet_id: packet.packet_id,
    })
    txWindowsByNode.set(packet.src, list)
  }

  const draft = packets.map((packet) => {
    if (!packet.tx_committed) {
      return { ...packet, receivers: [], simulated: true }
    }

    const srcNode = nodeMap.get(packet.src)
    if (!srcNode) {
      return { ...packet, receivers: [], simulated: true }
    }

    const receivers = (packet.receivers || [])
      .filter((receiver) => Number.isFinite(Number(receiver.dst)) && Number(receiver.dst) !== packet.src)
      .map((receiver) => {
        const dstNode = nodeMap.get(Number(receiver.dst))
        if (!dstNode) return null
        const delayUs = propagateDelayUs(srcNode, dstNode, soundSpeedMps)
        const rxStartUs = packet.tx_start_us + delayUs
        const rxDurationUs = Math.max(1, packet.tx_duration_us)
        return {
          ...receiver,
          dst: Number(receiver.dst),
          rx_start_us: rxStartUs,
          rx_duration_us: rxDurationUs,
          rx_end_us: rxStartUs + rxDurationUs,
          status: 'ok',
          reason: null,
          with: [],
          delay_us: delayUs,
          simulated: true,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.rx_start_us - b.rx_start_us)

    return { ...packet, receivers, simulated: true }
  })

  const receptionsByDst = new Map()
  for (const packet of draft) {
    for (const receiver of packet.receivers) {
      const list = receptionsByDst.get(receiver.dst) || []
      list.push({ packet, receiver })
      receptionsByDst.set(receiver.dst, list)
    }
  }

  for (const [dst, list] of receptionsByDst) {
    const txWindows = txWindowsByNode.get(dst) || []
    for (const item of list) {
      const hit = txWindows.find((window) => (
        intervalsOverlap(item.receiver.rx_start_us, item.receiver.rx_end_us, window.start, window.end)
      ))
      if (!hit) continue
      item.receiver.status = 'fail'
      item.receiver.reason = 'collision_rx_tx'
      item.receiver.with = [hit.packet_id]
    }

    for (let i = 0; i < list.length; i += 1) {
      if (list[i].receiver.reason === 'collision_rx_tx') continue
      const overlapped = []
      for (let j = 0; j < list.length; j += 1) {
        if (i === j) continue
        if (!intervalsOverlap(
          list[i].receiver.rx_start_us,
          list[i].receiver.rx_end_us,
          list[j].receiver.rx_start_us,
          list[j].receiver.rx_end_us,
        )) continue
        overlapped.push(list[j].packet.packet_id)
      }
      if (!overlapped.length) continue
      list[i].receiver.status = 'fail'
      list[i].receiver.reason = 'collision_rx_rx'
      list[i].receiver.with = [...new Set(overlapped)]
    }
  }

  return draft.map((packet) => {
    const packetEndUs = Math.max(
      packet.tx_end_us,
      0,
      ...packet.receivers.map((receiver) => receiver.rx_end_us),
    )
    return {
      ...packet,
      timeStart: packet.tx_start_us,
      timeEnd: packetEndUs,
    }
  })
}
