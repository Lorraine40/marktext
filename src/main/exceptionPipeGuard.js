const STDIO_TOKENS = [
  'stdout',
  'stderr',
  'process.stdout',
  'process.stderr',
  '_stdout',
  '_stderr',
  'console',
  'electron-log'
]

export const isIgnorablePipeError = (error, stream) => {
  if (!error || error.code !== 'EPIPE') {
    return false
  }

  if (stream) {
    return stream === process.stdout || stream === process.stderr
  }

  const text = `${error.stack || ''}\n${error.message || ''}`.toLowerCase()
  if (!text.includes('write')) {
    return false
  }
  return STDIO_TOKENS.some(token => text.includes(token.toLowerCase()))
}

export const safeStdoutWrite = message => {
  try {
    process.stdout.write(message)
  } catch (err) {
    if (!isIgnorablePipeError(err, process.stdout)) {
      throw err
    }
  }
}
