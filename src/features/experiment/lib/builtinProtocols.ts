import { OBSERVED_SIGNAL_CACHE_CC } from './observedSignalCache'
import { SIMPLE_UNDERWATER_PHY_CC } from './simpleUnderwaterPhy'
import { TERRESTRIAL_RADIO_CC } from './terrestrialRadio'
import { VECTOR_BASED_FORWARDING_CC } from './vectorBasedForwarding'
import { LINEAR_MOBILITY_CC } from './linearMobility'

/** Source packages are compiled and discovered through the same TypeId probe as installed models. */
export const BUILTIN_PROTOCOL_SOURCES = [
  { path: 'builtin/observed-signal-cache.cc', code: OBSERVED_SIGNAL_CACHE_CC },
  { path: 'builtin/aqua-sim-phy-simple.cc', code: SIMPLE_UNDERWATER_PHY_CC },
  { path: 'builtin/terrestrial-radio.cc', code: TERRESTRIAL_RADIO_CC },
  { path: 'builtin/aqua-sim-routing-vbf.cc', code: VECTOR_BASED_FORWARDING_CC },
  { path: 'builtin/aqua-visual-linear-mobility.cc', code: LINEAR_MOBILITY_CC },
]

export const BUILTIN_PROTOCOL_CC = BUILTIN_PROTOCOL_SOURCES.map((source) => source.code).join('\n')
