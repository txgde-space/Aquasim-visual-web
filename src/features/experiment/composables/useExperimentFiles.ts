import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { createDefaultExperimentForm } from '../lib/experimentSpec'
import { parseExperiment, serializeExperiment, type ExperimentDraftData } from '../lib/experimentDocument'
import type { CatalogLayer } from '../lib/typeIdCatalog'
import type { TopologyEditor } from './useTopologyEditor'

export const useExperimentFiles = (editor: TopologyEditor, layers: Ref<CatalogLayer[]>, home: Ref<string>, selectHome: (value: string) => void, onReplace: () => void) => {
  const message = ref('')
  const failed = ref(false)
  const importing = ref(false)
  const previous = ref<ExperimentDraftData | null>(null)
  let generation = 0
  onBeforeUnmount(() => { generation++ })
  const snapshot = (): ExperimentDraftData => JSON.parse(JSON.stringify({
    form: editor.experimentForm.value, nodes: editor.editNodes.value,
    selectedIds: editor.selectedIds.value, activeCatalogId: editor.activeCatalogId.value, aquaSimHome: home.value,
  }))
  const documentJson = computed(() => serializeExperiment(snapshot(), layers.value))
  const apply = (draft: ExperimentDraftData) => {
    if (draft.aquaSimHome !== undefined && draft.aquaSimHome !== home.value) selectHome(draft.aquaSimHome)
    editor.experimentForm.value = draft.form
    editor.editNodes.value = draft.nodes
    editor.selectedIds.value = draft.selectedIds
    editor.activeCatalogId.value = draft.activeCatalogId
    onReplace()
  }
  const newExperiment = () => {
    previous.value = snapshot()
    apply({ form: createDefaultExperimentForm(), nodes: [], selectedIds: [], activeCatalogId: 'mac:swarm' })
    failed.value = false
    message.value = '已新建空白实验，可添加节点或导入参数。'
  }
  const restorePrevious = () => {
    if (!previous.value) return
    const draft = previous.value
    previous.value = null
    apply(draft)
    failed.value = false
    message.value = '已恢复替换前的实验。'
  }
  const importFile = async (file: File) => {
    const request = ++generation
    importing.value = true
    failed.value = false
    message.value = ''
    try {
      if (file.size > 1_000_000) throw new Error('实验文件不能超过 1 MB')
      const text = await file.text()
      if (request !== generation) return
      const draft = parseExperiment(text, layers.value)
      previous.value = snapshot()
      apply(draft)
      message.value = `已导入 ${file.name}（${draft.nodes.length} 个节点）。`
    } catch (error) {
      if (request !== generation) return
      failed.value = true
      message.value = `导入失败：${error instanceof Error ? error.message : String(error)}。当前实验保持不变。`
    } finally {
      if (request === generation) importing.value = false
    }
  }
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([documentJson.value], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'experiment.json'
    link.hidden = true
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    failed.value = false
    message.value = '已发起实验参数下载。'
  }
  return { documentJson, message, failed, importing, previous, newExperiment, restorePrevious, importFile, exportFile }
}
