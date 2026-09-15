export interface Point3D {
  x: number
  y: number
  z?: number
}

export type ReceiverStatus = 'ok' | 'fail'

export interface ReplayReceiver {
  receiver_id: string
  dst: number
  status: ReceiverStatus
  reason: string | null
  with: string[]
  rx_start_us: number
  rx_duration_us: number
  rx_end_us: number
  delay_us?: number
  simulated?: boolean
  [key: string]: unknown
}

export interface ReplayPacket {
  type: 'packet'
  eventId: string
  packet_id: string
  src: number
  tx_committed: boolean
  tx_blocked_reason: string | null
  tx_start_us: number
  tx_duration_us: number
  tx_end_us: number
  timeStart: number
  timeEnd: number
  receivers: ReplayReceiver[]
  simulated?: boolean
  [key: string]: unknown
}

export interface Movement extends Point3D {
  [key: string]: unknown
  type: 'movement'
  node_id: number
  start: Point3D
  end: Point3D
  start_us: number
  end_us: number
  duration_us: number
}

export interface ReplayNode extends Point3D {
  [key: string]: unknown
  node_id: number
  name: string
  role: string
  phyId?: string
  macId?: string
  routingId?: string
  appId?: string
}

export type NodeVisualMode = 'idle' | 'tx' | 'rx' | 'rx-done' | 'collision' | 'collision-linger'

export interface NodeVisual {
  node_id: number
  mode: NodeVisualMode
  fillProgress: number
  fade?: number
  overlay: { kind: string;[key: string]: unknown } | null
  statusText: string
  packetId: string | null
}
