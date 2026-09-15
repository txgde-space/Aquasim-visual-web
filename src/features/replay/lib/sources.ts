import netLogDefaultText from '@/assets/net.json?raw'
import netLogMultiHopText from '@/assets/net_multihop.json?raw'
import netLogMultiHopComplexText from '@/assets/net_multihop_complex.json?raw'
import netLogChainNoConflictText from '@/assets/net_chain_5_no_conflict.log?raw'
import netLogSwarmText from '@/assets/net-swarm.json?raw'
import netLogMovingText from '@/assets/net_moving.json?raw'

export interface LogSource {
  label: string
  fileName: string
  raw: string
}

export const LOG_SOURCES: Readonly<Record<string, LogSource>> = Object.freeze({
  default: {
    label: '默认示例',
    fileName: 'net.json',
    raw: netLogDefaultText,
  },
  multihop: {
    label: '多跳转发',
    fileName: 'net_multihop.json',
    raw: netLogMultiHopText,
  },
  complex: {
    label: '复杂冲突',
    fileName: 'net_multihop_complex.json',
    raw: netLogMultiHopComplexText,
  },
  chainNoConflict: {
    label: '链式无冲突',
    fileName: 'net_chain_5_no_conflict.log',
    raw: netLogChainNoConflictText,
  },
  swarm: {
    label: '集群',
    fileName: 'net-swarm.json',
    raw: netLogSwarmText,
  },
  moving: {
    label: '移动节点',
    fileName: 'net_moving.json',
    raw: netLogMovingText,
  },
})
