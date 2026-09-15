import { type Ref } from 'vue'
import {
  MAX_LOG_FILES,
  sanitizeFileName,
  validateImportedFile,
  validateImportedText,
} from '@/shared/logSafety'
import type { ParsedLog } from '@/shared/types/log'
import { LOG_SOURCES } from '../lib/sources'
import { mergeParsedNodeLogs } from '../lib/logMerge'
import { parseLog } from '../lib/logParser'
import type { ReplayStateApi } from './useReplayState'

type ImportedLogFile =
  | { ok: true; text: string; name: string }
  | { ok: false; error: string }

export const useLogImport = ({
  state,
  applyParsedLog,
  logFileInput,
  nodeLogFileInput,
}: {
  state: ReplayStateApi
  /** Bound apply that also exits edit mode (wired in ReplayPage). */
  applyParsedLog: (parsed: ParsedLog) => void
  /** Template refs owned by the page component (declared with useTemplateRef). */
  logFileInput: Ref<HTMLInputElement | null>
  nodeLogFileInput: Ref<HTMLInputElement | null>
}) => {

  const loadSampleLog = (key: string) => {
    const source = LOG_SOURCES[key] || LOG_SOURCES.default
    state.logSourceKey.value = LOG_SOURCES[key] ? key : 'default'
    applyParsedLog(parseLog(source.raw))
  }

  const onSampleLogChange = (event: Event) => {
    const key = (event.target as HTMLSelectElement).value
    if (!LOG_SOURCES[key]) return
    loadSampleLog(key)
  }

  const openLogFilePicker = () => {
    logFileInput.value?.click()
  }

  const openNodeLogFilePicker = () => {
    nodeLogFileInput.value?.click()
  }

  const importLogFile = async (file: File): Promise<ImportedLogFile> => {
    const fileCheck = validateImportedFile(file)
    if (!fileCheck.ok) return { ok: false, error: fileCheck.error }
    const text = await file.text()
    const textCheck = validateImportedText(text)
    if (!textCheck.ok) return { ok: false, error: textCheck.error }
    return { ok: true, text, name: sanitizeFileName(file.name) }
  }

  const onLogFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target?.files?.[0]
    if (target) target.value = ''
    if (!file) return

    const imported = await importLogFile(file)
    if (!imported.ok) {
      state.rejectImportedLog(imported.error)
      return
    }

    state.uploadedLogName.value = imported.name
    state.logSourceKey.value = 'upload'
    applyParsedLog(parseLog(imported.text))
  }

  const onNodeLogFilesChange = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = [...(target?.files || [])].slice(0, MAX_LOG_FILES)
    if (target) target.value = ''
    if (!files.length) return

    const parsedLogs: ParsedLog[] = []
    const fileNames: string[] = []
    for (const file of files) {
      const imported = await importLogFile(file)
      if (!imported.ok) {
        state.rejectImportedLog(imported.error)
        return
      }
      parsedLogs.push(parseLog(imported.text))
      fileNames.push(imported.name)
    }

    const mergedParsed = mergeParsedNodeLogs(parsedLogs, fileNames)
    state.uploadedNodeLogNames.value = fileNames
    state.logSourceKey.value = 'node-upload'
    applyParsedLog(mergedParsed)
  }

  return {
    loadSampleLog,
    onSampleLogChange,
    openLogFilePicker,
    openNodeLogFilePicker,
    onLogFileChange,
    onNodeLogFilesChange,
  }
}

export type LogImportApi = ReturnType<typeof useLogImport>
