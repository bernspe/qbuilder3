/**
 * Aggregates variant preferences from multiple experts.
 *
 * @param {Array<{ expertId: string, likes: Record<string, string> }>} expertLikesArray
 * @param {{ consensusThreshold?: number }} options
 * @returns {Record<string, { [variantId: string]: number, total: number, majority: string|null, consensusRatio: number, isControversial: boolean }>}
 */
export function aggregateLikes(expertLikesArray, { consensusThreshold = 2 / 3 } = {}) {
  const nodeMap = {}

  for (const { likes } of expertLikesArray) {
    for (const [nodeId, variantId] of Object.entries(likes ?? {})) {
      if (!nodeMap[nodeId]) nodeMap[nodeId] = {}
      nodeMap[nodeId][variantId] = (nodeMap[nodeId][variantId] ?? 0) + 1
    }
  }

  const result = {}
  for (const [nodeId, voteCounts] of Object.entries(nodeMap)) {
    const total = Object.values(voteCounts).reduce((a, b) => a + b, 0)
    const [topVariant, topCount] = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]
    const consensusRatio = topCount / total
    const majority = consensusRatio >= consensusThreshold ? topVariant : null
    result[nodeId] = {
      ...voteCounts,
      total,
      majority,
      consensusRatio,
      isControversial: !majority && total > 1,
    }
  }
  return result
}

// ── Node helpers ─────────────────────────────────────────────────────────────

function findNodeInList(list, id) {
  for (const n of list) {
    if (n.id === id) return n
    if (n.children) {
      const f = findNodeInList(n.children, id)
      if (f) return f
    }
    if (n.branches) {
      for (const b of n.branches) {
        if (b.children) {
          const f = findNodeInList(b.children, id)
          if (f) return f
        }
      }
    }
  }
  return null
}

function replaceNodeInTree(list, id, replacement) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i] = { ...replacement }
      return true
    }
    if (list[i].children && replaceNodeInTree(list[i].children, id, replacement)) return true
    if (list[i].branches) {
      for (const b of list[i].branches) {
        if (b.children && replaceNodeInTree(b.children, id, replacement)) return true
      }
    }
  }
  return false
}

function deepCloneNodes(nodes) {
  return JSON.parse(JSON.stringify(nodes))
}

/**
 * Builds a new node tree from the baseline, replacing nodes that have a clear
 * majority preference with the version from the preferred variant.
 *
 * @param {Array} baselineNodes
 * @param {ReturnType<typeof aggregateLikes>} aggregation
 * @param {Record<string, { nodes: Array }>} variantsMap
 * @returns {Array}
 */
export function createConsensusNodes(baselineNodes, aggregation, variantsMap) {
  const result = deepCloneNodes(baselineNodes)

  for (const [nodeId, info] of Object.entries(aggregation)) {
    if (!info.majority) continue
    const sourceNodes = variantsMap[info.majority]?.nodes
    if (!sourceNodes) continue
    const sourceNode = findNodeInList(sourceNodes, nodeId)
    if (!sourceNode) continue
    replaceNodeInTree(result, nodeId, sourceNode)
  }

  return result
}
