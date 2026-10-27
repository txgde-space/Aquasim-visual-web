import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'

export async function checkReplayEditSelection(server) {
  const { useReplayState } = await server.ssrLoadModule('/src/features/replay/composables/useReplayState.ts')
  const { useEditMode } = await server.ssrLoadModule('/src/features/replay/composables/useEditMode.ts')
  const { parseLog } = await server.ssrLoadModule('/src/features/replay/lib/logParser.ts')
  const scope = effectScope()
  const snapshot = (value) => JSON.parse(JSON.stringify(value))
  const input = (value) => ({ target: { value: String(value) } })
  const playback = {
    currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null),
    pauseForTool() { this.isPlaying.value = false },
  }
  let entries = 0
  try {
    const state = scope.run(() => useReplayState({ playback }))
    const edit = scope.run(() => useEditMode({ state, playback, onEnterEdit: () => { entries++ } }))
    const parsed = parseLog(JSON.stringify({
      nodes: [
        { node_id: 0, x: 0, y: 0, z: 0, movements: [{ start_us: 0, end_us: 1000000, to_x: 100, to_y: 0, to_z: 0 }] },
        { node_id: 1, x: 1000, y: 0, z: 10 },
        { node_id: 2, x: 2000, y: 100, z: 20 },
      ],
      packets: [{ packet_id: 'packet', src: 0, tx_start_us: 0, tx_duration_us: 100000,
        receivers: [{ dst: 2, rx_start_us: 1500000, rx_duration_us: 100000, status: 'ok' }] }],
    }))
    state.applyParsedLog(parsed)
    const originalLogNodes = snapshot(state.baseNodesState.value)
    const originalLogPackets = snapshot(state.sourcePacketRows.value)
    const originalMovements = snapshot(state.nodeMovementRows.value)
    playback.currentTime.value = 500000
    edit.enterEditMode()
    assert.equal(entries, 1)
    assert.deepEqual(state.selectedEditNodeIds.value, [], 'entering edit mode starts with no selection')
    assert.equal(state.selectedEditNode.value, null)
    assert.equal(state.editNodes.value[0].x, 50, 'edit snapshots retain the current moving-node position')
    const originals = snapshot(state.editNodes.value)

    edit.onEditSelectionChange([2])
    edit.onEditNodeMove({ node_id: 2, x: 2100, y: 190 })
    edit.onEditCoordChange('z', input(25))
    const unselectedPose = snapshot(state.editNodes.value[2])
    edit.onEditSelectionChange([0, 1, 1, 999])
    assert.deepEqual(state.selectedEditNodeIds.value, [0, 1], 'selection deduplicates and excludes unknown nodes, retaining node zero')
    edit.onEditNodeSelect(state.editNodes.value[1])
    assert.deepEqual(state.selectedEditNodeIds.value, [0, 1], 'node-select following selection-change does not collapse a group')
    assert.equal(state.selectedEditNodeId.value, null)
    assert.equal(state.selectedEditNode.value, null, 'multiple selection exposes no single-node coordinate form')
    const beforeIgnored = snapshot(state.editNodes.value)
    edit.onEditCoordChange('x', input(999))
    edit.onEditNodeMove({ node_id: 0, x: 999, y: 999 })
    assert.deepEqual(state.editNodes.value, beforeIgnored, 'a single-point edit cannot accidentally change one member of a selected group')

    const beforeMovePackets = state.simulatedPacketRows.value
    playback.isPlaying.value = true
    edit.onEditNodesMove([{ node_id: 0, x: 170.123, y: 20.126 }, { node_id: 1, x: 1120.123, y: 20.126 }])
    assert.deepEqual(state.editNodes.value.slice(0, 2).map(({ x, y, z }) => ({ x, y, z })), [
      { x: 170.12, y: 20.13, z: 0 }, { x: 1120.12, y: 20.13, z: 10 },
    ])
    assert.equal(playback.isPlaying.value, false, 'group dragging pauses playback')
    assert.equal(state.simulatedPacketRows.value, beforeMovePackets, 'dragging defers geometric recomputation until move-end')
    edit.onEditNodeMoveEnd()
    assert.notEqual(state.simulatedPacketRows.value, beforeMovePackets)
    edit.restoreSelectedEditNodes()
    assert.deepEqual(state.editNodes.value.slice(0, 2), originals.slice(0, 2), 'restore selected restores every selected node to its edit-entry snapshot')
    assert.deepEqual(state.editNodes.value[2], unselectedPose, 'restore selected preserves unselected edits')
    assert.deepEqual(state.selectedEditNodeIds.value, [0, 1])
    edit.restoreAllEditNodes()
    assert.deepEqual(state.editNodes.value, originals)

    edit.onEditSelectionChange([1])
    assert.equal(state.selectedEditNodeId.value, 1)
    edit.onEditCoordChange('x', input(123.456))
    assert.equal(state.selectedEditNode.value.x, 123.46, 'single selection retains coordinate editing')
    edit.onEditSelectionChange([])
    assert.equal(state.selectedEditNode.value, null)
    edit.onEditNodeSelect(state.editNodes.value[0])
    assert.equal(state.selectedEditNodeId.value, 0)

    edit.restoreAllEditNodes()
    const originalPreviewPackets = snapshot(state.simulatedPacketRows.value)
    edit.onEditSelectionChange([2])
    playback.isPlaying.value = true
    playback.focusedPacketId.value = state.packetEntries.value[0].eventId
    edit.removeSelectedEditNodes()
    assert.deepEqual(state.editNodes.value.map((node) => node.node_id), [0, 1])
    assert.deepEqual(state.selectedEditNodeIds.value, [], 'deleting clears the group selection')
    assert.equal(playback.isPlaying.value, false, 'deleting pauses the preview')
    assert.equal(playback.focusedPacketId.value, null, 'deleting clears stale packet focus')
    assert.equal(state.simulatedPacketRows.value.length, 1, 'deleting a receiver preserves the remaining sender event')
    assert.deepEqual(state.simulatedPacketRows.value[0].receivers, [], 'deleted receivers leave no dangling reception')
    edit.restoreAllEditNodes()
    assert.deepEqual(state.editNodes.value, originals, 'restore all reinstates deleted nodes at the edit-entry pose')
    assert.deepEqual(state.simulatedPacketRows.value, originalPreviewPackets, 'restoring receivers reinstates their derived receptions')

    edit.onEditSelectionChange([0])
    edit.removeSelectedEditNodes()
    assert.deepEqual(state.editNodes.value.map((node) => node.node_id), [1, 2])
    assert.deepEqual(state.simulatedPacketRows.value, [], 'deleting a sender removes its events from the preview')
    assert.deepEqual(state.packetEntries.value, [], 'the packet list has no ghost sender records')
    assert.equal(state.simulatedSummary.value.committedPacketCount, 0)
    edit.restoreAllEditNodes()
    assert.deepEqual(state.simulatedPacketRows.value, originalPreviewPackets, 'restoring senders recovers the full preview')

    edit.onEditSelectionChange([0, 1, 2])
    edit.removeSelectedEditNodes()
    assert.deepEqual(state.nodesState.value, [], 'deleting the entire selection permits an empty topology')
    assert.deepEqual(state.packetEntries.value, [])
    assert.deepEqual(state.nodeVisuals.value, [])
    assert.deepEqual(state.baseNodesState.value, originalLogNodes)
    assert.deepEqual(state.sourcePacketRows.value, originalLogPackets, 'deletion never rewrites the original trace')
    assert.deepEqual(state.nodeMovementRows.value, originalMovements, 'deletion never removes original movement tracks')
    edit.restoreAllEditNodes()
    assert.deepEqual(state.editNodes.value, originals)
    assert.deepEqual(state.simulatedPacketRows.value, originalPreviewPackets)
    edit.onEditSelectionChange([0, 2])
    edit.removeSelectedEditNodes()
    edit.exitEditMode()
    assert.deepEqual(state.selectedEditNodeIds.value, [])
    assert.equal(state.selectedEditNode.value, null)
    assert.deepEqual(state.editNodes.value, [])
    assert.equal(state.simulatedPacketRows.value, null)
    assert.deepEqual(state.nodesState.value, originalLogNodes, 'leaving edit mode restores the original topology')
    assert.deepEqual(state.packetRows.value, originalLogPackets, 'leaving edit mode restores all original transmissions')
    playback.currentTime.value = 500000
    assert.equal(state.nodesState.value[0].x, 50, 'leaving edit mode restores the original movement timeline')
    edit.onEditSelectionChange([0, 1])
    edit.onEditNodeSelect(state.baseNodesState.value[0])
    edit.onEditNodesMove([{ node_id: 0, x: 999, y: 999 }])
    edit.removeSelectedEditNodes()
    assert.deepEqual(state.selectedEditNodeIds.value, [], 'ordinary replay events do not create edit selections')
    assert.deepEqual(state.baseNodesState.value, originalLogNodes)
    assert.deepEqual(state.sourcePacketRows.value, originalLogPackets, 'edit operations preserve the original log')

    edit.enterEditMode()
    assert.deepEqual(state.selectedEditNodeIds.value, [], 're-entering edit mode clears the previous selection')
    edit.onEditSelectionChange([0, 1])
    state.applyParsedLog(parsed, edit.exitEditMode)
    assert.deepEqual(state.selectedEditNodeIds.value, [], 'replacing a sample/upload clears the group selection')
    assert.equal(state.isEditMode.value, false)
    edit.enterEditMode()
    edit.onEditSelectionChange([0, 1])
    state.applyTopology(parsed.nodes, edit.exitEditMode)
    assert.deepEqual(state.selectedEditNodeIds.value, [], 'replacing topology clears the group selection')
  } finally { scope.stop() }
  console.log('Replay edit selection regressions passed: group movement/deletion/restore, trace preservation, empty topology, single-coordinate safeguards and edit/log lifecycle cleanup.')
}
