import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import highlight from 'highlight.js/lib/core'
import { createRenderer, h, nextTick, reactive, ssrContextKey } from 'vue'

const sourceFromHighlight = (html) => {
  // Only the highlighter's span/class markup may remain executable HTML.
  for (const match of html.matchAll(/<[^>]*>/g)) {
    assert.match(match[0], /^(?:<span class="hljs-[\w -]+">|<\/span>)$/, 'source cannot introduce an HTML element or attribute')
  }
  const text = html.replace(/<span class="hljs-[\w -]+">|<\/span>/g, '')
  assert.ok(!/[<>]/.test(text), 'source angle brackets must be escaped')
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

async function checkWorkerLifecycle(server) {
  const { default: HighlightedCode } = await server.ssrLoadModule('/src/features/experiment/components/HighlightedCode.vue')
  const savedGlobals = new Map(['Worker', 'setTimeout', 'clearTimeout'].map((key) => [key, globalThis[key]]))
  const workers = []
  const timers = new Map()
  let nextTimer = 0
  let constructorFails = false
  globalThis.Worker = class {
    constructor() {
      if (constructorFails) throw new Error('Worker unavailable')
      this.terminated = false
      this.messages = []
      workers.push(this)
    }
    postMessage(message) { this.messages.push(message) }
    terminate() { this.terminated = true }
  }
  globalThis.setTimeout = (callback) => { timers.set(++nextTimer, callback); return nextTimer }
  globalThis.clearTimeout = (id) => timers.delete(id)
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const props = reactive({ code: 'int first = 1;', language: 'cpp' })
  const Component = { ...HighlightedCode, render: () => null }
  const app = renderer.createApp({ render: () => h(Component, props) })
  app.provide(ssrContextKey, { modules: new Set() })
  let mounted = false
  try {
    app.mount({}); mounted = true
    const state = app._instance.subTree.component.setupState
    const first = workers.at(-1)
    assert.deepEqual(first.messages, [{ code: props.code, language: 'cpp' }])
    assert.equal(state.highlighted, null, 'original source remains visible before the worker replies')
    props.code = '{"next": 2}'
    props.language = 'json'
    await nextTick()
    assert.equal(first.terminated, true, 'changing the source cancels the previous worker')
    const current = workers.at(-1)
    assert.deepEqual(current.messages, [{ code: props.code, language: 'json' }])
    assert.equal(workers.filter((worker) => !worker.terminated).length, 1)
    assert.equal(timers.size, 1, 'only the current worker keeps a timeout')
    first.onmessage({ data: '<span class="hljs-number">stale</span>' })
    assert.equal(state.highlighted, null, 'a late reply from a terminated worker cannot overwrite current code')
    current.onmessage({ data: '<span class="hljs-number">2</span>' })
    assert.equal(state.highlighted, '<span class="hljs-number">2</span>')
    assert.equal(current.terminated, true)
    assert.equal(timers.size, 0, 'successful work releases the worker and timeout')
    assert.equal(props.code, '{"next": 2}', 'highlight output never replaces the original source string')

    for (const event of ['onerror', 'onmessageerror']) {
      props.code += ' '
      await nextTick()
      const failed = workers.at(-1)
      failed[event]({})
      assert.equal(state.highlighted, null, `${event} keeps the plain source fallback`)
      assert.equal(failed.terminated, true)
      assert.equal(timers.size, 0)
    }
    constructorFails = true
    props.code += ' '
    await nextTick()
    assert.equal(state.highlighted, null, 'unavailable workers keep the source readable')
    assert.equal(timers.size, 0)
    constructorFails = false

    props.code += ' '
    await nextTick()
    const slow = workers.at(-1)
    const timeout = [...timers.values()][0]
    timeout()
    assert.equal(slow.terminated, true, 'timeout stops expensive highlighting work')
    slow.onmessage({ data: 'late' })
    assert.equal(state.highlighted, null, 'late completion after timeout cannot replace the fallback')
    assert.equal(timers.size, 0)

    props.code += ' '
    await nextTick()
    const cleared = workers.at(-1)
    const workerCount = workers.length
    props.code = ''
    await nextTick()
    assert.equal(cleared.terminated, true, 'clearing code cancels pending work')
    assert.equal(workers.length, workerCount, 'empty code needs no worker')
    assert.equal(state.highlighted, null)

    props.code = 'const int closing = 3;'
    await nextTick()
    const closing = workers.at(-1)
    app.unmount(); mounted = false
    assert.equal(closing.terminated, true, 'the watch created inside onMounted is disposed when the viewer closes')
    assert.equal(timers.size, 0, 'closing the viewer clears all highlighting timeouts')
    closing.onmessage({ data: 'after close' })
    assert.equal(state.highlighted, null)
  } finally {
    if (mounted) app.unmount()
    for (const [key, value] of savedGlobals) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
}

export async function checkCodeHighlight(server) {
  const registeredBefore = highlight.listLanguages()
  const { highlightCode } = await server.ssrLoadModule('/src/features/experiment/lib/highlightCode.ts')
  assert.deepEqual(highlight.listLanguages(), registeredBefore, 'local grammars do not mutate the shared highlight.js instance')

  const cpp = '#include <string>\n// 节点发送 🐟\nint main() { const std::string label = "AUV-1"; return 42; }\n'
  const cppHtml = highlightCode(cpp, 'cpp')
  for (const token of ['meta', 'comment', 'type', 'string', 'number', 'keyword']) {
    assert.match(cppHtml, new RegExp(`class="hljs-${token}`), `C++ receives a ${token} color token`)
  }
  assert.equal(sourceFromHighlight(cppHtml), cpp)

  const json = '{\n  "name": "水下节点 🐟", "enabled": true, "count": 42, "optional": null\n}\n'
  const jsonHtml = highlightCode(json, 'json')
  for (const token of ['attr', 'string', 'literal', 'number', 'punctuation']) {
    assert.match(jsonHtml, new RegExp(`class="hljs-${token}`), `JSON receives a ${token} color token`)
  }
  assert.equal(sourceFromHighlight(jsonHtml), json)

  const injection = '</code><img src=x onerror="alert(1)"><script>alert(1)</script><svg onload="alert(1)">&lt;&amp;&#x27;'
  for (const [language, source] of [
    ['cpp', `// ${injection}\nconst char* text = R"source(${injection})source";\n`],
    ['json', JSON.stringify({ payload: injection, quote: '"\'' }, null, 2)],
  ]) {
    const html = highlightCode(source, language)
    assert.ok(html.includes('&lt;'), `${language} escapes HTML-looking source`)
    assert.ok(!html.includes('<img') && !html.includes('<script') && !html.includes('<svg'))
    assert.equal(sourceFromHighlight(html), source, `${language} escapes once without changing source entities`)
  }

  const whitespace = '\ufeff\t  // 中文 e\u0301 🐟\u00a0\r\n\tconst char* value = "αβ　空格";  \n\n\t'
  const whitespaceJson = '\ufeff\r\n\t { "节点": "e\u0301 🐟\u00a0　",\r\n\t\t"n": 1 }  \n\n'
  for (const [language, source] of [['cpp', whitespace], ['json', whitespaceJson], ['cpp', ''], ['json', '\t\r\n  ']]) {
    assert.equal(sourceFromHighlight(highlightCode(source, language)), source, `${language} preserves Unicode, CRLF, tabs and trailing whitespace`)
  }

  const targetBytes = 1024 * 1024
  const cppLine = 'const auto node_id = 42; // 节点坐标、发送参数、接收状态 🐟\n'
  const largeCpp = cppLine.repeat(Math.ceil(targetBytes / Buffer.byteLength(cppLine)))
  const jsonRow = '  {"node_id":42,"name":"水下节点 🐟","enabled":true,"x":123.5}'
  const largeJson = '[\n' + Array(Math.ceil(targetBytes / Buffer.byteLength(jsonRow + ',\n'))).fill(jsonRow).join(',\n') + '\n]\n'
  const timings = []
  for (const [language, source] of [['cpp', largeCpp], ['json', largeJson]]) {
    assert.ok(Buffer.byteLength(source) >= targetBytes)
    const start = performance.now()
    const html = highlightCode(source, language)
    const duration = performance.now() - start
    assert.match(html, /class="hljs-number"/, 'large input remains highlighted instead of silently becoming plain text')
    assert.equal(sourceFromHighlight(html), source, 'large highlighted output preserves the complete source')
    // A broad ceiling catches pathological regressions without depending on
    // frame timing; production work runs off the main thread with its own timeout.
    assert.ok(duration < 10_000, `${language} ~1 MB highlighting took ${duration.toFixed(0)} ms`)
    timings.push(`${language}: ${Buffer.byteLength(source)} bytes / ${duration.toFixed(0)} ms`)
  }
  await checkWorkerLifecycle(server)
  console.log(`Code highlighting regressions passed: tokens, escaping, Unicode/whitespace, worker cancellation/failure/timeout/cleanup and large input (${timings.join('; ')}).`)
}
