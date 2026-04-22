import { isIgnorablePipeError } from '../../../src/main/exceptionPipeGuard'
import { normalizeMenuAccelerator } from '../../../src/main/keyboard/accelerator'
import { validateSavePayload } from '../../../src/main/menu/actions/saveAsGuard'
import { stripAcceleratorsFromTemplate } from '../../../src/main/menu/templateGuard'

const createSavePayload = overrides => Object.assign({
  id: 'tab-1',
  filename: 'Untitled',
  markdown: '# Title',
  pathname: '',
  defaultPath: '',
  options: {
    encoding: {
      encoding: 'utf8',
      isBom: false
    },
    lineEnding: 'lf',
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 1
  }
}, overrides)

describe('main process crash guards', () => {
  describe('isIgnorablePipeError', () => {
    it('accepts stdout EPIPE from stream listeners', () => {
      expect(isIgnorablePipeError({ code: 'EPIPE' }, process.stdout)).to.equal(true)
    })

    it('accepts stderr EPIPE from stream listeners', () => {
      expect(isIgnorablePipeError({ code: 'EPIPE' }, process.stderr)).to.equal(true)
    })

    it('rejects EPIPE from other streams', () => {
      expect(isIgnorablePipeError({ code: 'EPIPE' }, {})).to.equal(false)
    })

    it('rejects non-EPIPE errors', () => {
      expect(isIgnorablePipeError({ code: 'EACCES' }, process.stdout)).to.equal(false)
    })

    it('accepts uncaught stdout write EPIPE', () => {
      const error = {
        code: 'EPIPE',
        message: 'write EPIPE',
        stack: 'Error: write EPIPE\n    at process.stdout.write'
      }
      expect(isIgnorablePipeError(error)).to.equal(true)
    })

    it('rejects uncaught EPIPE without stdio context', () => {
      const error = {
        code: 'EPIPE',
        message: 'write EPIPE',
        stack: 'Error: write EPIPE\n    at Socket.write'
      }
      expect(isIgnorablePipeError(error)).to.equal(false)
    })
  })

  describe('validateSavePayload', () => {
    it('accepts a normal Save As payload', () => {
      expect(validateSavePayload(createSavePayload()).valid).to.equal(true)
    })

    it('rejects missing payloads', () => {
      expect(validateSavePayload(undefined).valid).to.equal(false)
    })

    it('rejects invalid markdown', () => {
      expect(validateSavePayload(createSavePayload({ markdown: null })).valid).to.equal(false)
    })

    it('rejects missing tab ids', () => {
      expect(validateSavePayload(createSavePayload({ id: '' })).valid).to.equal(false)
    })

    it('rejects invalid options', () => {
      expect(validateSavePayload(createSavePayload({ options: null })).valid).to.equal(false)
    })

    it('rejects missing encoding options', () => {
      const payload = createSavePayload()
      delete payload.options.encoding
      expect(validateSavePayload(payload).valid).to.equal(false)
    })

    it('rejects invalid line endings', () => {
      const payload = createSavePayload()
      payload.options.lineEnding = 'native'
      expect(validateSavePayload(payload).valid).to.equal(false)
    })
  })

  describe('normalizeMenuAccelerator', () => {
    it('keeps valid accelerators', () => {
      expect(normalizeMenuAccelerator('CmdOrCtrl+S')).to.equal('CmdOrCtrl+S')
    })

    it('removes empty and invalid accelerators', () => {
      expect(normalizeMenuAccelerator('')).to.equal(undefined)
      expect(normalizeMenuAccelerator(null)).to.equal(undefined)
      expect(normalizeMenuAccelerator(1)).to.equal(undefined)
      expect(normalizeMenuAccelerator('CmdOrCtrl+')).to.equal(undefined)
    })
  })

  describe('stripAcceleratorsFromTemplate', () => {
    it('removes accelerators without changing menu structure', () => {
      const click = () => {}
      const template = [{
        id: 'fileMenu',
        label: 'File',
        submenu: [{
          id: 'saveMenuItem',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click
        }, {
          id: 'separator',
          type: 'separator'
        }, {
          id: 'nestedMenu',
          label: 'Nested',
          submenu: [{
            id: 'nestedItem',
            label: 'Nested item',
            accelerator: 'CmdOrCtrl+Shift+S'
          }]
        }]
      }]

      const stripped = stripAcceleratorsFromTemplate(template)
      expect(stripped[0].id).to.equal('fileMenu')
      expect(stripped[0].submenu[0].id).to.equal('saveMenuItem')
      expect(stripped[0].submenu[0].click).to.equal(click)
      expect(stripped[0].submenu[0]).to.not.have.property('accelerator')
      expect(stripped[0].submenu[1].type).to.equal('separator')
      expect(stripped[0].submenu[2].submenu[0].id).to.equal('nestedItem')
      expect(stripped[0].submenu[2].submenu[0]).to.not.have.property('accelerator')
    })
  })
})
