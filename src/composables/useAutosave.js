import { reactive } from 'vue'

const LINKED_KEY   = 'qb_server_linked'
const SAVED_AT_KEY = 'qb_server_saved_at'

export function useAutosave(uploadServer = '') {
  // { variantId: { status: 'idle'|'saving'|'saved'|'error', message: string } }
  const statuses = reactive({})

  // In-memory sets/maps, mirrored to localStorage
  const linked  = new Set()
  const savedAt = {}

  // ── Persistence ─────────────────────────────────────────────────────────────

  function _persistLinked() {
    try { localStorage.setItem(LINKED_KEY, JSON.stringify([...linked])) } catch (_) {}
  }

  function _persistSavedAt() {
    try { localStorage.setItem(SAVED_AT_KEY, JSON.stringify(savedAt)) } catch (_) {}
  }

  function loadFromStorage() {
    try {
      const rawLinked = localStorage.getItem(LINKED_KEY)
      if (rawLinked) JSON.parse(rawLinked).forEach(id => linked.add(id))
      const rawSaved = localStorage.getItem(SAVED_AT_KEY)
      if (rawSaved) Object.assign(savedAt, JSON.parse(rawSaved))
    } catch (_) {}
  }

  loadFromStorage()

  // ── Linked set ───────────────────────────────────────────────────────────────

  function markLinked(variantId) {
    linked.add(variantId)
    _persistLinked()
  }

  function isLinked(variantId) {
    return linked.has(variantId)
  }

  function purgeLinked(variantId) {
    linked.delete(variantId)
    delete savedAt[variantId]
    delete statuses[variantId]
    _persistLinked()
    _persistSavedAt()
  }

  function renameLinked(oldId, newId) {
    if (!linked.has(oldId)) return
    linked.delete(oldId)
    linked.add(newId)
    if (savedAt[oldId] !== undefined) {
      savedAt[newId] = savedAt[oldId]
      delete savedAt[oldId]
    }
    if (statuses[oldId] !== undefined) {
      statuses[newId] = statuses[oldId]
      delete statuses[oldId]
    }
    _persistLinked()
    _persistSavedAt()
  }

  // ── Status ───────────────────────────────────────────────────────────────────

  function getStatus(variantId) {
    return statuses[variantId] ?? { status: 'idle', message: '' }
  }

  function setStatus(variantId, status, message = '') {
    statuses[variantId] = { status, message }
  }

  // ── Save timestamps ──────────────────────────────────────────────────────────

  function recordSave(variantId, timestamp) {
    savedAt[variantId] = timestamp
    _persistSavedAt()
  }

  function getSavedAt(variantId) {
    return savedAt[variantId] ?? null
  }

  // ── Server operations ────────────────────────────────────────────────────────

  async function saveToServer(variantId, exportData) {
    setStatus(variantId, 'saving')
    try {
      const res = await fetch(
        `${uploadServer}/php/upload.php?filename=${encodeURIComponent(variantId)}.json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: exportData,
        }
      )
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Speichern fehlgeschlagen')
      const timestamp = JSON.parse(exportData).exportedAt
      markLinked(variantId)
      recordSave(variantId, timestamp)
      setStatus(variantId, 'saved', timestamp)
    } catch (err) {
      setStatus(variantId, 'error', err.message)
      throw err
    }
  }

  async function deleteFromServer(variantId) {
    if (variantId === 'original_pgraph') return false
    try {
      const res = await fetch(
        `${uploadServer}/php/delete_variant.php?name=${encodeURIComponent(variantId)}`,
        { method: 'POST' }
      )
      if (!res.ok) return false
      const data = await res.json()
      return !data.error
    } catch (_) {
      return false
    }
  }

  async function fetchServerVariants() {
    try {
      const res = await fetch(`${uploadServer}/php/get_variants.php`)
      if (!res.ok) return []
      const data = await res.json()
      return data.variants ?? []
    } catch (_) {
      return []
    }
  }

  async function checkServerVersion(variantId) {
    const localTimestamp = getSavedAt(variantId)
    if (!localTimestamp) return { newer: false, serverTimestamp: null }

    try {
      const res = await fetch(`${uploadServer}/php/get_variant.php?name=${encodeURIComponent(variantId)}`)
      if (!res.ok) return { newer: false, serverTimestamp: null }
      const data = await res.json()
      const serverTimestamp = data.exportedAt ?? null
      if (!serverTimestamp) return { newer: false, serverTimestamp: null }
      const newer = serverTimestamp > localTimestamp
      return { newer, serverTimestamp }
    } catch (_) {
      return { newer: false, serverTimestamp: null }
    }
  }

  return {
    statuses,
    markLinked,
    isLinked,
    purgeLinked,
    renameLinked,
    getStatus,
    setStatus,
    recordSave,
    getSavedAt,
    deleteFromServer,
    fetchServerVariants,
    saveToServer,
    checkServerVersion,
    loadFromStorage,
  }
}
