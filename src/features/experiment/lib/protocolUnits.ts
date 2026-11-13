import { canonicalUnit, integerLiteral, isBareNumber, parseQuantity } from '../../../shared/quantity'
import type { ProtocolAttribute } from './typeIdCatalog'

const scalarTypes = ['ns3::DoubleValue', 'ns3::IntegerValue', 'ns3::UintegerValue']
export const isNumericAttribute = (attr: ProtocolAttribute): boolean => scalarTypes.includes(attr.valueType)

/** Only registered types and explicit unit declarations carry executable unit semantics. */
export const attributeUnit = (attr: ProtocolAttribute): string | null => {
  if (attr.valueType === 'ns3::TimeValue') return 's'
  if (attr.valueType === 'ns3::DataRateValue') return 'bps'
  if (!isNumericAttribute(attr) && attr.valueType !== 'ns3::Vector3DValue') return null
  const help = attr.help || ''
  const explicit = [...help.matchAll(/\[unit\s*=\s*([^\]]+)\]/gi)]
  if (explicit.length) {
    const values = explicit.map((match) => canonicalUnit(match[1]!))
    return values[0] && values.every((value) => value === values[0]) ? values[0] : null
  }
  const found = new Set<string>()
  // Bracketed units, or unambiguous "in meters" / "in bytes" declarations only.
  for (const match of help.matchAll(/\(([^()]+)\)|\[([^\[\]]+)\]|\bin\s+(meters?|metres?|seconds?|milliseconds?|bytes?)(?=\s*(?:[.;,]|$))/gi)) {
    const unit = canonicalUnit(match[1] || match[2] || match[3])
    if (unit) found.add(unit)
  }
  return found.size === 1 ? [...found][0]! : null
}

export const nonBlankAttributes = (attributes: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(
  Object.entries(attributes).filter(([, value]) => typeof value !== 'string' || value.trim() !== ''),
)

export const attributeLiteral = (attr: ProtocolAttribute, input: unknown): string => {
  const text = String(input).trim()
  if ((isNumericAttribute(attr) || attr.valueType === 'ns3::TimeValue' || attr.valueType === 'ns3::DataRateValue')
    && typeof input !== 'string' && typeof input !== 'number') throw new Error('请输入有效数值')
  const unit = attributeUnit(attr)
  if (attr.valueType === 'ns3::TimeValue') {
    // Time's signed nanosecond range; checker-specific limits remain in ns-3.
    const seconds = parseQuantity(text, 's').value
    if (Math.abs(seconds) > 9_223_372_036) throw new Error('超出仿真时钟可表示的范围')
    const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]*)$/i)!
    return `${match[1].toLowerCase()}${canonicalUnit((match[2] || 's').toLowerCase()) || 's'}`
  }
  if (attr.valueType === 'ns3::Vector3DValue' && unit) {
    const parts = text.split(':')
    if (parts.length !== 3) throw new Error('向量需要 x:y:z 三个分量')
    return parts.map((part) => String(parseQuantity(part, unit).value)).join(':')
  }
  if (unit) {
    const integer = ['ns3::IntegerValue', 'ns3::UintegerValue'].includes(attr.valueType)
    const value = parseQuantity(text, unit, integer || attr.valueType === 'ns3::DataRateValue').value
    if (['ns3::IntegerValue', 'ns3::UintegerValue', 'ns3::DataRateValue'].includes(attr.valueType)
      && !Number.isSafeInteger(value) && !(isBareNumber(text) && /^[+-]?\d+$/.test(text))) {
      throw new Error(`换算到 ${unit} 后必须是安全范围内的整数`)
    }
    if (attr.valueType === 'ns3::DataRateValue') {
      if (value < 0) throw new Error('速率必须非负')
      return `${isBareNumber(text) && /^[+]?\d+$/.test(text) ? text.replace(/^\+/, '') : value}bps`
    }
    if (integer) return isBareNumber(text) ? integerLiteral(text) : String(value)
    return isBareNumber(text) ? text : String(value)
  }
  if (isNumericAttribute(attr)) {
    if (!isBareNumber(text)) throw new Error('注册信息未声明单位，请填写纯数字')
    if (['ns3::IntegerValue', 'ns3::UintegerValue'].includes(attr.valueType)) return integerLiteral(text)
    if (!Number.isFinite(Number(text))) throw new Error('数值超出有效范围')
  }
  return String(input)
}

export const attributeInputHint = (attr: ProtocolAttribute): string => {
  const unit = attributeUnit(attr)
  if (unit) return `${attr.valueType === 'ns3::Vector3DValue' ? 'x:y:z · ' : ''}省略单位按 ${unit === 'bps' ? 'bit/s' : unit}`
  return isNumericAttribute(attr) ? '按注册数值填写，单位未声明' : ''
}

export const attributeDisplayValue = (attr: ProtocolAttribute, value: string): string => {
  const unit = attributeUnit(attr)
  return unit && isBareNumber(value) ? `${value} ${unit === 'bps' ? 'bit/s' : unit}` : value
}
