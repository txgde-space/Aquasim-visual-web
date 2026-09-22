import type { Plugin } from 'vite'
import { precompileSimulatorGuarded, readJsonBody, runExperimentGuarded } from './runner'
import { browseSimulatorDirectories, inspectSimulator } from './simulatorConfig'
import { cachedCatalog } from './protocolCatalog'

/**
 * Thin middleware: routing, body reading and unified error shape only.
 * All run logic lives in runner.ts.
 */
export const ns3RunPlugin = (): Plugin => ({
  name: 'ns3-run',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'POST' || !['/api/run', '/api/simulator/check', '/api/simulator/directories', '/api/simulator/build'].includes(req.url || '')) {
        next()
        return
      }
      res.setHeader('Content-Type', 'application/json')
      try {
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('请求体必须是 JSON 对象')
        }
        const request = body as Record<string, unknown>
        if (request.aquaSimHome !== undefined && typeof request.aquaSimHome !== 'string') {
          throw new Error('仿真目录必须是字符串')
        }
        if (req.url === '/api/simulator/directories') {
          res.end(JSON.stringify(await browseSimulatorDirectories(request.aquaSimHome)))
          return
        }
        if (req.url === '/api/simulator/check') {
          const config = inspectSimulator(request.aquaSimHome)
          res.statusCode = config.ok ? 200 : 400
          res.end(JSON.stringify({ ...config, catalog: config.ok ? cachedCatalog(config.home) : null }))
          return
        }
        if (req.url === '/api/simulator/build') {
          const { status, payload } = await precompileSimulatorGuarded(request.aquaSimHome)
          res.statusCode = status
          res.end(JSON.stringify(payload))
          return
        }
        // Keep accepting the original bare ExperimentSpec request body.
        const spec = 'spec' in request ? request.spec : request
        if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
          throw new Error('缺少有效的实验配置')
        }
        const { status, payload } = await runExperimentGuarded(spec, request.aquaSimHome)
        res.statusCode = status
        res.end(JSON.stringify(payload))
      } catch (error) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: String((error as { message?: unknown })?.message || error) }))
      }
    })
  },
})
