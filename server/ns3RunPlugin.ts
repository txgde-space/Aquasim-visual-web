import type { Plugin } from 'vite'
import { readJsonBody, runExperimentGuarded } from './runner'

/**
 * Thin middleware: routing, body reading and unified error shape only.
 * All run logic lives in runner.ts.
 */
export const ns3RunPlugin = (): Plugin => ({
  name: 'ns3-run',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'POST' || req.url !== '/api/run') {
        next()
        return
      }
      res.setHeader('Content-Type', 'application/json')
      try {
        const spec = await readJsonBody(req)
        const { status, payload } = await runExperimentGuarded(spec)
        res.statusCode = status
        res.end(JSON.stringify(payload))
      } catch (error) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: String((error as { message?: unknown })?.message || error) }))
      }
    })
  },
})
