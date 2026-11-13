interface Position { x: number; y: number; z?: number }

/** Set the true 3D distance by moving in XY along the existing bearing; depth stays unchanged. */
export const positionAtDistance = (anchor: Position, moving: Position, distance: number): Position => {
  if (![anchor.x, anchor.y, anchor.z ?? 0, moving.x, moving.y, moving.z ?? 0, distance].every(Number.isFinite) || distance < 0) {
    throw new Error('请输入有效距离，如 500m 或 1.5km')
  }
  const dz = (moving.z ?? 0) - (anchor.z ?? 0)
  if (distance < Math.abs(dz)) throw new Error(`距离不能小于两点的深度差 ${Math.abs(dz)} m`)
  const horizontal = distance ? distance * Math.sqrt(Math.max(0, 1 - (dz / distance) ** 2)) : 0
  const dx = moving.x - anchor.x, dy = moving.y - anchor.y, current = Math.hypot(dx, dy)
  if (current < 1e-9 && horizontal > 0) throw new Error('两点在 XY 平面重合，请先拖开一个节点以确定方向')
  const next = { x: anchor.x + (current ? dx / current * horizontal : 0),
    y: anchor.y + (current ? dy / current * horizontal : 0), z: moving.z ?? 0 }
  if (![next.x * 100,next.y * 100].every(Number.isFinite)) throw new Error('距离超出可布置范围')
  return next
}
