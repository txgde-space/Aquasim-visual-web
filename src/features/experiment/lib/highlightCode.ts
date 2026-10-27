import highlight from 'highlight.js/lib/core'
import cpp from 'highlight.js/lib/languages/cpp'
import json from 'highlight.js/lib/languages/json'

export type CodeLanguage = 'cpp' | 'json'

// Keep language registration local; workers only need these two grammars.
const highlighter = highlight.newInstance()
highlighter.registerLanguage('cpp', cpp)
highlighter.registerLanguage('json', json)

/** Add token markup while preserving and HTML-escaping the original source. */
export const highlightCode = (code: string, language: CodeLanguage): string => (
  highlighter.highlight(code, { language, ignoreIllegals: true }).value
)
