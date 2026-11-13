/** Real event timing determines the occupied part of each source/receiver path. */
export const signalWindow = (
  packet: { tx_start_us: number; tx_duration_us: number; tx_committed?: boolean },
  receiver: { rx_start_us: number; rx_end_us: number },
  now: number,
) => {
  const active = packet.tx_committed !== false && now >= packet.tx_start_us && now <= receiver.rx_end_us
  const delay = Math.max(0, receiver.rx_start_us - packet.tx_start_us)
  const ratio = (elapsed: number) => delay > 0 ? Math.min(1, Math.max(0, elapsed / delay)) : Number(elapsed >= 0)
  const front = ratio(now - packet.tx_start_us)
  const tail = ratio(now - packet.tx_start_us - packet.tx_duration_us)
  return { active, front, tail, receiving: active && now >= receiver.rx_start_us }
}
