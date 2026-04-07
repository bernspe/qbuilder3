import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAutosave } from '../useAutosave.js'

let localStorageData = {}

beforeEach(() => {
  localStorageData = {}
  vi.stubGlobal('localStorage', {
    getItem: (key) => localStorageData[key] ?? null,
    setItem: (key, val) => { localStorageData[key] = val },
    removeItem: (key) => { delete localStorageData[key] },
  })
  vi.stubGlobal('fetch', vi.fn())
})

// ── markLinked / isLinked / purgeLinked / renameLinked ────────────────────────

describe('markLinked / isLinked', () => {
  it('isLinked gibt false für unbekannte Variante zurück', () => {
    const a = useAutosave()
    expect(a.isLinked('unbekannt')).toBe(false)
  })

  it('markLinked markiert Variante als verlinkt', () => {
    const a = useAutosave()
    a.markLinked('v1')
    expect(a.isLinked('v1')).toBe(true)
  })

  it('markLinked persistiert in localStorage', () => {
    const a = useAutosave()
    a.markLinked('v1')
    const stored = JSON.parse(localStorageData['qb_server_linked'])
    expect(stored).toContain('v1')
  })

  it('mehrfaches markLinked für dieselbe ID fügt keine Duplikate ein', () => {
    const a = useAutosave()
    a.markLinked('v1')
    a.markLinked('v1')
    const stored = JSON.parse(localStorageData['qb_server_linked'])
    expect(stored.filter(x => x === 'v1').length).toBe(1)
  })
})

describe('purgeLinked', () => {
  it('purgeLinked entfernt Variante aus verlinktem Set', () => {
    const a = useAutosave()
    a.markLinked('v1')
    a.purgeLinked('v1')
    expect(a.isLinked('v1')).toBe(false)
  })

  it('purgeLinked für unbekannte ID wirft keinen Fehler', () => {
    const a = useAutosave()
    expect(() => a.purgeLinked('unbekannt')).not.toThrow()
  })
})

describe('renameLinked', () => {
  it('renameLinked migriert ID korrekt', () => {
    const a = useAutosave()
    a.markLinked('alt')
    a.renameLinked('alt', 'neu')
    expect(a.isLinked('alt')).toBe(false)
    expect(a.isLinked('neu')).toBe(true)
  })

  it('renameLinked für unbekannte ID wirft keinen Fehler', () => {
    const a = useAutosave()
    expect(() => a.renameLinked('gibtsNicht', 'neu')).not.toThrow()
  })
})

// ── getStatus / setStatus ──────────────────────────────────────────────────────

describe('getStatus / setStatus', () => {
  it('getStatus gibt { status: idle } für unbekannte Variante zurück', () => {
    const a = useAutosave()
    expect(a.getStatus('unbekannt').status).toBe('idle')
  })

  it('getStatus gibt leere message für unbekannte Variante zurück', () => {
    const a = useAutosave()
    expect(a.getStatus('unbekannt').message).toBe('')
  })

  it('setStatus aktualisiert den Status', () => {
    const a = useAutosave()
    a.setStatus('v1', 'saving')
    expect(a.getStatus('v1').status).toBe('saving')
  })

  it('setStatus mit message setzt message korrekt', () => {
    const a = useAutosave()
    a.setStatus('v1', 'error', 'Verbindungsfehler')
    expect(a.getStatus('v1').message).toBe('Verbindungsfehler')
  })
})

// ── recordSave / getSavedAt ───────────────────────────────────────────────────

describe('recordSave / getSavedAt', () => {
  it('getSavedAt gibt null für unbekannte Variante zurück', () => {
    const a = useAutosave()
    expect(a.getSavedAt('unbekannt')).toBeNull()
  })

  it('recordSave speichert Timestamp', () => {
    const a = useAutosave()
    a.recordSave('v1', '2026-04-06T10:00:00.000Z')
    expect(a.getSavedAt('v1')).toBe('2026-04-06T10:00:00.000Z')
  })

  it('recordSave persistiert in localStorage', () => {
    const a = useAutosave()
    a.recordSave('v1', '2026-04-06T10:00:00.000Z')
    const stored = JSON.parse(localStorageData['qb_server_saved_at'])
    expect(stored['v1']).toBe('2026-04-06T10:00:00.000Z')
  })
})

// ── saveToServer ──────────────────────────────────────────────────────────────

describe('saveToServer', () => {
  const exportData = JSON.stringify({
    exportedAt: '2026-04-06T12:00:00.000Z',
    variants: { v1: { id: 'v1', label: 'Test', nodes: [] } },
    ratings: {}
  })

  function mockFetchOk() {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })
  }

  function mockFetchError(status = 500) {
    fetch.mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error: 'Server-Fehler' }),
    })
  }

  it('setzt Status auf saving dann saved bei Erfolg', async () => {
    const a = useAutosave('http://srv')
    mockFetchOk()
    const promise = a.saveToServer('v1', exportData)
    expect(a.getStatus('v1').status).toBe('saving')
    await promise
    expect(a.getStatus('v1').status).toBe('saved')
  })

  it('ruft fetch mit korrekter URL auf', async () => {
    const a = useAutosave('http://srv')
    mockFetchOk()
    await a.saveToServer('v1', exportData)
    expect(fetch).toHaveBeenCalledWith(
      'http://srv/php/upload.php?filename=v1.json',
      expect.objectContaining({ method: 'POST', body: exportData })
    )
  })

  it('markiert Variante als verlinkt nach Erfolg', async () => {
    const a = useAutosave('http://srv')
    mockFetchOk()
    await a.saveToServer('v1', exportData)
    expect(a.isLinked('v1')).toBe(true)
  })

  it('speichert exportedAt-Timestamp nach Erfolg', async () => {
    const a = useAutosave('http://srv')
    mockFetchOk()
    await a.saveToServer('v1', exportData)
    expect(a.getSavedAt('v1')).toBe('2026-04-06T12:00:00.000Z')
  })

  it('message im saved-Status enthält den Timestamp', async () => {
    const a = useAutosave('http://srv')
    mockFetchOk()
    await a.saveToServer('v1', exportData)
    expect(a.getStatus('v1').message).toBe('2026-04-06T12:00:00.000Z')
  })

  it('setzt Status auf error bei HTTP-Fehler', async () => {
    const a = useAutosave('http://srv')
    mockFetchError()
    await expect(a.saveToServer('v1', exportData)).rejects.toThrow()
    expect(a.getStatus('v1').status).toBe('error')
  })

  it('setzt Status auf error bei Netzwerkfehler', async () => {
    const a = useAutosave('http://srv')
    fetch.mockRejectedValue(new Error('NetworkError'))
    await expect(a.saveToServer('v1', exportData)).rejects.toThrow()
    expect(a.getStatus('v1').status).toBe('error')
  })

  it('wirft Fehler bei Misserfolg', async () => {
    const a = useAutosave('http://srv')
    mockFetchError()
    await expect(a.saveToServer('v1', exportData)).rejects.toThrow()
  })
})

// ── checkServerVersion ────────────────────────────────────────────────────────

describe('checkServerVersion', () => {
  it('gibt { newer: false } wenn kein lokaler savedAt vorhanden', async () => {
    const a = useAutosave('http://srv')
    const result = await a.checkServerVersion('v1')
    expect(result.newer).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('gibt { newer: false } wenn Server 404 zurückgibt', async () => {
    const a = useAutosave('http://srv')
    a.recordSave('v1', '2026-04-06T10:00:00.000Z')
    fetch.mockResolvedValue({ ok: false, status: 404 })
    const result = await a.checkServerVersion('v1')
    expect(result.newer).toBe(false)
    expect(result.serverTimestamp).toBeNull()
  })

  it('gibt { newer: true } wenn Server-Timestamp neuer ist', async () => {
    const a = useAutosave('http://srv')
    a.recordSave('v1', '2026-04-06T10:00:00.000Z')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        exportedAt: '2026-04-06T11:00:00.000Z',
        variants: {}
      }),
    })
    const result = await a.checkServerVersion('v1')
    expect(result.newer).toBe(true)
    expect(result.serverTimestamp).toBe('2026-04-06T11:00:00.000Z')
  })

  it('gibt { newer: false } wenn lokaler Timestamp neuer ist', async () => {
    const a = useAutosave('http://srv')
    a.recordSave('v1', '2026-04-06T12:00:00.000Z')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        exportedAt: '2026-04-06T11:00:00.000Z',
        variants: {}
      }),
    })
    const result = await a.checkServerVersion('v1')
    expect(result.newer).toBe(false)
  })

  it('gibt { newer: false } wenn Timestamps gleich sind', async () => {
    const a = useAutosave('http://srv')
    a.recordSave('v1', '2026-04-06T10:00:00.000Z')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        exportedAt: '2026-04-06T10:00:00.000Z',
        variants: {}
      }),
    })
    const result = await a.checkServerVersion('v1')
    expect(result.newer).toBe(false)
  })

  it('ruft fetch mit korrekter URL auf', async () => {
    const a = useAutosave('http://srv')
    a.recordSave('v1', '2026-04-06T10:00:00.000Z')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ exportedAt: '2026-04-06T09:00:00.000Z', variants: {} }),
    })
    await a.checkServerVersion('v1')
    expect(fetch).toHaveBeenCalledWith('http://srv/php/get_variant.php?name=v1')
  })
})

// ── fetchServerVariants ───────────────────────────────────────────────────────

describe('fetchServerVariants', () => {
  it('gibt Array der Variantennamen zurück', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ variants: ['mina', 'anna'] }),
    })
    const result = await a.fetchServerVariants()
    expect(result).toEqual(['mina', 'anna'])
  })

  it('ruft fetch mit korrekter URL auf', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ variants: [] }),
    })
    await a.fetchServerVariants()
    expect(fetch).toHaveBeenCalledWith('http://srv/php/get_variants.php')
  })

  it('gibt leeres Array zurück wenn Server nicht erreichbar', async () => {
    const a = useAutosave('http://srv')
    fetch.mockRejectedValue(new Error('NetworkError'))
    const result = await a.fetchServerVariants()
    expect(result).toEqual([])
  })

  it('gibt leeres Array zurück bei HTTP-Fehler', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({ ok: false, status: 500 })
    const result = await a.fetchServerVariants()
    expect(result).toEqual([])
  })

  it('gibt leeres Array zurück wenn variants-Key fehlt', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    const result = await a.fetchServerVariants()
    expect(result).toEqual([])
  })
})

// ── deleteFromServer ──────────────────────────────────────────────────────────

describe('deleteFromServer', () => {
  it('ruft fetch mit korrekter URL und POST auf', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    await a.deleteFromServer('mina')
    expect(fetch).toHaveBeenCalledWith(
      'http://srv/php/delete_variant.php?name=mina',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('gibt true zurück bei Erfolg', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    expect(await a.deleteFromServer('mina')).toBe(true)
  })

  it('gibt false zurück bei HTTP-Fehler', async () => {
    const a = useAutosave('http://srv')
    fetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: 'nicht gefunden' }) })
    expect(await a.deleteFromServer('mina')).toBe(false)
  })

  it('gibt false zurück bei Netzwerkfehler', async () => {
    const a = useAutosave('http://srv')
    fetch.mockRejectedValue(new Error('NetworkError'))
    expect(await a.deleteFromServer('mina')).toBe(false)
  })

  it('wirft keinen Fehler bei Misserfolg', async () => {
    const a = useAutosave('http://srv')
    fetch.mockRejectedValue(new Error('NetworkError'))
    await expect(a.deleteFromServer('mina')).resolves.not.toThrow()
  })

  it('ruft fetch NICHT auf für original_pgraph und gibt false zurück', async () => {
    const a = useAutosave('http://srv')
    const result = await a.deleteFromServer('original_pgraph')
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })
})
