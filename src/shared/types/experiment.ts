import type { Point3D } from './replay'

export interface ExperimentForm {
  macId: string
  phyId: string
  routingId: string
  channelId: string
  propagationId: string
  simStop: string
  transRange: number
  txPower: number
  slotNum: number
  slotLen: string
  initialRoundDelay: string
  trafficId: string
  trafficSrc: number
  trafficDst: number
  trafficRateBps: number
  trafficPkt: number
  trafficStart: string
  trafficStop: string
}

export interface TopologyNode extends Point3D {
  node_id: number
  name: string
  role: string
  phyId: string
  macId: string
  routingId: string
  appId: string
}

export interface ExperimentNodeSpec extends Point3D {
  id: number
  name: string
  role: string
  app: string
}

export type ExperimentTraffic =
  | { preset: 'none' }
  | {
      preset: string
      src: number
      dst: number
      rate_bps: number
      pkt: number
      start: string
      stop: string
    }

export interface ExperimentSpec {
  schema: 'aqua-sim-experiment/v0'
  simStop: string
  channel: {
    type: string
    propagation: string
  }
  stack: {
    phy: {
      type: string
      attrs: {
        transRange: number
        txPower: number
      }
    }
    mac: {
      type: string
      attrs: Record<string, unknown>
    }
    routing: { type: string }
  }
  nodes: ExperimentNodeSpec[]
  traffic: ExperimentTraffic
}

export type ValidationWarning = string
