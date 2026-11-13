import { Vector3, type ArcRotateCamera, type StandardMaterial } from '@babylonjs/core'
import { setMaterialColor, type PacketMeshEntry } from './factories'
import { packetColor, type PacketReceiverTiming, type Theme3DPalette } from './themes3d'
import { signalWindow } from './signalTimeline'

type PacketTiming = { tx_start_us: number; tx_duration_us: number; tx_committed?: boolean }
type ReceiverTiming = PacketReceiverTiming & { rx_end_us: number }

/** The annotation widths stay readable in pixels; path length stays in real metres. */
export const syncPacketPresentation = (
  entry: PacketMeshEntry, packet: PacketTiming, receiver: ReceiverTiming, now: number,
  palette: Theme3DPalette, fx: number,
) => {
  const window = signalWindow(packet, receiver, now)
  entry.line.setEnabled(window.active)
  entry.line.alpha = fx > 1 ? .28 : .18
  entry.line.color = palette.line
  entry.block.setEnabled(window.active && window.front > window.tail)
  entry.head.setEnabled(window.active && window.front > window.tail)
  entry.marker.setEnabled(window.receiving)
  const midpoint = (window.front + window.tail) / 2
  entry.block.position.copyFrom(entry.sourcePosition).addInPlace(entry.direction.scale(midpoint))
  entry.block.scaling.y = Math.max(.00001, entry.pathLength * (window.front - window.tail))
  entry.head.position.copyFrom(entry.sourcePosition).addInPlace(entry.direction.scale(window.front))
  // A collision is a receiver observation; it must not turn every in-flight path red.
  setMaterialColor(entry.block.material as StandardMaterial, palette.tx, palette.tx, .65)
  setMaterialColor(entry.head.material as StandardMaterial, palette.tx, palette.tx, .98)
  const color = packetColor(receiver, now, palette)
  setMaterialColor(entry.marker.material as StandardMaterial, color, color, .85)
  entry.result.setEnabled(window.receiving && color === palette.bad)
  entry.result.color = palette.bad
}

export const syncPacketAnnotationSize = (entry: PacketMeshEntry, camera: ArcRotateCamera, height: number): void => {
  const scaleAt = (position: Vector3) => Math.max(.001, 2 * Vector3.Distance(camera.globalPosition, position) * Math.tan(camera.fov / 2) / Math.max(1, height))
  const bodyScale = scaleAt(entry.block.position) * 2
  entry.block.scaling.x = entry.block.scaling.z = bodyScale
  const headScale = scaleAt(entry.head.position)
  entry.head.scaling.set(8 * headScale, 11 * headScale, 8 * headScale)
  entry.marker.scaling.setAll(24 * scaleAt(entry.destinationPosition))
  entry.result.scaling.setAll(20 * scaleAt(entry.destinationPosition))
}
