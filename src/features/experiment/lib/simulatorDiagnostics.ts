/** Keep a concise status separate from compiler output, including legacy combined errors. */
export const simulatorFailure = (error: unknown, output = '', fallback = '操作失败，请查看详情。') => {
  const clean = (text: unknown) => String(text ?? '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/^Error:\s*/, '').trim()
  const message = clean(error instanceof Error ? error.message : error)
  const log = clean(output)
  const combined = [message,log].filter(Boolean).join('\n')
  let summary = message
  if (/(?:PCH file|precompiled header)[\s\S]*?(?:different branch|different version|compiler version)/i.test(combined)) {
    summary = '编译器版本已变化，旧预编译头不兼容。请清除构建后重新预编译。'
  } else if (/^读取注册协议失败/.test(message)) summary = '读取注册协议失败，请查看详情。'
  else if (!message || message.length > 180 || /\n|-- (?:Using|Processing|Configuring)|CMake Error|\[\s*\d+%\]/.test(message)) summary = fallback
  summary = summary.replace(/请查看(?:编译)?输出/g,'请查看详情')
  const longError = message.length > 180 || message.includes('\n')
  const details = log && longError && !log.includes(message) ? [message,log].join('\n\n') : log || message
  return { summary, details }
}
