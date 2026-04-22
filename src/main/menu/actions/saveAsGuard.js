const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value)
const isOptionalString = value => !value || typeof value === 'string'

export const validateSavePayload = payload => {
  if (!isObject(payload)) {
    return { valid: false, reason: 'Invalid save payload.' }
  }

  const { id, markdown, options, filename, pathname, defaultPath } = payload
  if (typeof id !== 'string' || id.length === 0) {
    return { valid: false, reason: 'Invalid tab id.' }
  }
  if (typeof markdown !== 'string') {
    return { valid: false, reason: 'Invalid markdown content.' }
  }
  if (!isObject(options)) {
    return { valid: false, reason: 'Invalid save options.' }
  }
  if (!isObject(options.encoding)) {
    return { valid: false, reason: 'Invalid file encoding options.' }
  }
  if (typeof options.encoding.encoding !== 'string' || options.encoding.encoding.length === 0) {
    return { valid: false, reason: 'Invalid file encoding.' }
  }
  if (options.encoding.isBom !== undefined && typeof options.encoding.isBom !== 'boolean') {
    return { valid: false, reason: 'Invalid BOM option.' }
  }
  if (options.lineEnding !== 'lf' && options.lineEnding !== 'crlf') {
    return { valid: false, reason: 'Invalid line ending option.' }
  }
  if (typeof options.adjustLineEndingOnSave !== 'boolean') {
    return { valid: false, reason: 'Invalid line ending adjustment option.' }
  }
  if (typeof options.trimTrailingNewline !== 'number') {
    return { valid: false, reason: 'Invalid trailing newline option.' }
  }
  if (!isOptionalString(filename) || !isOptionalString(pathname) || !isOptionalString(defaultPath)) {
    return { valid: false, reason: 'Invalid save path.' }
  }
  return { valid: true }
}
