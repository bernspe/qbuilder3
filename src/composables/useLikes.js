import { ref } from 'vue'

function loadLikes(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') } catch { return {} }
}

function saveLikes(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

export function useLikes(storageKey = 'qb_analysis_likes') {
  const likes = ref(loadLikes(storageKey))

  function toggleLike(nodeId, variantId) {
    if (!nodeId || !variantId) return
    const updated = { ...likes.value }
    if (updated[nodeId] === variantId) {
      delete updated[nodeId]
    } else {
      updated[nodeId] = variantId
    }
    likes.value = updated
    saveLikes(storageKey, updated)
  }

  function isLiked(nodeId, variantId) {
    return likes.value[nodeId] === variantId
  }

  function forExport() {
    return { ...likes.value }
  }

  function clear() {
    likes.value = {}
    saveLikes(storageKey, {})
  }

  return { likes, toggleLike, isLiked, forExport, clear }
}
