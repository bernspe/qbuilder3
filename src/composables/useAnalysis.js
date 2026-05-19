import { computed } from 'vue'

const COMPARED_FIELDS = ['label', 'question', 'subheading', 'helpText', 'reference', 'icon', 'icfCode', 'questionType', 'required', 'defaultIdx', 'answerOrder', 'options']

function nodesDiffer(a, b) {
  for (const f of COMPARED_FIELDS) {
    if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) return true
  }
  return false
}

// Flatten entire tree into a flat map for O(1) lookups
function buildNodeMap(nodes) {
  const map = new Map()
  function walk(list) {
    for (const n of list) {
      map.set(n.id, n)
      if (n.children) walk(n.children)
      if (n.branches) n.branches.forEach(b => b.children && walk(b.children))
    }
  }
  walk(nodes)
  return map
}

// Collect all subquestions / ICF items directly under a question node
// (including items inside branches of the question)
function collectItems(question) {
  const items = []
  for (const child of question.children ?? []) {
    if (child.type === 'subquestion' || child.type === 'icf') {
      items.push(child)
    } else if (child.type === 'branch') {
      for (const branch of child.branches ?? []) {
        for (const bc of branch.children ?? []) {
          if (bc.type === 'subquestion' || bc.type === 'icf') items.push(bc)
        }
      }
    }
  }
  return items
}

function computeNodeChange(nodeId, selectedIds, variantMaps) {
  const changed = selectedIds.filter(vid => {
    const varNode = variantMaps[vid]?.get(nodeId)
    return !varNode // node removed in variant → counts as change
  })
  return changed
}

function diffNode(baseNode, variantMaps, selectedIds) {
  const changed = selectedIds.filter(vid => {
    const varNode = variantMaps[vid]?.get(baseNode.id)
    return !varNode || nodesDiffer(baseNode, varNode)
  })
  return { changeCount: changed.length, variantsChanged: changed }
}

export function useAnalysis(variants, baselineId) {
  const variantIds = computed(() =>
    Object.keys(variants).filter(id => id !== baselineId.value)
  )

  // Returns 3-level structure: sections → questions → items
  function computeHeatmap(selectedIds) {
    const baseline = variants[baselineId.value]
    if (!baseline) return []

    // Pre-build node maps for all selected variants
    const variantMaps = {}
    for (const vid of selectedIds) {
      variantMaps[vid] = buildNodeMap(variants[vid]?.nodes ?? [])
    }

    const sections = baseline.nodes.filter(n => n.type === 'section')

    return sections.map(section => {
      // Screening questions = direct children of section with type 'question'
      const questions = (section.children ?? []).filter(n => n.type === 'question')

      const questionNodes = questions.map(question => {
        const { changeCount: qChange, variantsChanged: qVariants } = diffNode(question, variantMaps, selectedIds)

        // Items: subquestions and ICF items under this question
        const items = collectItems(question)
        const itemNodes = items.map(item => {
          const { changeCount, variantsChanged } = diffNode(item, variantMaps, selectedIds)
          return {
            id: item.id,
            label: item.label,
            type: item.type,
            changeCount,
            totalVariants: selectedIds.length,
            variantsChanged,
          }
        })

        const totalChange = qChange + itemNodes.reduce((s, i) => s + i.changeCount, 0)

        return {
          id: question.id,
          label: question.label,
          type: 'question',
          changeCount: totalChange,
          selfChangeCount: qChange,
          totalVariants: selectedIds.length,
          variantsChanged: qVariants,
          children: itemNodes,
        }
      })

      const sectionChange = questionNodes.reduce((s, q) => s + q.changeCount, 0)
      const maxPossible = questionNodes.reduce((s, q) => s + 1 + q.children.length, 0) * selectedIds.length

      return {
        id: section.id,
        label: section.label,
        changeCount: sectionChange,
        maxPossible,
        children: questionNodes,
      }
    })
  }

  return { variantIds, computeHeatmap }
}
