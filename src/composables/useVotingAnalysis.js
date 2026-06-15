import { computed } from 'vue'

function flattenScorable(nodes) {
  const result = []
  const walk = (list) => {
    for (const n of list ?? []) {
      if (['question', 'subquestion', 'icf'].includes(n.type)) result.push(n)
      if (n.children) walk(n.children)
      if (n.branches) n.branches.forEach(b => b.children && walk(b.children))
    }
  }
  walk(nodes)
  return result
}

function nodeInSection(nodeId, section) {
  for (const q of section.children ?? []) {
    if (q.id === nodeId) return true
    for (const c of q.children ?? []) {
      if (c.id === nodeId) return true
      if (c.branches) {
        for (const b of c.branches) {
          for (const bc of b.children ?? []) {
            if (bc.id === nodeId) return true
          }
        }
      }
    }
  }
  return false
}

function findSection(nodeId, baselineNodes) {
  for (const sec of (baselineNodes ?? []).filter(n => n.type === 'section')) {
    if (nodeInSection(nodeId, sec)) return { id: sec.id, label: sec.label }
  }
  return null
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

function dist(arr) {
  return [1, 2, 3, 4, 5].map(v => arr.filter(x => x === v).length)
}

export function useVotingAnalysis(variantsRef, baselineIdRef) {
  // Per-node aggregated rating stats across all non-baseline variants
  const aggregated = computed(() => {
    const variants = variantsRef.value
    const baselineId = baselineIdRef.value
    const baseline = variants[baselineId]
    if (!baseline) return []

    const baselineNodes = flattenScorable(baseline.nodes)
    const ratingsByNode = new Map()

    for (const [varId, variant] of Object.entries(variants)) {
      if (varId === baselineId) continue
      for (const [nodeId, r] of Object.entries(variant.ratings ?? {})) {
        if (!ratingsByNode.has(nodeId)) {
          ratingsByNode.set(nodeId, { impValues: [], undValues: [] })
        }
        const entry = ratingsByNode.get(nodeId)
        if (r.importance != null) entry.impValues.push(Number(r.importance))
        if (r.understandability != null) entry.undValues.push(Number(r.understandability))
      }
    }

    return baselineNodes.map(node => {
      const { impValues = [], undValues = [] } = ratingsByNode.get(node.id) ?? {}
      const avgImp = avg(impValues)
      const avgUnd = avg(undValues)

      let quadrant = null
      if (avgImp !== null && avgUnd !== null) {
        quadrant = avgImp >= 3
          ? (avgUnd >= 3 ? 'core' : 'unclear')
          : (avgUnd >= 3 ? 'nice' : 'rethink')
      }

      const sec = findSection(node.id, baseline.nodes)
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        sectionId: sec?.id ?? null,
        sectionLabel: sec?.label ?? null,
        avgImportance: avgImp,
        avgUnderstandability: avgUnd,
        nRatings: Math.max(impValues.length, undValues.length),
        importanceDist: dist(impValues),
        understandDist: dist(undValues),
        quadrant,
      }
    })
  })

  // nodeId → stats lookup (includes section-level averages)
  const votingMap = computed(() => {
    const map = {}
    for (const n of aggregated.value) map[n.id] = n

    // Add section-level averages for Sunburst coloring
    const baseline = variantsRef.value[baselineIdRef.value]
    for (const sec of (baseline?.nodes ?? []).filter(n => n.type === 'section')) {
      const children = flattenScorable([sec])
      const childStats = children.map(c => map[c.id]).filter(Boolean)
      if (!childStats.length) continue
      const imps = childStats.filter(d => d.avgImportance !== null).map(d => d.avgImportance)
      const unds = childStats.filter(d => d.avgUnderstandability !== null).map(d => d.avgUnderstandability)
      map[sec.id] = { avgImportance: avg(imps), avgUnderstandability: avg(unds), nRatings: childStats.length }
    }
    return map
  })

  const ratedNodes = computed(() => aggregated.value.filter(n => n.nRatings > 0))

  const summary = computed(() => {
    const r = ratedNodes.value
    if (!r.length) return null
    const withImp = r.filter(n => n.avgImportance !== null)
    const withUnd = r.filter(n => n.avgUnderstandability !== null)
    return {
      totalRated: r.length,
      avgImportance: avg(withImp.map(n => n.avgImportance)),
      avgUnderstandability: avg(withUnd.map(n => n.avgUnderstandability)),
      byQuadrant: {
        core:    r.filter(n => n.quadrant === 'core').length,
        unclear: r.filter(n => n.quadrant === 'unclear').length,
        nice:    r.filter(n => n.quadrant === 'nice').length,
        rethink: r.filter(n => n.quadrant === 'rethink').length,
      },
    }
  })

  return { aggregated, ratedNodes, votingMap, summary }
}
