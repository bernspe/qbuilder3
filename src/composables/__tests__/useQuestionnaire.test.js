import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useQuestionnaire } from '../useQuestionnaire.js'

// localStorage is available in happy-dom, but we stub it to avoid side effects
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  })
})

describe('makeNode – question type', () => {
  it('has icon field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('icon', '')
  })

  it('has subheading defaulting to "Screeningfrage"', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('subheading', 'Screeningfrage')
  })

  it('has question field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('question', '')
  })

  it('has reference field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('reference', '')
  })

  it('has defaultIdx defaulting to null', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('defaultIdx', null)
  })

  it('has questionType defaulting to "yesno"', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('questionType', 'yesno')
  })

  it('has answerOrder defaulting to "schlecht-gut"', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    expect(node).toHaveProperty('answerOrder', 'schlecht-gut')
  })
})

describe('e-screen questionType', () => {
  it('can be set on a question node', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    node.questionType = 'e-screen'
    expect(qb.findInVariant(node.id).questionType).toBe('e-screen')
  })

  it('accepts 3 bipolar options with defaultIdx 1', () => {
    const qb = useQuestionnaire()
    const node = qb.addNode('question', null)
    node.questionType = 'e-screen'
    node.options    = ['Erschwert meinen Alltag', 'Kein Einfluss', 'Erleichtert meinen Alltag']
    node.defaultIdx = 1
    const n = qb.findInVariant(node.id)
    expect(n.options).toHaveLength(3)
    expect(n.defaultIdx).toBe(1)
    expect(n.options[1]).toBe('Kein Einfluss')
  })
})

describe('makeNode – subquestion type', () => {
  it('has icon field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('subquestion', section.id)
    expect(node).toHaveProperty('icon', '')
  })

  it('has subheading defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('subquestion', section.id)
    expect(node).toHaveProperty('subheading', '')
  })

  it('has question field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('subquestion', section.id)
    expect(node).toHaveProperty('question', '')
  })

  it('has reference field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('subquestion', section.id)
    expect(node).toHaveProperty('reference', '')
  })

  it('has defaultIdx defaulting to null', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('subquestion', section.id)
    expect(node).toHaveProperty('defaultIdx', null)
  })

  it('has answerOrder defaulting to "schlecht-gut"', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('subquestion', section.id)
    expect(node).toHaveProperty('answerOrder', 'schlecht-gut')
  })
})

describe('deleteVariant', () => {
  it('gibt false zurück wenn nur eine Variante existiert', () => {
    const qb = useQuestionnaire()
    expect(qb.deleteVariant('main')).toBe(false)
  })

  it('löscht eine Variante wenn mehr als eine existiert', () => {
    const qb = useQuestionnaire()
    qb.addVariant('v2')
    qb.deleteVariant('v2')
    expect(qb.variantList.value.map(v => v.id)).not.toContain('v2')
  })

  it('wechselt weg von der aktiven Variante wenn diese gelöscht wird', () => {
    const qb = useQuestionnaire()
    qb.addVariant('v2')
    qb.switchVariant('v2')
    expect(qb.currentVariant.value).toBe('v2')
    qb.deleteVariant('v2')
    expect(qb.currentVariant.value).not.toBe('v2')
  })

  it('behält die aktive Variante wenn eine andere gelöscht wird', () => {
    const qb = useQuestionnaire()
    qb.addVariant('v2')
    qb.deleteVariant('v2')
    expect(qb.currentVariant.value).toBe('main')
  })

  it('gibt false zurück wenn die ID nicht existiert', () => {
    const qb = useQuestionnaire()
    qb.addVariant('v2')
    expect(qb.deleteVariant('nonexistent')).toBe(false)
  })
})

describe('renameVariant', () => {
  it('migriert id und label auf den neuen Namen', () => {
    const qb = useQuestionnaire()
    const newId = qb.renameVariant('main', 'Neuer Name')
    expect(newId).toBe('Neuer Name')
    expect(qb.variants['Neuer Name']).toBeDefined()
    expect(qb.variants['Neuer Name'].id).toBe('Neuer Name')
    expect(qb.variants['Neuer Name'].label).toBe('Neuer Name')
    expect(qb.variants['main']).toBeUndefined()
  })

  it('aktualisiert currentVariant wenn die aktive Variante umbenannt wird', () => {
    const qb = useQuestionnaire()
    qb.addNode('section', null)
    qb.renameVariant('main', 'Umbenannt')
    expect(qb.currentVariant.value).toBe('Umbenannt')
    expect(qb.nodes.value.length).toBe(1)
  })

  it('gibt false zurück wenn die ID nicht existiert', () => {
    const qb = useQuestionnaire()
    expect(qb.renameVariant('nonexistent', 'Test')).toBe(false)
  })

  it('gibt false zurück wenn der neue Name bereits vergeben ist', () => {
    const qb = useQuestionnaire()
    qb.addVariant('andere')
    expect(qb.renameVariant('main', 'andere')).toBe(false)
  })

  it('gibt true zurück wenn Name unverändert bleibt', () => {
    const qb = useQuestionnaire()
    expect(qb.renameVariant('main', 'main')).toBe(true)
    expect(qb.variants['main']).toBeDefined()
  })

  it('leerer Name wird abgelehnt', () => {
    const qb = useQuestionnaire()
    expect(qb.renameVariant('main', '')).toBe(false)
    expect(qb.variants['main'].label).toBe('Original')
  })
})

describe('makeNode – icf type', () => {
  it('has icon field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('icf', section.id)
    expect(node).toHaveProperty('icon', '')
  })

  it('has subheading defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('icf', section.id)
    expect(node).toHaveProperty('subheading', '')
  })

  it('has question field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('icf', section.id)
    expect(node).toHaveProperty('question', '')
  })

  it('has reference field defaulting to empty string', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('icf', section.id)
    expect(node).toHaveProperty('reference', '')
  })

  it('has defaultIdx defaulting to null', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('icf', section.id)
    expect(node).toHaveProperty('defaultIdx', null)
  })

  it('does NOT have answerOrder (only subquestion has it)', () => {
    const qb = useQuestionnaire()
    const section = qb.addNode('section', null)
    const node = qb.addNode('icf', section.id)
    expect(node).not.toHaveProperty('answerOrder')
  })
})
