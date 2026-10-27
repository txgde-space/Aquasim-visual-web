import { highlightCode, type CodeLanguage } from './highlightCode'

self.onmessage = (event: MessageEvent<{ code: string; language: CodeLanguage }>) => {
  const { code, language } = event.data
  self.postMessage(highlightCode(code, language))
}
