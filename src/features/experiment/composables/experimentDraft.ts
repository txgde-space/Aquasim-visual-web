import type { CanvasState } from '../../../shared/types/canvas'
import { ref } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { createDefaultExperimentForm } from '../lib/experimentSpec'

// A draft survives route unmounts, but a fresh browser load starts a new experiment.
// Canvas components still unmount normally, releasing their rendering resources.
export const createExperimentDraft = () => ({
  nodes: ref<TopologyNode[]>([]),
  form: ref<ExperimentForm>(createDefaultExperimentForm()),
  selectedIds: ref<number[]>([]),
  activeCatalogId: ref(''),
  canvas: ref<CanvasState>(),
})

export const experimentDraft = createExperimentDraft()
export const fieldDraft = createExperimentDraft()
