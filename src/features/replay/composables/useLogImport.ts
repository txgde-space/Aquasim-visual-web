import { onScopeDispose } from 'vue'
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
}: {
  state: ReplayStateApi
  /** Bound apply that also exits edit mode (wired in ReplayPage). */
  applyParsedLog: (parsed: ParsedLog) => void
}) => {
  let importVersion = 0
  onScopeDispose(() => { importVersion += 1 })

  const loadSampleLog = (key: string) => {
    importVersion += 1
    const source = LOG_SOURCES[key] || LOG_SOURCES.default
    applyParsedLog(parseLog(source.raw))
    state.logSourceKey.value = LOG_SOURCES[key] ? key : 'default'
    state.uploadedLogName.value = ''
    state.uploadedNodeLogNames.value = []
  }

  const onSampleLogChange = (event: Event) => {
    const key = (event.target as HTMLSelectElement).value
    if (!LOG_SOURCES[key]) return
    loadSampleLog(key)
  }

  const importLogFile = async (file: File): Promise<ImportedLogFile> => {
    const fileCheck = validateImportedFile(file)
    if (!fileCheck.ok) return { ok: false, error: fileCheck.error }
    const text = await file.text()
    const textCheck = validateImportedText(text)
    if (!textCheck.ok) return { ok: false, error: textCheck.error }
    return { ok: true, text, name: sanitizeFileName(file.name) }
  }

  const importFiles = async (files: File[], mergeNodeLogs: boolean) => {
    const version = ++importVersion
    try {
      const parsedLogs: ParsedLog[] = []
      const fileNames: string[] = []
      for (const file of files) {
        const imported = await importLogFile(file)
        // Reading a file can finish after a newer selection, sample switch, or
        // page teardown. Only the latest mounted import may publish its result.
        if (version !== importVersion) return
        if (!imported.ok) {
          state.rejectImportedLog(imported.error)
          return
        }
        parsedLogs.push(parseLog(imported.text))
        fileNames.push(imported.name)
      }

      const parsed = mergeNodeLogs ? mergeParsedNodeLogs(parsedLogs, fileNames) : parsedLogs[0]
      const previousName = state.uploadedLogName.value
      // The normalization fallback uses this name for per-node event sources.
      state.uploadedLogName.value = mergeNodeLogs ? '' : fileNames[0]
      try {
        applyParsedLog(parsed)
      } catch (error) {
        state.uploadedLogName.value = previousName
        throw error
      }
      state.uploadedNodeLogNames.value = mergeNodeLogs ? fileNames : []
      state.logSourceKey.value = mergeNodeLogs ? 'node-upload' : 'upload'
    } catch (error) {
      if (version !== importVersion) return
      const message = error instanceof Error ? error.message : '无法读取日志文件'
      state.rejectImportedLog(`导入失败：${message}`)
    }
  }

  const onLogFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target?.files?.[0]
    if (target) target.value = ''
    if (file) await importFiles([file], false)
  }

  const onNodeLogFilesChange = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = [...(target?.files || [])].slice(0, MAX_LOG_FILES)
    if (target) target.value = ''
    if (files.length) await importFiles(files, true)
  }

  return {
    loadSampleLog,
    onSampleLogChange,
    onLogFileChange,
    onNodeLogFilesChange,
  }
}

export type LogImportApi = ReturnType<typeof useLogImport>
