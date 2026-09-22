import fs from 'node:fs'
import path from 'node:path'
import type { ExperimentSpec } from '../src/shared/types/experiment'

/** Check required external resources before starting a simulation. */
export const checkProtocolRequirements = (home: string, spec: ExperimentSpec) => {
  const executable = (relative: string) => {
    try { fs.accessSync(path.join(home, relative), fs.constants.X_OK) }
    catch { throw new Error(`所选传播模型需要可执行文件：${path.join(home, relative)}`) }
  }
  const file = (relative: string) => {
    try { fs.accessSync(path.join(home, relative), fs.constants.R_OK | fs.constants.W_OK) }
    catch { throw new Error(`所选传播模型需要可读写的环境文件：${path.join(home, relative)}`) }
  }
  if (spec.channel?.propagation === 'ns3::AquaSimBellhopPropagation') {
    executable('bellhop/bellhop.exe')
    for (const node of spec.nodes) {
      file(`bellhop/${node.id}shd.env`)
      file(`bellhop/${node.id}arr.env`)
    }
  }
  if (spec.channel?.propagation === 'ns3::AquaSimBellhop3DPropagation') {
    executable('bellhop3D/bellhop3d.exe')
    for (const node of spec.nodes) file(`bellhop3D/${node.id}.env`)
  }
  if (spec.stack?.phy?.type === 'ns3::AquaSimPhyModem') {
    const device = spec.protocolAttributes?.['ns3::AquaSimPhyModem']?.devName || '/dev/ttyUSB0'
    try {
      if (!fs.statSync(device).isCharacterDevice()) throw new Error('not a serial device')
      fs.accessSync(device, fs.constants.R_OK | fs.constants.W_OK)
    } catch { throw new Error(`Phy Modem 需要可读写的串口调制解调器，请配置 devName：${device}`) }
  }
}
