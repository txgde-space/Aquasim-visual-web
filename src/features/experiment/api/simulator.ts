type SimulatorEndpoint = 'run' | `simulator/${'check' | 'directories' | 'build' | 'build-progress' | 'clean' | 'source'}`

/** Shared HTTP boundary for the dev-only simulator API. */
export const requestSimulator = async <T>(endpoint: SimulatorEndpoint, body: unknown, signal?: AbortSignal) => {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('仿真服务不可用，请通过 yarn dev 启动服务。')
  }
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('仿真服务返回了无效响应')
  }
  return { ok: response.ok, status: response.status, data: data as T }
}
