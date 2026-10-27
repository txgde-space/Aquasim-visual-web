import { ref, type Ref } from 'vue'
import { recomputeReceiversFromGeometry } from '@/shared/acousticSim'
import { DEFAULT_RADIO_PROPAGATION_SPEED_MPS } from '@/shared/constants'
import type { ReplayNode } from '@/shared/types/replay'
import { resolveMovingNodes } from '../lib/logNormalize'
import type { PlaybackEngine } from './usePlaybackEngine'
import type { ReplayStateApi } from './useReplayState'

export const cloneNode = (node: ReplayNode): ReplayNode => ({
  ...node,
  x: Number(node.x) || 0,
  y: Number(node.y) || 0,
  z: Number(node.z) || 0,
})

interface EditNodeMove {
  node_id?: unknown
  x?: unknown
  y?: unknown
}

export const useEditMode = ({
  state,
  playback,
  onEnterEdit,
}: {
  state: ReplayStateApi
  playback: PlaybackEngine
  /** Hook wired in ReplayPage: entering edit mode forces the 2D view. */
  onEnterEdit?: () => void
}) => {
  const editBusy: Ref<boolean> = ref(false)

  const refreshSimulatedPackets = () => {
    if (!state.isEditMode.value) return
    const nodeIds = new Set(state.editNodes.value.map((node) => node.node_id))
    state.simulatedPacketRows.value = recomputeReceiversFromGeometry(
      // Deletions affect only this geometric preview. Keep the original trace
      // intact so restoring nodes or leaving edit mode restores its records.
      state.sourcePacketRows.value.filter((packet) => nodeIds.has(packet.src)),
      state.editNodes.value,
      state.editSoundSpeed.value,
      state.fractionalTiming.value,
    )
  }

  const snapshotReplayNodes = () => {
    const snapshot = resolveMovingNodes(
      state.baseNodesState.value,
      state.nodeMovementRows.value,
      playback.currentTime.value,
    ).map(cloneNode)
    state.originalEditPoseById.value = new Map(snapshot.map((node) => [node.node_id, cloneNode(node)]))
    state.editNodes.value = snapshot.map(cloneNode)
    state.selectedEditNodeIds.value = []
  }

  const enterEditMode = () => {
    snapshotReplayNodes()
    state.interactionMode.value = 'edit'
    playback.isPlaying.value = false
    playback.focusedPacketId.value = null
    playback.currentTime.value = 0
    onEnterEdit?.()
    refreshSimulatedPackets()
  }

  const exitEditMode = () => {
    state.interactionMode.value = 'replay'
    state.simulatedPacketRows.value = null
    state.editNodes.value = []
    state.originalEditPoseById.value = new Map()
    state.selectedEditNodeIds.value = []
    playback.isPlaying.value = false
    playback.focusedPacketId.value = null
    playback.currentTime.value = 0
  }

  const setInteractionMode = (mode: string) => {
    if (mode === state.interactionMode.value) return
    if (mode === 'edit') enterEditMode()
    else exitEditMode()
  }

  const onEditNodesMove = (moves: EditNodeMove[]) => {
    if (!state.isEditMode.value || !Array.isArray(moves) || !moves.length) return
    const byId = new Map<number, { x: number; y: number }>()
    for (const move of moves) {
      if (!move) continue
      const id = Number(move.node_id)
      const x = Number(move.x)
      const y = Number(move.y)
      if (Number.isFinite(id) && Number.isFinite(x) && Number.isFinite(y)) {
        byId.set(id, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
      }
    }
    let changed = false
    const nextNodes = state.editNodes.value.map((node) => {
      const move = byId.get(node.node_id)
      if (!move || (move.x === node.x && move.y === node.y)) return node
      changed = true
      return { ...node, ...move }
    })
    if (!changed) return
    playback.pauseForTool()
    state.editNodes.value = nextNodes
  }

  const onEditNodeMove = (payload: EditNodeMove) => {
    if (state.selectedEditNodeIds.value.length > 1) return
    onEditNodesMove([payload])
  }

  const onEditNodeMoveEnd = () => {
    refreshSimulatedPackets()
  }

  const onEditSelectionChange = (ids: number[]) => {
    if (!state.isEditMode.value || !Array.isArray(ids)) return
    const available = new Set(state.editNodes.value.map((node) => node.node_id))
    state.selectedEditNodeIds.value = [...new Set(ids.filter((id) => available.has(id)))]
  }

  const onEditNodeSelect = (node: ReplayNode | null) => {
    if (!state.isEditMode.value) return
    if (!node) onEditSelectionChange([])
    // Canvas emits the selection set before node-select. Preserve that set
    // when a selected node becomes the drag anchor for the whole group.
    else if (!state.selectedEditNodeIds.value.includes(node.node_id)) onEditSelectionChange([node.node_id])
  }

  const restoreSelectedEditNodes = () => {
    if (!state.isEditMode.value || !state.selectedEditNodeIds.value.length) return
    const selected = new Set(state.selectedEditNodeIds.value)
    state.editNodes.value = state.editNodes.value.map((node) => {
      const original = selected.has(node.node_id) ? state.originalEditPoseById.value.get(node.node_id) : null
      return original ? cloneNode(original) : node
    })
    refreshSimulatedPackets()
  }

  const removeSelectedEditNodes = () => {
    if (!state.isEditMode.value || !state.selectedEditNodeIds.value.length) return
    const selected = new Set(state.selectedEditNodeIds.value)
    playback.pauseForTool()
    playback.focusedPacketId.value = null
    state.editNodes.value = state.editNodes.value.filter((node) => !selected.has(node.node_id))
    state.selectedEditNodeIds.value = []
    refreshSimulatedPackets()
  }

  const restoreAllEditNodes = () => {
    if (!state.isEditMode.value) return
    state.editNodes.value = [...state.originalEditPoseById.value.values()].map(cloneNode)
    refreshSimulatedPackets()
  }

  const onEditSoundSpeedChange = (event: Event) => {
    const next = Number((event.target as HTMLSelectElement).value)
    if (!Number.isFinite(next) || next <= 0) return
    state.editSoundSpeed.value = state.fractionalTiming.value
      ? Math.max(1, Math.min(DEFAULT_RADIO_PROPAGATION_SPEED_MPS, next))
      : Math.max(200, Math.min(2500, next))
    refreshSimulatedPackets()
  }

  const onEditCoordChange = (axis: 'x' | 'y' | 'z', event: Event) => {
    if (!state.isEditMode.value) return
    const node = state.selectedEditNode.value
    if (!node) return
    const next = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(next)) return
    state.editNodes.value = state.editNodes.value.map((item) => (
      item.node_id === node.node_id ? { ...item, [axis]: Math.round(next * 100) / 100 } : item
    ))
    refreshSimulatedPackets()
  }

  return {
    editBusy,
    refreshSimulatedPackets,
    enterEditMode,
    exitEditMode,
    setInteractionMode,
    onEditNodeMove,
    onEditNodesMove,
    onEditNodeMoveEnd,
    onEditNodeSelect,
    onEditSelectionChange,
    removeSelectedEditNodes,
    restoreSelectedEditNodes,
    restoreAllEditNodes,
    onEditSoundSpeedChange,
    onEditCoordChange,
  }
}

export type EditModeApi = ReturnType<typeof useEditMode>
