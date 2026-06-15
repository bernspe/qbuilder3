import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLikes } from '../useLikes.js'

const mockStorage = {}
beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k])
  vi.stubGlobal('localStorage', {
    getItem: (k) => mockStorage[k] ?? null,
    setItem: (k, v) => { mockStorage[k] = v },
    removeItem: (k) => { delete mockStorage[k] },
  })
})

// ── toggleLike ──────────────────────────────────────────────────────────────

describe('toggleLike', () => {
  it('fügt Like hinzu wenn noch keines vorhanden', () => {
    const { likes, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    expect(likes.value['node1']).toBe('varA')
  })

  it('entfernt Like beim zweiten Klick auf dieselbe Variante', () => {
    const { likes, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    toggleLike('node1', 'varA')
    expect(likes.value['node1']).toBeUndefined()
  })

  it('ersetzt Like wenn andere Variante gewählt wird', () => {
    const { likes, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    toggleLike('node1', 'varB')
    expect(likes.value['node1']).toBe('varB')
    expect(Object.keys(likes.value)).toHaveLength(1)
  })

  it('verwaltet mehrere Nodes unabhängig', () => {
    const { likes, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    toggleLike('node2', 'varB')
    expect(likes.value['node1']).toBe('varA')
    expect(likes.value['node2']).toBe('varB')
  })

  it('ignoriert Aufrufe ohne nodeId', () => {
    const { likes, toggleLike } = useLikes()
    toggleLike(null, 'varA')
    toggleLike(undefined, 'varA')
    toggleLike('', 'varA')
    expect(Object.keys(likes.value)).toHaveLength(0)
  })

  it('ignoriert Aufrufe ohne variantId', () => {
    const { likes, toggleLike } = useLikes()
    toggleLike('node1', null)
    toggleLike('node1', undefined)
    expect(Object.keys(likes.value)).toHaveLength(0)
  })

  it('speichert in localStorage', () => {
    const { toggleLike } = useLikes('test_key')
    toggleLike('node1', 'varA')
    const stored = JSON.parse(localStorage.getItem('test_key'))
    expect(stored['node1']).toBe('varA')
  })

  it('entfernt Eintrag aus localStorage beim Unlike', () => {
    const { toggleLike } = useLikes('test_key')
    toggleLike('node1', 'varA')
    toggleLike('node1', 'varA')
    const stored = JSON.parse(localStorage.getItem('test_key'))
    expect(stored['node1']).toBeUndefined()
  })
})

// ── isLiked ─────────────────────────────────────────────────────────────────

describe('isLiked', () => {
  it('gibt true zurück für den gelikten Node + Variante', () => {
    const { isLiked, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    expect(isLiked('node1', 'varA')).toBe(true)
  })

  it('gibt false zurück für falsche Variante am gleichen Node', () => {
    const { isLiked, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    expect(isLiked('node1', 'varB')).toBe(false)
  })

  it('gibt false zurück für unbekannten Node', () => {
    const { isLiked } = useLikes()
    expect(isLiked('unbekannt', 'varA')).toBe(false)
  })

  it('gibt false zurück nach Unlike', () => {
    const { isLiked, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    toggleLike('node1', 'varA')
    expect(isLiked('node1', 'varA')).toBe(false)
  })
})

// ── forExport ───────────────────────────────────────────────────────────────

describe('forExport', () => {
  it('gibt leeres Objekt zurück wenn keine Likes', () => {
    const { forExport } = useLikes()
    expect(forExport()).toEqual({})
  })

  it('gibt nodeId→variantId Mapping zurück', () => {
    const { forExport, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    toggleLike('node2', 'varB')
    expect(forExport()).toEqual({ node1: 'varA', node2: 'varB' })
  })

  it('gibt eine Kopie zurück (kein shared reference)', () => {
    const { forExport, toggleLike } = useLikes()
    toggleLike('node1', 'varA')
    const exported = forExport()
    exported['node1'] = 'MANIPULIERT'
    const exported2 = forExport()
    expect(exported2['node1']).toBe('varA')
  })
})

// ── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('löscht alle Likes', () => {
    const { likes, toggleLike, clear } = useLikes()
    toggleLike('node1', 'varA')
    toggleLike('node2', 'varB')
    clear()
    expect(Object.keys(likes.value)).toHaveLength(0)
  })

  it('löscht auch localStorage', () => {
    const { toggleLike, clear } = useLikes('test_key')
    toggleLike('node1', 'varA')
    clear()
    const stored = JSON.parse(localStorage.getItem('test_key') ?? '{}')
    expect(Object.keys(stored)).toHaveLength(0)
  })
})

// ── localStorage-Persistenz ─────────────────────────────────────────────────

describe('localStorage-Persistenz', () => {
  it('stellt gespeicherte Likes beim Laden wieder her', () => {
    mockStorage['test_key'] = JSON.stringify({ node1: 'varA', node2: 'varB' })
    const { likes } = useLikes('test_key')
    expect(likes.value['node1']).toBe('varA')
    expect(likes.value['node2']).toBe('varB')
  })

  it('ignoriert korrupte localStorage-Daten', () => {
    mockStorage['test_key'] = 'KEIN_JSON'
    const { likes } = useLikes('test_key')
    expect(likes.value).toEqual({})
  })
})
