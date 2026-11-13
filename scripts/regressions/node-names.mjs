import assert from 'node:assert/strict'
import { createRenderer, h, nextTick, reactive, ssrContextKey } from 'vue'
import { renderToString } from '@vue/server-renderer'

export async function checkNodeNames(server) {
  const { default: Editor } = await server.ssrLoadModule('/src/features/canvas2d/NodeNameEditor.vue')
  const html = await renderToString(h(Editor, { nodeId: 7, name: '接收端', editable: true }))
  assert.match(html, /Node 7/)
  assert.match(html, /接收端/)
  assert.match(html, /修改节点名称/)
  const readonly = await renderToString(h(Editor, { nodeId: 7, name: '接收端', editable: false }))
  assert.doesNotMatch(readonly, /修改节点名称/, 'ordinary replay cannot edit original log names')
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null,
  })
  const changes = []
  const props = reactive({ nodeId: 7, name: '接收端', editable: true })
  const View = { ...Editor, render: () => null }
  const app = renderer.createApp({ render: () => h(View, { ...props, onChange: (...args) => changes.push(args) }) })
  app.provide(ssrContextKey, { modules: new Set() })
  app.mount({})
  const state = app._instance.subTree.component.setupState
  const key = (value, extra = {}) => ({ key: value, prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true }, ...extra })
  try {
    state.beginEdit(); state.draft = '  中继备注  '
    state.onKeydown(key('Enter', { isComposing: true }))
    assert.deepEqual(changes, [], 'IME confirmation never saves a half-composed name')
    assert.equal(state.editing, true)
    state.onKeydown(key('Enter'))
    assert.deepEqual(changes, [[7, '中继备注']], 'saving carries the original node ID and trimmed remark')
    state.beginEdit(); state.draft = '取消的名字'
    const escape = key('Escape'); state.onKeydown(escape)
    assert.equal(state.editing, false)
    assert.ok(escape.prevented && escape.stopped, 'Escape cancels the name edit without closing the card or canvas tools')
    assert.equal(changes.length, 1)
    state.beginEdit(); state.draft = ' '
    state.save()
    assert.deepEqual(changes.at(-1), [7, 'Node-7'], 'clearing the remark keeps a usable name without changing node identity')
    state.beginEdit(); state.draft = '不应保存到下一个节点'
    props.nodeId = 8
    await nextTick()
    assert.equal(state.editing, false, 'switching cards discards unfinished edits')
    props.editable = false
    await nextTick()
    state.beginEdit()
    assert.equal(state.editing, false, 'busy/read-only canvases cannot start renaming')
  } finally { app.unmount() }
  console.log('Node name regressions passed: visible ID, pencil editor, save/cancel, IME guard, card switching and read-only behavior.')
}
