import { isValidElectronAccelerator } from '@hfelix/electron-localshortcut'

export const normalizeMenuAccelerator = value => {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }

  try {
    return isValidElectronAccelerator(value) ? value : undefined
  } catch (_) {
    return undefined
  }
}
