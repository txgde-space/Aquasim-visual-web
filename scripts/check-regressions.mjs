import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { checkBuildReuse } from './regressions/build-reuse.mjs'
import { checkGpsMap } from './regressions/gps-map.mjs'
import { checkReplay } from './regressions/replay.mjs'
import { checkReceiveTrace } from './regressions/receive-trace.mjs'
import { checkReplayNodeFilter } from './regressions/replay-node-filter.mjs'
import { checkReplayResume } from './regressions/replay-resume.mjs'
import { checkSceneAssets } from './regressions/scene-assets.mjs'
import { checkRadioReplay } from './regressions/replay-radio.mjs'
import { checkCanvas } from './regressions/canvas.mjs'
import { checkCanvasEscape } from './regressions/canvas-escape.mjs'
import { checkCanvasSelection } from './regressions/canvas-selection.mjs'
import { checkNodeSnapping } from './regressions/node-snapping.mjs'
import { checkSnapGuides } from './regressions/snap-guides.mjs'
import { checkCanvasSnapping } from './regressions/canvas-snapping.mjs'
import { checkReplayEditSelection } from './regressions/replay-edit-selection.mjs'
import { checkRequests } from './regressions/requests.mjs'
import { checkExperimentRegressions } from './regressions/experiment.mjs'
import { checkServer } from './regressions/server.mjs'
import { checkVirtualList } from './regressions/virtual-list.mjs'
import { checkSceneLoading } from './regressions/scene-loading.mjs'
import { checkProtocolSourceClient } from './regressions/protocol-source-client.mjs'
import { checkCodeHighlight } from './regressions/code-highlight.mjs'
import { checkSimulatorDiagnostics } from './regressions/simulator-diagnostics.mjs'
import { checkNodePositioning } from './regressions/node-positioning.mjs'
import { checkNodeRanges } from './regressions/node-ranges.mjs'
import { checkNodeProtocols } from './regressions/node-protocols.mjs'
import { checkCanvasState } from './regressions/canvas-state.mjs'
import { checkParameterUnits } from './regressions/parameter-units.mjs'
import { checkNodeNames } from './regressions/node-names.mjs'
import { checkNodeModelPersistence } from './regressions/node-model-persistence.mjs'
import { checkNodeModelMeshes } from './regressions/node-model-meshes.mjs'
import { checkNodeModels2D } from './regressions/node-models-2d.mjs'
import { checkReplayNodeModels } from './regressions/replay-node-models.mjs'
import { checkMovementPlayback } from './regressions/movement-playback.mjs'
import { checkNodeMobilityEditor } from './regressions/node-mobility-editor.mjs'
import { checkMobilityBackend } from './regressions/mobility-backend.mjs'
import { checkOceanEnvironment } from './regressions/ocean-environment.mjs'
import { checkSceneNavigation } from './regressions/scene-navigation.mjs'
import { checkPacketEffects } from './regressions/packet-effects.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const cacheDir = mkdtempSync(path.join(tmpdir(), 'aquasim-regressions-'))
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const storage = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
})
// Use the existing compiler and Vue runtime, without opening a port or adding a test framework.
const server = await createServer({
  root,
  configFile: false,
  cacheDir,
  plugins: [vue()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
  logLevel: 'error',
})
try {
  console.log(await checkExperimentRegressions((file) => server.ssrLoadModule(file)))
  await checkParameterUnits(server)
  await checkNodeProtocols(server)
  await checkNodeNames(server)
  await checkNodeModelPersistence(server)
  await checkNodeModelMeshes(server)
  await checkNodeModels2D(server)
  await checkReplayNodeModels(server)
  await checkMovementPlayback(server)
  await checkNodeMobilityEditor(server)
  await checkMobilityBackend(server)
  await checkOceanEnvironment(server)
  await checkSceneNavigation(server)
  await checkPacketEffects(server)
  await checkSimulatorDiagnostics(server)
  await checkCanvasState(server)
  await checkNodePositioning(server)
  await checkReplay(server, root)
  await checkRadioReplay(server)
  await checkReceiveTrace(server)
  await checkReplayNodeFilter(server)
  await checkReplayResume(server)
  await checkSceneAssets(server)
  await checkGpsMap(server)
  await checkCanvas(server)
  await checkNodeRanges(server)
  await checkCanvasEscape(server)
  await checkCanvasSelection(server)
  await checkNodeSnapping(server)
  await checkSnapGuides(server)
  await checkCanvasSnapping(server)
  await checkReplayEditSelection(server)
  await checkSceneLoading(server)
  await checkVirtualList(server)
  await checkRequests(server)
  await checkProtocolSourceClient(server)
  await checkCodeHighlight(server)
  await checkBuildReuse(server)
  await checkServer(server)
} finally {
  await server.close()
  rmSync(cacheDir, { recursive: true, force: true })
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
  else delete globalThis.localStorage
}
