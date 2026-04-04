import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGamification } from '../useGamification.js'

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  })
})

// ── setRating / getRating ──────────────────────────────────────────────────

describe('setRating / getRating', () => {
  it('speichert eine Wichtigkeitsbewertung', () => {
    const g = useGamification()
    g.setRating('v1', 'nodeA', 'importance', 4)
    expect(g.getRating('v1', 'nodeA').importance).toBe(4)
  })

  it('speichert eine Verständlichkeitsbewertung', () => {
    const g = useGamification()
    g.setRating('v1', 'nodeA', 'understandability', 3)
    expect(g.getRating('v1', 'nodeA').understandability).toBe(3)
  })

  it('gibt null zurück für unbewertete Nodes', () => {
    const g = useGamification()
    const r = g.getRating('v1', 'unbewertete-node')
    expect(r.importance).toBeNull()
    expect(r.understandability).toBeNull()
  })

  it('überschreibt eine bestehende Bewertung', () => {
    const g = useGamification()
    g.setRating('v1', 'nodeA', 'importance', 2)
    g.setRating('v1', 'nodeA', 'importance', 5)
    expect(g.getRating('v1', 'nodeA').importance).toBe(5)
  })
})

// ── isRated ────────────────────────────────────────────────────────────────

describe('isRated', () => {
  it('gibt false zurück wenn nur Wichtigkeit gesetzt', () => {
    const g = useGamification()
    g.setRating('v1', 'nodeA', 'importance', 3)
    expect(g.isRated('v1', 'nodeA')).toBe(false)
  })

  it('gibt false zurück wenn nur Verständlichkeit gesetzt', () => {
    const g = useGamification()
    g.setRating('v1', 'nodeA', 'understandability', 3)
    expect(g.isRated('v1', 'nodeA')).toBe(false)
  })

  it('gibt true zurück wenn beide Bewertungen gesetzt', () => {
    const g = useGamification()
    g.setRating('v1', 'nodeA', 'importance', 5)
    g.setRating('v1', 'nodeA', 'understandability', 2)
    expect(g.isRated('v1', 'nodeA')).toBe(true)
  })

  it('gibt false zurück für unbewertete Node', () => {
    const g = useGamification()
    expect(g.isRated('v1', 'unbekannt')).toBe(false)
  })
})

// ── calculatePoints – Grundfälle ───────────────────────────────────────────

describe('calculatePoints – Grundfälle', () => {
  it('gibt 0 für die erste (Baseline-)Variante zurück', () => {
    const g = useGamification()
    const variants = { main: { nodes: [] } }
    expect(g.calculatePoints(variants, 'main')).toBe(0)
  })

  it('gibt 0 für die erste Variante wenn kein "main"-Key existiert', () => {
    const g = useGamification()
    const variants = { baseline: { nodes: [] }, other: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] } }
    expect(g.calculatePoints(variants, 'baseline')).toBe(0)
  })

  it('vergleicht gegen die erste Variante wenn "main" fehlt', () => {
    const g = useGamification()
    const variants = {
      baseline: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
      other: { nodes: [] },
    }
    // 'other' hat 1 Item weniger als 'baseline' → 5 Pkt Entfernung
    expect(g.calculatePoints(variants, 'other')).toBe(5)
  })

  it('gibt 0 für leere Variante ohne Unterschiede', () => {
    const g = useGamification()
    const variants = { main: { nodes: [] }, v1: { nodes: [] } }
    expect(g.calculatePoints(variants, 'v1')).toBe(0)
  })
})

// ── calculatePoints – neue Items ───────────────────────────────────────────

describe('calculatePoints – neue Items', () => {
  it('gibt 10 Pkt für neue Frage', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(10)
  })

  it('gibt 10 Pkt für neue Unterfrage', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'sq1', type: 'subquestion', label: 'SQ' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(10)
  })

  it('gibt 10 Pkt für neues ICF-Item', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'icf1', type: 'icf', label: 'ICF' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(10)
  })

  it('gibt keine Punkte für neue Abschnitte', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 's1', type: 'section', label: 'S', children: [] }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(0)
  })

  it('summiert Punkte für mehrere neue Items', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [
        { id: 'q1', type: 'question', label: 'Q1' },
        { id: 'q2', type: 'question', label: 'Q2' },
      ]},
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(20)
  })
})

// ── calculatePoints – Entfernte Items ─────────────────────────────────────

describe('calculatePoints – Entfernte Items', () => {
  it('gibt 5 Pkt pro entferntem Item', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
      v1: { nodes: [] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(5)
  })

  it('deckt Entfernungspunkte bei 5 Items (25 Pkt) ab', () => {
    const g = useGamification()
    const makeQ = (id) => ({ id, type: 'question', label: id })
    const variants = {
      main: { nodes: [makeQ('q1'), makeQ('q2'), makeQ('q3'), makeQ('q4'), makeQ('q5'), makeQ('q6')] },
      v1: { nodes: [] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(25)
  })

  it('gibt maximal 25 Pkt für Entfernungen aus', () => {
    const g = useGamification()
    const makeQ = (id) => ({ id, type: 'question', label: id })
    const variants = {
      main: { nodes: [makeQ('q1'), makeQ('q2'), makeQ('q3'), makeQ('q4'), makeQ('q5'), makeQ('q6'), makeQ('q7')] },
      v1: { nodes: [] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(25)
  })
})

// ── calculatePoints – Feldänderungen ──────────────────────────────────────

describe('calculatePoints – Feldänderungen', () => {
  const base = { id: 'q1', type: 'question', label: 'Q', icon: '', question: '', reference: '', subheading: '', helpText: '', options: [], defaultIdx: null, answerOrder: '' }

  it('gibt 2 Pkt für Befüllen eines leeren Feldes', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [{ ...base }] },
      v1: { nodes: [{ ...base, icon: 'some-icon' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(2)
  })

  it('gibt 1 Pkt für Änderung eines bestehenden Feldes', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [{ ...base, icon: 'old-icon' }] },
      v1: { nodes: [{ ...base, icon: 'new-icon' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(1)
  })

  it('gibt keine Punkte wenn Feld geleert wird', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [{ ...base, icon: 'old-icon' }] },
      v1: { nodes: [{ ...base, icon: '' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(0)
  })

  it('summiert Punkte für mehrere geänderte Felder', () => {
    const g = useGamification()
    const variants = {
      main: { nodes: [{ ...base }] },
      v1: { nodes: [{ ...base, icon: 'icon', question: 'Eine Frage' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(4)
  })
})

// ── calculatePoints – Bewertungspunkte ────────────────────────────────────

describe('calculatePoints – Bewertungspunkte', () => {
  it('gibt 2 Pkt für Wichtigkeitsbewertung', () => {
    const g = useGamification()
    g.setRating('v1', 'q1', 'importance', 4)
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(12) // 10 (neu) + 2 (importance)
  })

  it('gibt 2 Pkt für Verständlichkeitsbewertung', () => {
    const g = useGamification()
    g.setRating('v1', 'q1', 'understandability', 3)
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(12) // 10 (neu) + 2 (understandability)
  })

  it('gibt 4 Pkt wenn beide Bewertungen gesetzt', () => {
    const g = useGamification()
    g.setRating('v1', 'q1', 'importance', 5)
    g.setRating('v1', 'q1', 'understandability', 5)
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(14) // 10 + 4
  })
})

// ── purgeVariantRatings ────────────────────────────────────────────────────

describe('purgeVariantRatings', () => {
  it('entfernt alle Ratings einer gelöschten Variante', () => {
    const g = useGamification()
    g.setRating('v1', 'q1', 'importance', 3)
    g.purgeVariantRatings('v1')
    expect(g.getRating('v1', 'q1').importance).toBeNull()
  })

  it('lässt Ratings anderer Varianten unberührt', () => {
    const g = useGamification()
    g.setRating('v1', 'q1', 'importance', 3)
    g.setRating('v2', 'q1', 'importance', 5)
    g.purgeVariantRatings('v1')
    expect(g.getRating('v2', 'q1').importance).toBe(5)
  })
})

// ── Konfiguration ──────────────────────────────────────────────────────────

describe('GAMIFICATION_CONFIG – überschreibbar', () => {
  it('verwendet benutzerdefinierte Punktewerte', () => {
    const customConfig = {
      newItemPoints: 20,
      removeItemPoints: 5,
      maxRemovalItems: 5,
      fillEmptyFieldPoints: 2,
      changeFieldPoints: 1,
      importanceRatingPoints: 2,
      understandabilityRatingPoints: 2,
    }
    const g = useGamification(customConfig)
    const variants = {
      main: { nodes: [] },
      v1: { nodes: [{ id: 'q1', type: 'question', label: 'Q' }] },
    }
    expect(g.calculatePoints(variants, 'v1')).toBe(20)
  })
})
