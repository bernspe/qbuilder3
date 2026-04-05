import { reactive } from 'vue'

const STORAGE_KEY = 'qb_vue3_ratings'
const SCORABLE_TYPES = ['question', 'subquestion', 'icf']
const SCORED_FIELDS = ['icon', 'question', 'reference', 'subheading', 'helpText', 'options', 'defaultIdx', 'answerOrder']

export const GAMIFICATION_CONFIG = {
  newItemPoints: 10,
  removeItemPoints: 5,
  maxRemovalItems: 5,
  fillEmptyFieldPoints: 2,
  changeFieldPoints: 1,
  importanceRatingPoints: 2,
  understandabilityRatingPoints: 2,
}

export function useGamification(config = GAMIFICATION_CONFIG) {
  // ratings[variantId][nodeId] = { importance: null|1-5, understandability: null|1-5 }
  const ratings = reactive({})

  function setRating(variantId, nodeId, type, value) {
    if (!ratings[variantId]) ratings[variantId] = {}
    if (!ratings[variantId][nodeId]) ratings[variantId][nodeId] = { importance: null, understandability: null }
    ratings[variantId][nodeId][type] = value
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)) } catch (_) {}
  }

  function getRating(variantId, nodeId) {
    return ratings[variantId]?.[nodeId] ?? { importance: null, understandability: null }
  }

  function isRated(variantId, nodeId) {
    const r = getRating(variantId, nodeId)
    return r.importance !== null && r.understandability !== null
  }

  function _flattenScorable(nodes) {
    const result = []
    const walk = (list) => {
      for (const n of list) {
        if (SCORABLE_TYPES.includes(n.type)) result.push(n)
        if (n.children) walk(n.children)
        if (n.branches) n.branches.forEach(b => b.children && walk(b.children))
      }
    }
    walk(nodes)
    return result
  }

  function _fieldValue(node, field) {
    const v = node[field]
    if (v === null || v === undefined || v === '') return ''
    if (Array.isArray(v)) return v.join('\n')
    return String(v)
  }

  function calculatePoints(variants, variantId) {
    const baselineId = Object.keys(variants)[0]
    if (variantId === baselineId) return 0
    const mainItems = _flattenScorable(variants[baselineId]?.nodes ?? [])
    const variantItems = _flattenScorable(variants[variantId]?.nodes ?? [])
    const mainById = Object.fromEntries(mainItems.map(n => [n.id, n]))
    const variantById = Object.fromEntries(variantItems.map(n => [n.id, n]))
    let pts = 0

    // Neue Items
    for (const n of variantItems) {
      if (!mainById[n.id]) pts += config.newItemPoints
    }

    // Entfernte Items, gedeckelt
    let removed = 0
    for (const n of mainItems) {
      if (!variantById[n.id] && removed < config.maxRemovalItems) {
        pts += config.removeItemPoints
        removed++
      }
    }

    // Feldänderungen für Items, die in beiden Varianten vorhanden sind
    for (const n of variantItems) {
      const orig = mainById[n.id]
      if (!orig) continue
      for (const field of SCORED_FIELDS) {
        const ov = _fieldValue(orig, field)
        const nv = _fieldValue(n, field)
        if (ov === nv) continue
        if (ov === '' && nv !== '') pts += config.fillEmptyFieldPoints
        else if (ov !== '' && nv !== '') pts += config.changeFieldPoints
      }
    }

    // Rating-Punkte
    const vr = ratings[variantId] ?? {}
    for (const r of Object.values(vr)) {
      if (r.importance !== null) pts += config.importanceRatingPoints
      if (r.understandability !== null) pts += config.understandabilityRatingPoints
    }

    return pts
  }

  function loadRatingsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        Object.keys(ratings).forEach(k => delete ratings[k])
        Object.assign(ratings, parsed)
      }
    } catch (_) {}
  }

  function purgeVariantRatings(variantId) {
    delete ratings[variantId]
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)) } catch (_) {}
  }

  function renameVariantRatings(oldId, newId) {
    if (!ratings[oldId]) return
    ratings[newId] = ratings[oldId]
    delete ratings[oldId]
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)) } catch (_) {}
  }

  function restoreVariantRatings(variantId, ratingsObj) {
    ratings[variantId] = JSON.parse(JSON.stringify(ratingsObj))
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)) } catch (_) {}
  }

  return {
    ratings,
    setRating,
    getRating,
    isRated,
    calculatePoints,
    loadRatingsFromStorage,
    purgeVariantRatings,
    renameVariantRatings,
    restoreVariantRatings,
  }
}
