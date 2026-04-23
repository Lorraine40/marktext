import Cursor from '../selection/cursor'
import selection from '../selection'

const EDITABLE_FUNCTION_TYPES = /^(paragraphContent|atxLine|cellContent)$/

class ImeTextareaProxy {
  constructor (muya) {
    this.muya = muya
    this.textarea = null
    this.active = false
    this.context = null
    this.boundHandlers = null
  }

  isActive () {
    return this.active
  }

  begin (event) {
    if (this.active) {
      return true
    }

    const cursor = selection.getCursorRange()
    if (!this.canProxy(cursor)) {
      return false
    }

    const { start, end } = cursor
    const { contentState, container } = this.muya
    const block = contentState.getBlock(start.key)
    const paragraph = container.querySelector(`#${start.key}`)
    const startOffset = Math.min(start.offset, end.offset)
    const endOffset = Math.max(start.offset, end.offset)

    this.context = {
      block,
      blockKey: start.key,
      cursor,
      originalText: block.text,
      selectedText: block.text.slice(startOffset, endOffset),
      startOffset,
      endOffset
    }

    this.textarea = this.createTextarea(paragraph)
    this.textarea.value = this.context.selectedText
    this.attachEvents()
    this.active = true
    container.classList.add('ag-ime-proxy-active')

    if (this.textarea.value) {
      this.textarea.setSelectionRange(0, this.textarea.value.length)
    }

    this.textarea.focus()

    if (event) {
      event.stopPropagation()
    }
    return true
  }

  canProxy (cursor) {
    if (!cursor || !cursor.start || !cursor.end || cursor.start.key !== cursor.end.key) {
      return false
    }

    const { contentState, container } = this.muya
    const block = contentState.getBlock(cursor.start.key)
    const paragraph = container.querySelector(`#${cursor.start.key}`)
    return !!(
      block &&
      block.editable !== false &&
      EDITABLE_FUNCTION_TYPES.test(block.functionType) &&
      paragraph
    )
  }

  createTextarea (paragraph) {
    const textarea = document.createElement('textarea')
    textarea.className = 'ag-ime-textarea-proxy'
    textarea.setAttribute('autocomplete', 'off')
    textarea.setAttribute('autocorrect', 'off')
    textarea.setAttribute('autocapitalize', 'off')
    textarea.setAttribute('spellcheck', 'false')

    this.syncTextareaStyle(textarea, paragraph)
    document.body.appendChild(textarea)
    return textarea
  }

  syncTextareaStyle (textarea, paragraph) {
    const rect = paragraph.getBoundingClientRect()
    const style = window.getComputedStyle(paragraph)

    Object.assign(textarea.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(rect.width, 1)}px`,
      minHeight: `${Math.max(rect.height, parseFloat(style.lineHeight) || 16)}px`,
      font: style.font,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      padding: style.padding,
      textAlign: style.textAlign
    })
  }

  attachEvents () {
    this.boundHandlers = {
      keydown: event => this.handleKeydown(event),
      blur: () => this.commit(),
      input: () => this.keepActive(),
      compositionstart: () => this.keepActive(),
      compositionupdate: () => this.keepActive(),
      compositionend: () => this.keepActive()
    }

    Object.keys(this.boundHandlers).forEach(eventName => {
      this.textarea.addEventListener(eventName, this.boundHandlers[eventName])
    })
  }

  detachEvents () {
    if (!this.textarea || !this.boundHandlers) {
      return
    }

    Object.keys(this.boundHandlers).forEach(eventName => {
      this.textarea.removeEventListener(eventName, this.boundHandlers[eventName])
    })
    this.boundHandlers = null
  }

  handleKeydown (event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    event.stopPropagation()
  }

  keepActive () {
    return true
  }

  commit () {
    if (!this.active || !this.context) {
      return false
    }

    const value = this.textarea ? this.textarea.value : ''
    const { contentState, container } = this.muya
    const {
      block,
      blockKey,
      cursor,
      originalText,
      selectedText,
      startOffset,
      endOffset
    } = this.context

    this.active = false
    this.releaseCompositionState()
    this.detachEvents()
    container.classList.remove('ag-ime-proxy-active')

    if (this.textarea && this.textarea.parentNode) {
      this.textarea.parentNode.removeChild(this.textarea)
    }
    this.textarea = null
    this.context = null

    if (value === selectedText) {
      return false
    }

    const paragraph = container.querySelector(`#${blockKey}`)
    if (!paragraph) {
      return false
    }

    const text = `${originalText.slice(0, startOffset)}${value}${originalText.slice(endOffset)}`
    const offset = startOffset + value.length
    const nextCursor = new Cursor({
      anchor: { key: blockKey, offset },
      focus: { key: blockKey, offset }
    })

    contentState.cursor = cursor
    paragraph.textContent = text
    selection.setCursorRange(nextCursor)

    contentState.inputHandler({
      type: 'compositionend',
      inputType: 'insertCompositionText',
      data: value,
      preventDefault () {}
    })
    this.muya.dispatchChange()

    return block.text !== originalText || text !== originalText
  }

  destroy () {
    this.active = false
    this.releaseCompositionState()
    this.detachEvents()
    this.muya.container.classList.remove('ag-ime-proxy-active')

    if (this.textarea && this.textarea.parentNode) {
      this.textarea.parentNode.removeChild(this.textarea)
    }

    this.textarea = null
    this.context = null
  }

  releaseCompositionState () {
    if (this.muya.keyboard) {
      this.muya.keyboard.isComposed = false
    }
  }
}

export default ImeTextareaProxy
