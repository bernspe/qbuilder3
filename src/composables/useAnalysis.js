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

function diffNode(baseNode, variantMaps, selectedIds) {
  const changed = selectedIds.filter(vid => {
    const varNode = variantMaps[vid]?.get(baseNode.id)
    return !varNode || nodesDiffer(baseNode, varNode)
  })
  return { changeCount: changed.length, variantsChanged: changed }
}

// Collect nodes that appear in at least one variant but are absent from the baseline.
// getChildrenFn(vid) → array of candidate nodes for variant vid.
function collectAdded(getChildrenFn, selectedIds, baselineMap) {
  const addedById = new Map()
  for (const vid of selectedIds) {
    for (const child of getChildrenFn(vid)) {
      if (baselineMap.has(child.id)) continue
      if (!addedById.has(child.id)) addedById.set(child.id, { node: child, addedIn: [] })
      addedById.get(child.id).addedIn.push(vid)
    }
  }
  return [...addedById.values()]
}

export function useAnalysis(variantsRef, baselineId) {
  const variantIds = computed(() =>
    Object.keys(variantsRef.value).filter(id => id !== baselineId.value)
  )

  // Returns 3-level structure: sections → questions → items
  function computeHeatmap(selectedIds) {
    const variants = variantsRef.value
    const baseline = variants[baselineId.value]
    if (!baseline) return []

    // Pre-build node maps for all selected variants
    const variantMaps = {}
    for (const vid of selectedIds) {
      variantMaps[vid] = buildNodeMap(variants[vid]?.nodes ?? [])
    }
    const baselineMap = buildNodeMap(baseline.nodes ?? [])

    // Build a heatmap entry for a node that exists only in variants (not in baseline)
    function makeAddedEntry(node, addedIn, childNodes = []) {
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        isAdded: true,
        addedIn,
        changeCount: addedIn.length + childNodes.reduce((s, c) => s + c.changeCount, 0),
        selfChangeCount: addedIn.length,
        totalVariants: selectedIds.length,
        variantsChanged: addedIn,
        children: childNodes,
      }
    }

    const sections = baseline.nodes.filter(n => n.type === 'section')

    const sectionNodes = sections.map(section => {
      // Screening questions = direct children of section with type 'question'
      const questions = (section.children ?? []).filter(n => n.type === 'question')

      const questionNodes = questions.map(question => {
        const { changeCount: qChange, variantsChanged: qVariants } = diffNode(question, variantMaps, selectedIds)

        // Items: subquestions and ICF items under this question (in baseline)
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

        // Items added in variants but absent from baseline
        const addedItemNodes = collectAdded(
          vid => collectItems(variantMaps[vid]?.get(question.id) ?? { children: [] }),
          selectedIds, baselineMap
        ).map(({ node, addedIn }) => makeAddedEntry(node, addedIn))

        const allItems = [...itemNodes, ...addedItemNodes]
        const totalChange = qChange + allItems.reduce((s, i) => s + i.changeCount, 0)

        return {
          id: question.id,
          label: question.label,
          type: 'question',
          changeCount: totalChange,
          selfChangeCount: qChange,
          totalVariants: selectedIds.length,
          variantsChanged: qVariants,
          children: allItems,
        }
      })

      // Questions added in variants but absent from baseline
      const addedQuestionNodes = collectAdded(
        vid => (variantMaps[vid]?.get(section.id)?.children ?? []).filter(n => n.type === 'question'),
        selectedIds, baselineMap
      ).map(({ node, addedIn }) => {
        const addedItemChildren = collectItems(node).map(item => makeAddedEntry(item, addedIn))
        return makeAddedEntry(node, addedIn, addedItemChildren)
      })

      const allQuestions = [...questionNodes, ...addedQuestionNodes]
      const sectionChange = allQuestions.reduce((s, q) => s + q.changeCount, 0)
      const maxPossible = allQuestions.reduce((s, q) => s + 1 + q.children.length, 0) * selectedIds.length

      return {
        id: section.id,
        label: section.label,
        changeCount: sectionChange,
        maxPossible,
        children: allQuestions,
      }
    })

    // Sections added in variants but absent from baseline
    const addedSectionNodes = collectAdded(
      vid => (variants[vid]?.nodes ?? []).filter(n => n.type === 'section'),
      selectedIds, baselineMap
    ).map(({ node, addedIn }) => {
      const questionChildren = (node.children ?? [])
        .filter(n => n.type === 'question')
        .map(q => {
          const itemChildren = collectItems(q).map(item => makeAddedEntry(item, addedIn))
          return makeAddedEntry(q, addedIn, itemChildren)
        })
      const entry = makeAddedEntry(node, addedIn, questionChildren)
      entry.maxPossible = (questionChildren.reduce((s, q) => s + 1 + q.children.length, 0) + 1) * selectedIds.length
      return entry
    })

    return [...sectionNodes, ...addedSectionNodes]
  }

  return { variantIds, computeHeatmap }
}
