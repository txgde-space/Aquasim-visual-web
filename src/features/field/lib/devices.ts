export type FieldDevice = 'gps' | 'atomic'
export interface SerialPreferences {
  port: string
  baudRate: number
  dataBits: number
  stopBits: number
  parity: 'none' | 'even' | 'odd'
  pollIntervalMs: number
}
export interface DeviceStatus {
  connected: boolean
  port?: string
  baudRate?: number
  dataBits?: number
  stopBits?: number
  parity?: string
  pollIntervalMs?: number
  utcTime?: string
  validTime?: boolean
  lastReceivedAt?: string
  stale?: boolean
  error?: string
}
export interface GPSStatus extends DeviceStatus {
  fixValid?: boolean
  latitude?: number
  longitude?: number
  fixQuality?: number
  satellites?: number
  altitudeM?: number
  hdop?: number
}
export interface AtomicStatus extends DeviceStatus {
  raw?: string
  lastSync?: { source: string; sentAt: string; targetUtcTime: string; state: string }
}
export interface FieldStatus {
  ok: true
  systemTime: string
  gps: GPSStatus
  atomic: AtomicStatus
}
export const defaultSerialPreferences = (): Record<FieldDevice, SerialPreferences> => ({
  gps: { port: '', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', pollIntervalMs: 1000 },
  atomic: { port: '', baudRate: 57600, dataBits: 8, stopBits: 1, parity: 'none', pollIntervalMs: 1000 },
})
export const serialPreferenceError = (value: SerialPreferences): string => {
  if (!value.port.trim()) return '请填写或选择运行服务的机器上的串口。'
  if (!Number.isInteger(value.baudRate) || value.baudRate < 300 || value.baudRate > 4_000_000) return '波特率必须是 300–4000000 的整数。'
  if (![5, 6, 7, 8].includes(value.dataBits)) return '数据位必须为 5、6、7 或 8。'
  if (![1, 2].includes(value.stopBits)) return '停止位必须为 1 或 2。'
  if (!['none', 'even', 'odd'].includes(value.parity)) return '校验位设置无效。'
  if (!Number.isInteger(value.pollIntervalMs) || value.pollIntervalMs < 200 || value.pollIntervalMs > 60_000) return '查询间隔必须为 200–60000 ms。'
  return ''
}
export const readSerialPreferences = (raw: string | null): Record<FieldDevice, SerialPreferences> => {
  const result = defaultSerialPreferences()
  if (!raw) return result
  try {
    const saved = JSON.parse(raw)
    for (const device of ['gps', 'atomic'] as const) {
      const candidate = saved?.[device]
      if (!candidate || typeof candidate.port !== 'string') continue
      const value = { port: candidate.port, baudRate: candidate.baudRate, dataBits: candidate.dataBits,
        stopBits: candidate.stopBits, parity: candidate.parity, pollIntervalMs: candidate.pollIntervalMs }
      // An empty port is a valid preference, but never a valid connection request.
      if (!serialPreferenceError({ ...value, port: value.port || 'unselected' })) result[device] = value
    }
  } catch { /* Invalid saved preferences never establish a connection. */ }
  return result
}
export const utcLabel = (value?: string): string => {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  return new Date(value).toISOString().replace('T', ' ').replace('Z', '')
}
export const deviceLabel = (device: DeviceStatus | undefined, serviceError: string): string => {
  if (serviceError) return '服务未连接'
  if (!device?.connected) return '未连接'
  if (device.stale) return '数据过期'
  if (device.error) return '数据异常'
  return device.lastReceivedAt ? '已连接' : '等待数据'
}
