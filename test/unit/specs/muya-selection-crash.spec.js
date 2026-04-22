import ContentState from '../../../src/muya/lib/contentState'
import EventCenter from '../../../src/muya/lib/eventHandler/event'
import selection from '../../../src/muya/lib/selection'
import { CLASS_OR_ID, MUYA_DEFAULT_OPTION } from '../../../src/muya/lib/config'

const createMuyaContext = options => {
  const ctx = {}
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, options)
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx, ctx.options)
  ctx.blur = () => {}
  return ctx
}

const createFixture = () => {
  const fixture = document.createElement('div')
  document.body.appendChild(fixture)
  return fixture
}

const clearFixture = fixture => {
  document.getSelection().removeAllRanges()
  if (fixture && fixture.parentNode) {
    fixture.parentNode.removeChild(fixture)
  }
}

const appendParagraph = (fixture, key, text = 'abc') => {
  const paragraph = document.createElement('span')
  paragraph.id = key
  paragraph.className = CLASS_OR_ID.AG_PARAGRAPH
  paragraph.appendChild(document.createTextNode(text))
  fixture.appendChild(paragraph)
  return paragraph
}

describe('Muya selection crash guards', () => {
  let fixture

  beforeEach(() => {
    fixture = createFixture()
  })

  afterEach(() => {
    clearFixture(fixture)
  })

  it('returns false for missing cursor block without changing the current DOM selection', () => {
    const ctx = createMuyaContext()
    const block = ctx.contentState.getFirstBlock()
    const paragraph = appendParagraph(fixture, block.key, block.text || 'abc')
    const textNode = paragraph.firstChild
    selection.select(textNode, 1)

    const result = selection.setCursorRange({
      anchor: { key: block.key, offset: 1 },
      focus: { key: 'missing-block', offset: 0 }
    })

    const current = document.getSelection()
    expect(result).to.equal(false)
    expect(current.anchorNode).to.equal(textNode)
    expect(current.anchorOffset).to.equal(1)
  })

  it('returns false for cursor keys that cannot be used as DOM selectors', () => {
    expect(() => {
      const result = selection.setCursorRange({
        anchor: { key: 'bad:key', offset: 0 },
        focus: { key: 'bad:key', offset: 0 }
      })
      expect(result).to.equal(false)
    }).to.not.throw()
  })

  it('clamps text and element range offsets before touching DOM Range APIs', () => {
    const wrapper = document.createElement('div')
    wrapper.appendChild(document.createElement('span'))
    wrapper.appendChild(document.createElement('span'))
    fixture.appendChild(wrapper)

    expect(() => selection.select(wrapper, 100)).to.not.throw()
    expect(document.getSelection().anchorOffset).to.equal(2)

    const textNode = document.createTextNode('abc')
    fixture.appendChild(textNode)
    expect(() => selection.select(textNode, 100)).to.not.throw()
    expect(document.getSelection().anchorOffset).to.equal(3)
  })

  it('accepts comment nodes when clamping range offsets', () => {
    const comment = document.createComment('abc')
    fixture.appendChild(comment)

    expect(() => selection.select(comment, 100)).to.not.throw()
    expect(document.getSelection().anchorOffset).to.equal(3)
  })

  it('fails closed for malformed inline image cursor targets', () => {
    const ctx = createMuyaContext()
    const block = ctx.contentState.getFirstBlock()
    const paragraph = appendParagraph(fixture, block.key, '')
    const inlineImage = document.createElement('span')
    inlineImage.className = 'ag-inline-image'
    inlineImage.setAttribute('data-raw', '![x](y)')
    paragraph.appendChild(inlineImage)

    const result = selection.setCursorRange({
      anchor: { key: block.key, offset: 1 },
      focus: { key: block.key, offset: 1 }
    })

    expect(result).to.equal(false)
  })

  it('returns a null cursor for editor-outside selections', () => {
    const ctx = createMuyaContext()
    const outside = document.createTextNode('outside')
    fixture.appendChild(outside)
    selection.select(outside, 1)

    const cursor = selection.getCursorRange()

    expect(cursor.start).to.equal(null)
    expect(cursor.end).to.equal(null)
    expect(ctx.contentState.selectionChange()).to.equal(null)
  })

  it('does not throw when the editor element is missing', () => {
    const outside = document.createTextNode('outside')
    fixture.appendChild(outside)
    selection.select(outside, 1)

    expect(() => selection.getCursorRange()).to.not.throw()
    expect(selection.getCursorRange().start).to.equal(null)
  })

  it('returns null when a selected paragraph is not present in ContentState', () => {
    const ctx = createMuyaContext()
    const paragraph = appendParagraph(fixture, 'stale-block', 'abc')
    selection.select(paragraph.firstChild, 1)

    expect(selection.getCursorRange().start.key).to.equal('stale-block')
    expect(ctx.contentState.selectionChange()).to.equal(null)
  })

  it('returns empty format info for invalid or stale selections', () => {
    const ctx = createMuyaContext()

    expect(ctx.contentState.selectionFormats({
      start: { key: 'missing', offset: 0 },
      end: { key: 'missing', offset: 0 }
    })).to.deep.equal({ formats: [], tokens: [], neighbors: [] })
  })

  it('keeps selectionChange payload shape for valid selections', () => {
    const ctx = createMuyaContext()
    const block = ctx.contentState.getFirstBlock()
    block.text = 'abc'
    const paragraph = appendParagraph(fixture, block.key, block.text)
    selection.select(paragraph.firstChild, 1)

    const changes = ctx.contentState.selectionChange()

    expect(changes).to.have.property('start')
    expect(changes).to.have.property('end')
    expect(changes).to.have.property('affiliation')
    expect(changes.start.block).to.equal(block)
    expect(changes.end.block).to.equal(block)
  })

  it('does not throw when render helpers see a stale cursor', () => {
    const ctx = createMuyaContext()
    ctx.contentState.cursor = {
      start: { key: 'missing', offset: 0 },
      end: { key: 'missing', offset: 0 }
    }

    expect(() => ctx.contentState.setNextRenderRange()).to.not.throw()
    expect(() => ctx.contentState.getActiveBlocks()).to.not.throw()
    expect(() => ctx.contentState.setCursor()).to.not.throw()
    expect(() => ctx.contentState.checkNeedRender()).to.not.throw()
    expect(ctx.contentState.getActiveBlocks()).to.deep.equal([])
    expect(ctx.contentState.checkNeedRender()).to.equal(false)
  })
})
