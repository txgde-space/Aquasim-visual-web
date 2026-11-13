export const NODE_MODEL_OPTIONS = [
  { value: 'auv', label: 'AUV · 自主水下航行器' },
  { value: 'rov', label: 'ROV · 遥控水下机器人' },
  { value: 'vessel', label: '水面船' },
  { value: 'buoy', label: '浮标' },
  { value: 'sensor', label: '水下传感器' },
] as const

export type NodeModelType = typeof NODE_MODEL_OPTIONS[number]['value']

export function isNodeModelType(value: unknown): value is NodeModelType {
  return NODE_MODEL_OPTIONS.some((option) => option.value === value)
}

export function resolveNodeModel(node: { modelType?: unknown; role?: unknown; name?: unknown }): NodeModelType {
  if (isNodeModelType(node.modelType)) return node.modelType
  // Preserve the appearance of files created before model selection existed.
  return node.role === 'sink' || /sink/i.test(String(node.name ?? '')) ? 'vessel' : 'auv'
}

export function nodeModelLabel(modelType: NodeModelType): string {
  return NODE_MODEL_OPTIONS.find((option) => option.value === modelType)!.label
}

/** Representative complete equipment envelopes in metres, including fins/arms/masts.
 * Generic teaching models, not a claim of a particular manufacturer's product. */
export const NODE_MODEL_DIMENSIONS: Record<NodeModelType, { length: number; width: number; height: number }> = {
  auv: { length: 4, width: 1.4, height: 1.4 },
  rov: { length: 3, width: 2.05, height: 1.7 },
  vessel: { length: 18, width: 6.5, height: 8 },
  buoy: { length: 1.9, width: 1.9, height: 6 },
  sensor: { length: 1.6, width: 1.6, height: 1.8 },
}
export const nodeModelSizeLabel = (kind: NodeModelType) => {
  const { length, width, height } = NODE_MODEL_DIMENSIONS[kind]
  return `${length} × ${width} × ${height} m`
}
