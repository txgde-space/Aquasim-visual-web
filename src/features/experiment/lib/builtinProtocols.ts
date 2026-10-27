import { TERRESTRIAL_RADIO_CC } from './terrestrialRadio'

/** Source packages are compiled and discovered through the same TypeId probe as installed models. */
export const BUILTIN_PROTOCOL_SOURCES = [
  { path: 'builtin/terrestrial-radio.cc', code: TERRESTRIAL_RADIO_CC },
]

export const BUILTIN_PROTOCOL_CC = BUILTIN_PROTOCOL_SOURCES.map((source) => source.code).join('\n')
