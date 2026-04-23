import ImeTextareaProxy from '../../../src/muya/lib/imeProxy'
import Cursor from '../../../src/muya/lib/selection/cursor'

const BLOCK_KEY = 'block1'

const createCursor = offset => new Cursor({
  anchor: { key: BLOCK_KEY, offset },
  focus: { key: BLOCK_KEY, offset }
})

const setDomSelection = (paragraph, offset) => {
  const range = document.createRange()
  range.setStart(paragraph.firstChild, offset)
  range.collapse(true)

  const domSelection = document.getSelection()
  domSelection.removeAllRanges()
  domSelection.addRange(range)
}

const createMuyaContext = (functionType = 'paragraphContent') => {
  document.body.innerHTML = `
    <div id="editor" contenteditable="true">
      <div id="ag-editor-id">
        <span id="${BLOCK_KEY}" class="ag-paragraph ag-${functionType.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}">abc</span>
      </div>
    </div>
  `

  const container = document.querySelector('#editor')
  const paragraph = document.querySelector(`#${BLOCK_KEY}`)
  const block = {
    key: BLOCK_KEY,
    text: 'abc',
    type: 'span',
    functionType,
    editable: true
  }
  const inputEvents = []
  let changes = 0

  const contentState = {
    cursor: createCursor(1),
    getBlock: key => (key === BLOCK_KEY ? block : null),
    inputHandler: event => {
      inputEvents.push(event)
      block.text = paragraph.textContent
      contentState.cursor = createCursor(2)
    }
  }

  const muya = {
    container,
    contentState,
    dispatchChange: () => {
      changes += 1
    }
  }

  setDomSelection(paragraph, 1)

  return {
    block,
    container,
    get changes () {
      return changes
    },
    inputEvents,
    muya,
    paragraph
  }
}

describe('Muya IME textarea proxy', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the proxy active when Escape cancels an IME candidate', () => {
    const { muya } = createMuyaContext()
    const proxy = new ImeTextareaProxy(muya)
    let bubbled = false
    const listener = () => {
      bubbled = true
    }

    document.addEventListener('keydown', listener)
    expect(proxy.begin()).to.equal(true)

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    })
    proxy.textarea.dispatchEvent(event)
    document.removeEventListener('keydown', listener)

    expect(event.defaultPrevented).to.equal(true)
    expect(bubbled).to.equal(false)
    expect(proxy.isActive()).to.equal(true)

    proxy.destroy()
  })

  it('commits proxy text through the existing input handler on blur', () => {
    const ctx = createMuyaContext()
    ctx.muya.keyboard = { isComposed: true }
    const proxy = new ImeTextareaProxy(ctx.muya)

    expect(proxy.begin()).to.equal(true)
    proxy.textarea.value = 'あ'
    proxy.textarea.dispatchEvent(new Event('blur'))

    expect(proxy.isActive()).to.equal(false)
    expect(ctx.paragraph.textContent).to.equal('aあbc')
    expect(ctx.block.text).to.equal('aあbc')
    expect(ctx.inputEvents).to.have.lengthOf(1)
    expect(ctx.inputEvents[0].type).to.equal('compositionend')
    expect(ctx.changes).to.equal(1)
    expect(ctx.muya.keyboard.isComposed).to.equal(false)
  })

  it('cleans up the proxy textarea without committing on destroy', () => {
    const ctx = createMuyaContext()
    ctx.muya.keyboard = { isComposed: true }
    const proxy = new ImeTextareaProxy(ctx.muya)

    expect(proxy.begin()).to.equal(true)
    const textarea = proxy.textarea
    proxy.destroy()

    expect(proxy.isActive()).to.equal(false)
    expect(document.body.contains(textarea)).to.equal(false)
    expect(ctx.inputEvents).to.have.lengthOf(0)
    expect(ctx.changes).to.equal(0)
    expect(ctx.muya.keyboard.isComposed).to.equal(false)
  })

  it('does not proxy unsupported editable block types', () => {
    const ctx = createMuyaContext('codeContent')
    const proxy = new ImeTextareaProxy(ctx.muya)

    expect(proxy.begin()).to.equal(false)
    expect(proxy.textarea).to.equal(null)
  })
})
