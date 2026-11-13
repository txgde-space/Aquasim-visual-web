import type { ExperimentNodeSpec, ExperimentSpec } from '../../../shared/types/experiment'

import { nonBlankAttributes } from './protocolUnits'

/** These layers own a separate instance on each device; channels/propagation are shared. */
export const NODE_PROTOCOL_LAYERS = ['phy', 'mac', 'routing'] as const

/** Single precedence rule shared by validation and code generation. */
export const deviceProtocolConfigurations = (spec: ExperimentSpec, node?: ExperimentNodeSpec) => NODE_PROTOCOL_LAYERS.map((layerId) => {
  const selection = spec.stack[layerId]
  const legacy: Record<string, unknown> = 'attrs' in selection ? { ...selection.attrs } : {}
  if (layerId === 'phy') delete legacy.txPower // Historical unused shortcut, not an explicit registered override.
  return { layerId, typeId: selection.type, attributes: {
    ...nonBlankAttributes(legacy), ...nonBlankAttributes(spec.protocolAttributes?.[selection.type] || {}), ...nonBlankAttributes(node?.protocolAttributes?.[selection.type] || {}),
  } }
})
