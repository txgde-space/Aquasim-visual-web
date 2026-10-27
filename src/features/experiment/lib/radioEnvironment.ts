import { DEFAULT_RADIO_PROPAGATION_SPEED_MPS } from '../../../shared/constants'

// Built-in model identifiers are presentation constants, not selection/compatibility rules.
export const RADIO_PROPAGATION_SPEED_MPS = DEFAULT_RADIO_PROPAGATION_SPEED_MPS
export const RADIO_TYPE_IDS = {
  phy: 'ns3::AquaSimRadioPhy',
  channel: 'ns3::AquaSimRadioChannel',
  propagation: 'ns3::AquaSimRadioPropagation',
} as const
