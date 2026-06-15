import { describe, it, expect } from 'vitest'
import { aggregateLikes, createConsensusNodes } from '../useLikeAggregation.js'

// ── aggregateLikes ───────────────────────────────────────────────────────────

describe('aggregateLikes – Grundfälle', () => {
  it('gibt leeres Objekt zurück bei leerer Eingabe', () => {
    expect(aggregateLikes([])).toEqual({})
  })

  it('gibt leeres Objekt zurück wenn alle Experten keine Likes haben', () => {
    const experts = [
      { expertId: 'e1', likes: {} },
      { expertId: 'e2', likes: {} },
    ]
    expect(aggregateLikes(experts)).toEqual({})
  })

  it('zählt 1 Like von 1 Experten korrekt', () => {
    const experts = [{ expertId: 'e1', likes: { node1: 'varA' } }]
    const result = aggregateLikes(experts)
    expect(result.node1.varA).toBe(1)
    expect(result.node1.total).toBe(1)
  })
})

describe('aggregateLikes – Aggregation mehrerer Experten', () => {
  it('zählt übereinstimmende Likes kumulativ', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varA' } },
      { expertId: 'e3', likes: { node1: 'varA' } },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.varA).toBe(3)
    expect(result.node1.total).toBe(3)
  })

  it('zählt verschiedene Varianten separat', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varB' } },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.varA).toBe(1)
    expect(result.node1.varB).toBe(1)
    expect(result.node1.total).toBe(2)
  })

  it('aggregiert mehrere Nodes unabhängig', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA', node2: 'varB' } },
      { expertId: 'e2', likes: { node1: 'varA', node2: 'varA' } },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.varA).toBe(2)
    expect(result.node2.varB).toBe(1)
    expect(result.node2.varA).toBe(1)
  })

  it('ignoriert Experten ohne likes-Feld', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2' },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.total).toBe(1)
  })
})

describe('aggregateLikes – Konsens-Berechnung', () => {
  it('setzt majority wenn Schwellwert erreicht (Standard 2/3)', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varA' } },
      { expertId: 'e3', likes: { node1: 'varB' } },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.majority).toBe('varA')
    expect(result.node1.consensusRatio).toBeCloseTo(0.667, 2)
    expect(result.node1.isControversial).toBe(false)
  })

  it('setzt majority nicht wenn Schwellwert knapp verfehlt', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varA' } },
      { expertId: 'e3', likes: { node1: 'varB' } },
      { expertId: 'e4', likes: { node1: 'varB' } },
    ]
    const result = aggregateLikes(experts, { consensusThreshold: 0.8 })
    expect(result.node1.majority).toBeNull()
    expect(result.node1.isControversial).toBe(true)
  })

  it('markiert Gleichstand als strittig', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varB' } },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.majority).toBeNull()
    expect(result.node1.isControversial).toBe(true)
  })

  it('ist nicht strittig bei einem einzigen Experten (keine Konkurrenz)', () => {
    const experts = [{ expertId: 'e1', likes: { node1: 'varA' } }]
    const result = aggregateLikes(experts)
    expect(result.node1.majority).toBe('varA')
    expect(result.node1.isControversial).toBe(false)
  })

  it('gibt consensusRatio 1.0 bei vollständiger Einigkeit', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varA' } },
    ]
    const result = aggregateLikes(experts)
    expect(result.node1.consensusRatio).toBe(1)
  })

  it('respektiert benutzerdefinierten Schwellwert', () => {
    const experts = [
      { expertId: 'e1', likes: { node1: 'varA' } },
      { expertId: 'e2', likes: { node1: 'varA' } },
      { expertId: 'e3', likes: { node1: 'varA' } },
      { expertId: 'e4', likes: { node1: 'varB' } },
    ]
    const resultDefault = aggregateLikes(experts)
    expect(resultDefault.node1.majority).toBe('varA')

    const resultStrict = aggregateLikes(experts, { consensusThreshold: 0.9 })
    expect(resultStrict.node1.majority).toBeNull()
  })
})

// ── createConsensusNodes ─────────────────────────────────────────────────────

const makeNode = (id, label, extra = {}) => ({ id, label, type: 'subquestion', ...extra })

describe('createConsensusNodes – Grundfälle', () => {
  it('gibt Baseline-Nodes zurück wenn keine Majorities', () => {
    const baseline = [makeNode('n1', 'Original')]
    const result = createConsensusNodes(baseline, {}, {})
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Original')
  })

  it('mutiert die originale Baseline nicht', () => {
    const baseline = [makeNode('n1', 'Original')]
    createConsensusNodes(baseline, {}, {})
    expect(baseline[0].label).toBe('Original')
  })

  it('ersetzt Node mit Majority-Version aus bevorzugter Variante', () => {
    const baseline = [makeNode('n1', 'Original')]
    const variantsMap = {
      varA: { nodes: [makeNode('n1', 'Variante A Version')] },
    }
    const aggregation = {
      n1: { varA: 2, total: 2, majority: 'varA', consensusRatio: 1, isControversial: false },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].label).toBe('Variante A Version')
  })

  it('lässt strittige Nodes unverändert (Baseline)', () => {
    const baseline = [makeNode('n1', 'Original')]
    const variantsMap = {
      varA: { nodes: [makeNode('n1', 'A')] },
      varB: { nodes: [makeNode('n1', 'B')] },
    }
    const aggregation = {
      n1: { varA: 1, varB: 1, total: 2, majority: null, isControversial: true },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].label).toBe('Original')
  })

  it('fällt auf Baseline zurück wenn Majority-Variante den Node nicht enthält', () => {
    const baseline = [makeNode('n1', 'Original')]
    const variantsMap = {
      varA: { nodes: [] },
    }
    const aggregation = {
      n1: { varA: 2, total: 2, majority: 'varA', consensusRatio: 1, isControversial: false },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].label).toBe('Original')
  })
})

describe('createConsensusNodes – verschachtelte Strukturen', () => {
  it('ersetzt einen tief verschachtelten Node (section > question > item)', () => {
    const baseline = [{
      id: 's1', type: 'section', label: 'Abschnitt',
      children: [{
        id: 'q1', type: 'question', label: 'Frage',
        children: [makeNode('n1', 'Original Item')],
      }],
    }]
    const variantsMap = {
      varA: {
        nodes: [{
          id: 's1', type: 'section', label: 'Abschnitt',
          children: [{
            id: 'q1', type: 'question', label: 'Frage',
            children: [makeNode('n1', 'Variante A Item')],
          }],
        }],
      },
    }
    const aggregation = {
      n1: { varA: 3, total: 3, majority: 'varA', consensusRatio: 1, isControversial: false },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].children[0].children[0].label).toBe('Variante A Item')
  })

  it('lässt nicht-betroffene Nodes unverändert', () => {
    const baseline = [
      makeNode('n1', 'Original 1'),
      makeNode('n2', 'Original 2'),
    ]
    const variantsMap = {
      varA: { nodes: [makeNode('n1', 'Variante A'), makeNode('n2', 'Variante A 2')] },
    }
    const aggregation = {
      n1: { varA: 2, total: 2, majority: 'varA', consensusRatio: 1, isControversial: false },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].label).toBe('Variante A')
    expect(result[1].label).toBe('Original 2')
  })

  it('verarbeitet Nodes in branches', () => {
    const baseline = [{
      id: 'q1', type: 'question', label: 'Frage',
      branches: [{
        children: [makeNode('n1', 'Original in Branch')],
      }],
    }]
    const variantsMap = {
      varA: {
        nodes: [{
          id: 'q1', type: 'question', label: 'Frage',
          branches: [{
            children: [makeNode('n1', 'Branch in Variante A')],
          }],
        }],
      },
    }
    const aggregation = {
      n1: { varA: 2, total: 2, majority: 'varA', consensusRatio: 1, isControversial: false },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].branches[0].children[0].label).toBe('Branch in Variante A')
  })
})

describe('createConsensusNodes – mehrere Majority-Nodes aus verschiedenen Varianten', () => {
  it('kann für verschiedene Nodes verschiedene Varianten bevorzugen', () => {
    const baseline = [makeNode('n1', 'Original 1'), makeNode('n2', 'Original 2')]
    const variantsMap = {
      varA: { nodes: [makeNode('n1', 'A-Version 1'), makeNode('n2', 'A-Version 2')] },
      varB: { nodes: [makeNode('n1', 'B-Version 1'), makeNode('n2', 'B-Version 2')] },
    }
    const aggregation = {
      n1: { varA: 3, varB: 1, total: 4, majority: 'varA', consensusRatio: 0.75, isControversial: false },
      n2: { varA: 1, varB: 3, total: 4, majority: 'varB', consensusRatio: 0.75, isControversial: false },
    }
    const result = createConsensusNodes(baseline, aggregation, variantsMap)
    expect(result[0].label).toBe('A-Version 1')
    expect(result[1].label).toBe('B-Version 2')
  })
})
