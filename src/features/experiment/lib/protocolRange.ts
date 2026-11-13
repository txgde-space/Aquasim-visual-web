import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { catalogItemById, type CatalogLayer } from './typeIdCatalog'

import { attributeLiteral, nonBlankAttributes } from './protocolUnits'

/** Use the selected PHY's registered range interface, without protocol-name assumptions. */
export const protocolRange = (form: ExperimentForm, layers: CatalogLayer[], node?: Pick<TopologyNode, 'protocolAttributes'>): number | null => {
  const phy = catalogItemById('phy', form.phyId, layers)
  const attr = phy?.attributes?.find((attribute) => attribute.name === 'transRange')
  if (!phy || !attr) return null
  const input = nonBlankAttributes(node?.protocolAttributes?.[phy.typeId] || {})[attr.name] ?? nonBlankAttributes(form.protocolAttributes?.[phy.typeId] || {})[attr.name] ?? attr.defaultValue
  try {
    const value = Number(attributeLiteral(attr, input))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch { return null }
}
