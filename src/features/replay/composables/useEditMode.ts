import { ref, type Ref } from 'vue'
import { recomputeReceiversFromGeometry } from '@/shared/acousticSim'
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
    state.simulatedPacketRows.value = recomputeReceiversFromGeometry(
      state.sourcePacketRows.value,
      state.editNodes.value,
      state.editSoundSpeed.value,
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
    state.selectedEditNodeId.value = snapshot[0]?.node_id ?? null
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
    state.selectedEditNodeId.value = null
    playback.isPlaying.value = false
    playback.focusedPacketId.value = null
    playback.currentTime.value = 0
  }

  const setInteractionMode = (mode: string) => {
    if (mode === state.interactionMode.value) return
    if (mode === 'edit') enterEditMode()
    else exitEditMode()
  }

  const onEditNodeMove = (payload: { node_id?: unknown; x?: unknown; y?: unknown }) => {
    if (!payload || !Number.isFinite(Number(payload.node_id))) return
    playback.pauseForTool()
    state.editNodes.value = state.editNodes.value.map((node) => (
      node.node_id === payload.node_id
        ? {
          ...node,
          x: Math.round((Number(payload.x) || 0) * 100) / 100,
          y: Math.round((Number(payload.y) || 0) * 100) / 100,
        }
        : node
    ))
  }

  const onEditNodeMoveEnd = () => {
    refreshSimulatedPackets()
  }

  const onEditNodeSelect = (node: ReplayNode | null) => {
    if (!node) return
    state.selectedEditNodeId.value = node.node_id
  }

  const restoreSelectedEditNode = () => {
    const original = state.originalEditPoseById.value.get(state.selectedEditNodeId.value as number)
    if (!original) return
    state.editNodes.value = state.editNodes.value.map((node) => (
      node.node_id === original.node_id ? cloneNode(original) : node
    ))
    refreshSimulatedPackets()
  }

  const restoreAllEditNodes = () => {
    state.editNodes.value = [...state.originalEditPoseById.value.values()].map(cloneNode)
    refreshSimulatedPackets()
  }

  const onEditSoundSpeedChange = (event: Event) => {
    const next = Number((event.target as HTMLSelectElement).value)
    if (!Number.isFinite(next) || next <= 0) return
    state.editSoundSpeed.value = Math.max(200, Math.min(2500, next))
    refreshSimulatedPackets()
  }

  const onEditCoordChange = (axis: 'x' | 'y' | 'z', event: Event) => {
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
    onEditNodeMoveEnd,
    onEditNodeSelect,
    restoreSelectedEditNode,
    restoreAllEditNodes,
    onEditSoundSpeedChange,
    onEditCoordChange,
  }
}

export type EditModeApi = ReturnType<typeof useEditMode>
