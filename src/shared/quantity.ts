/** Pure quantity parsing. Units are case-sensitive where case changes meaning (b/B, m/M). */
interface Unit { dimension: string; scale: number; symbol: string }
const units: Record<string, Unit> = Object.create(null)
const register = (dimension: string, symbol: string, scale: number, aliases: string[] = []) => {
  for (const key of [symbol, ...aliases]) units[key] = { dimension, scale, symbol }
}
for (const [symbol, scale, aliases] of [
  ['fs', 1e-15, ['femtosecond', 'femtoseconds']], ['ps', 1e-12, ['picosecond', 'picoseconds']],
  ['ns', 1e-9, ['nanosecond', 'nanoseconds']], ['us', 1e-6, ['µs', 'μs', 'microsecond', 'microseconds']],
  ['ms', 1e-3, ['millisecond', 'milliseconds']], ['s', 1, ['sec', 'second', 'seconds']], ['min', 60, ['minute', 'minutes']],
  ['h', 3600, ['hour', 'hours']], ['d', 86400, ['day', 'days']], ['y', 31536000, ['year', 'years']],
] as [string, number, string[]][]) register('time', symbol, scale, aliases)
for (const [symbol, scale, aliases] of [
  ['mm', .001, ['millimeter', 'millimeters', 'millimetre', 'millimetres']], ['cm', .01, ['centimeter', 'centimeters', 'centimetre', 'centimetres']],
  ['m', 1, ['meter', 'meters', 'metre', 'metres']], ['km', 1000, ['kilometer', 'kilometers', 'kilometre', 'kilometres']],
] as [string, number, string[]][]) register('length', symbol, scale, aliases)
for (const [symbol, scale] of [['Hz', 1], ['kHz', 1000], ['MHz', 1e6], ['GHz', 1e9]] as const) register('frequency', symbol, scale, [symbol.toLowerCase()])
for (const [symbol, scale] of [['W', 1], ['mW', .001], ['uW', 1e-6], ['kW', 1000]] as const) register('power', symbol, scale)
for (const [symbol, scale] of [['J', 1], ['mJ', .001], ['kJ', 1000]] as const) register('energy', symbol, scale)
register('speed', 'm/s', 1); register('speed', 'km/s', 1000)
register('temperature', '°C', 1, ['C']); register('salinity', 'ppt', 1)
register('ratio-db', 'dB', 1); register('power-db', 'dBm', 1)
for (const [prefix, scale] of [['', 1], ['k', 1000], ['M', 1e6], ['G', 1e9]] as const) {
  register('rate', `${prefix}bps`, scale, [`${prefix}bit/s`, `${prefix}b/s`])
  register('rate', `${prefix}Bps`, scale * 8, [`${prefix}B/s`])
  register('size', `${prefix}B`, scale, prefix ? [] : ['byte', 'bytes'])
}
register('size', 'KiB', 1024); register('size', 'MiB', 1024 ** 2)
register('rate', 'Kbps', 1000, ['Kb/s', 'Kbit/s']); register('rate', 'KBps', 8000, ['KB/s'])
register('size', 'KB', 1000)
for (const [prefix, scale] of [['Ki', 1024], ['Mi', 1024 ** 2], ['Gi', 1024 ** 3]] as const) {
  register('rate', `${prefix}b/s`, scale, [`${prefix}bps`, `${prefix}bit/s`])
  register('rate', `${prefix}B/s`, scale * 8, [`${prefix}Bps`])
}
register('size', 'GiB', 1024 ** 3)
export const QUANTITY_NUMBER = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?'
const pattern = new RegExp(`^(${QUANTITY_NUMBER})\\s*(.*?)$`, 'i')
export const canonicalUnit = (unit: string): string | null => units[unit.trim()]?.symbol ?? null
export const isBareNumber = (text: string): boolean => new RegExp(`^${QUANTITY_NUMBER}$`, 'i').test(text.trim())
// Unit factors are finite decimal constants. Multiply their decimal representations
// exactly before converting to Number, so 1.001 kbps becomes 1001, not 1000.999… .
const decimalParts = (text: string): { coefficient: bigint; exponent: number } => {
  const [mantissa, power = '0'] = text.toLowerCase().split('e')
  const fraction = mantissa!.split('.')[1]?.length ?? 0
  const coefficient = BigInt(mantissa!.replace('.', ''))
  const exponent = Number(power) - fraction
  if (coefficient !== 0n && (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10000)) {
    throw new Error('数值超出有效范围')
  }
  return { coefficient, exponent: coefficient === 0n ? 0 : exponent }
}
const scaledDecimal = (text: string, numerator: number, denominator: number, requireInteger = false): number => {
  const input = decimalParts(text), top = decimalParts(String(numerator)), bottom = decimalParts(String(denominator))
  let coefficient = input.coefficient * top.coefficient
  let divisor = bottom.coefficient
  let a = coefficient < 0n ? -coefficient : coefficient, b = divisor
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder }
  coefficient /= a; divisor /= a
  let exponent = input.exponent + top.exponent - bottom.exponent
  if (requireInteger) {
    const remainder = exponent >= 0
      ? (coefficient * 10n ** BigInt(exponent)) % divisor
      : coefficient % (divisor * 10n ** BigInt(-exponent))
    if (remainder !== 0n) throw new Error('换算后的数值必须是整数')
  }
  // Finite decimal factors can be represented without floating-point multiplication.
  let twos = 0, fives = 0
  while (divisor % 2n === 0n) { divisor /= 2n; twos++ }
  while (divisor % 5n === 0n) { divisor /= 5n; fives++ }
  if (divisor !== 1n) return Number(text) * numerator / denominator
  const digits = Math.max(twos, fives)
  coefficient *= 2n ** BigInt(digits - twos) * 5n ** BigInt(digits - fives)
  exponent -= digits
  const value = Number(`${coefficient}e${exponent}`)
  if (coefficient !== 0n && value === 0) throw new Error('数值小于可表示的范围')
  return value
}
export const parseQuantity = (input: unknown, defaultUnit: string, requireInteger = false): { value: number; unit: string } => {
  const base = units[defaultUnit.trim()]
  if (!base) throw new Error(`不支持的单位：${defaultUnit}`)
  const match = typeof input === 'string' || typeof input === 'number' ? String(input).trim().match(pattern) : null
  if (!match) throw new Error(`请输入有效数值，省略单位按 ${base.symbol}`)
  const requested = match[2] || defaultUnit
  // Preserve historical uppercase time and display-distance input spellings.
  const unit = units[requested] || (['time', 'length'].includes(base.dimension) ? units[requested.toLowerCase()] : undefined)
  if (!unit || unit.dimension !== base.dimension) throw new Error(`单位 ${requested} 无效，需要 ${base.symbol} 或同类单位`)
  const value = scaledDecimal(match[1], unit.scale, base.scale, requireInteger)
  if (!Number.isFinite(value)) throw new Error('数值超出有效范围')
  return { value, unit: base.symbol }
}

/** Safe canonical decimal for scientific/fractional integer spellings; plain integer strings retain precision. */
export const integerLiteral = (text: string): string => {
  const value = text.trim()
  if (!isBareNumber(value)) throw new Error('请输入有效整数')
  if (/^[+-]?\d+$/.test(value)) return value
  const number = scaledDecimal(value, 1, 1, true)
  if (!Number.isSafeInteger(number)) throw new Error('数值必须是安全范围内的整数')
  return String(number)
}
