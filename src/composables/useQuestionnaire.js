import { ref, computed, reactive, watch } from 'vue'

export function useQuestionnaire() {
  const variants = reactive({ main: { id: 'main', label: 'Original', nodes: [] } })
  const currentVariant = ref('main')
  let counter = 1

  const nodes = computed(() => variants[currentVariant.value]?.nodes ?? [])
  const variantList = computed(() => Object.values(variants))

  function uid() {
    return 'n' + (counter++) + '_' + Math.random().toString(36).slice(2, 6)
  }

  function findNode(list, id) {
    for (const n of list) {
      if (n.id === id) return n
      if (n.children) { const f = findNode(n.children, id); if (f) return f }
      if (n.branches) {
        for (const b of n.branches) {
          if (b.children) { const f = findNode(b.children, id); if (f) return f }
        }
      }
    }
    return null
  }

  function findInVariant(id, variant = currentVariant.value) {
    return findNode(variants[variant]?.nodes ?? [], id)
  }

  function removeFromList(list, id) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) { list.splice(i, 1); return true }
      if (list[i].children && removeFromList(list[i].children, id)) return true
      if (list[i].branches) {
        for (const b of list[i].branches) {
          if (b.children && removeFromList(b.children, id)) return true
        }
      }
    }
    return false
  }

  function makeNode(type, label) {
    const base = { id: uid(), type, label }
    if (type === 'section') return { ...base, children: [] }
    if (type === 'question') return { ...base, icon: '', subheading: 'Screeningfrage', question: '', reference: '', questionType: 'yesno', options: [], helpText: '', required: false, defaultIdx: null, answerOrder: 'schlecht-gut', children: [] }
    if (type === 'subquestion') return { ...base, icon: '', subheading: '', question: '', reference: '', questionType: 'single', options: [], helpText: '', required: false, defaultIdx: null, answerOrder: 'schlecht-gut' }
    if (type === 'icf') return { ...base, icon: '', icfCode: '', subheading: '', question: '', reference: '', questionType: 'single', options: [], helpText: '', required: false, defaultIdx: null }
    if (type === 'branch') return { ...base, condition: '', branches: [{ label: 'Pfad A', children: [] }, { label: 'Pfad B', children: [] }] }
  }

  function addNode(type, parentId = null) {
    const labels = { section: 'Neuer Abschnitt', question: 'Neue Screeningfrage', subquestion: 'Neue Unterfrage', icf: 'Neues ICF-Item', branch: 'Neue Verzweigung' }
    const node = makeNode(type, labels[type])
    const list = nodes.value
    if (parentId) {
      const parent = findNode(list, parentId)
      console.log('adding to parent', parent, ' with id ', parentId)
      if (parent) {
        if (parent?.children) {
          parent.children.push(node);
          return node
        } else {
          parent.children=[node]; return node
        }
      }
      if (parent?.branches && type !== 'section') {
        parent.branches[0].children.push(node); return node
      }
    }
    list.push(node)
    return node
  }

  function deleteNode(id) {
    removeFromList(nodes.value, id)
  }

  function addVariant(name, cloneFrom = currentVariant.value) {
    if (!name || variants[name]) return false
    variants[name] = {
      id: name, label: name,
      nodes: JSON.parse(JSON.stringify(variants[cloneFrom]?.nodes ?? []))
    }
    return true
  }

  function switchVariant(id) {
    if (variants[id]) currentVariant.value = id
  }

  function deleteVariant(id) {
    const keys = Object.keys(variants)
    if (keys.length <= 1) return false
    if (!variants[id]) return false
    if (currentVariant.value === id) {
      const other = keys.find(k => k !== id)
      currentVariant.value = other
    }
    delete variants[id]
    return true
  }

  function renameVariant(id, newLabel) {
    if (!variants[id]) return false
    const trimmed = newLabel?.trim()
    if (!trimmed) return false
    if (trimmed === id) return true
    if (variants[trimmed]) return false  // Name bereits vergeben
    variants[trimmed] = { ...variants[id], id: trimmed, label: trimmed }
    delete variants[id]
    if (currentVariant.value === id) currentVariant.value = trimmed
    return trimmed  // gibt neue id zurück
  }

  function mergeVariants(fromId, toId, newName) {
    const fromNodes = JSON.parse(JSON.stringify(variants[fromId]?.nodes ?? []))
    const toNodes = JSON.parse(JSON.stringify(variants[toId]?.nodes ?? []))
    const merged = [...toNodes, ...fromNodes]
    const target = newName || toId
    if (!variants[target]) {
      variants[target] = { id: target, label: target, nodes: merged }
    } else {
      variants[target].nodes = merged
    }
    return target
  }

  function exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), variants: JSON.parse(JSON.stringify(variants)) }, null, 2)
  }

  function importJSON(raw, asVariant = '') {
    const parsed = JSON.parse(raw)
    if (parsed.variants) {
      if (asVariant) {
        const firstKey = Object.keys(parsed.variants)[0]
        variants[asVariant] = { id: asVariant, label: asVariant, nodes: parsed.variants[firstKey].nodes }
      } else {
        Object.keys(variants).forEach(k => delete variants[k])
        Object.assign(variants, parsed.variants)
        currentVariant.value = Object.keys(variants)[0]
      }
    }
  }

  function countAll(list = nodes.value) {
    let s = 0, q = 0, sq = 0, icf = 0, b = 0
    for (const n of list) {
      if (n.type === 'section') s++
      else if (n.type === 'question') q++
      else if (n.type === 'subquestion') sq++
      else if (n.type === 'icf') icf++
      else if (n.type === 'branch') b++
      if (n.children) { const c = countAll(n.children); s += c.s; q += c.q; sq += c.sq; icf += c.icf; b += c.b }
      if (n.branches) { for (const br of n.branches) { if (br.children) { const c = countAll(br.children); s += c.s; q += c.q; sq += c.sq; icf += c.icf; b += c.b } } }
    }
    return { s, q, sq, icf, b }
  }

  function saveToStorage() {
    try { localStorage.setItem('qb_vue3_data', JSON.stringify(variants)) } catch (_) {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('qb_vue3_data')
      if (raw) {
        const parsed = JSON.parse(raw)
        Object.keys(variants).forEach(k => delete variants[k])
        Object.assign(variants, parsed)
        currentVariant.value = Object.keys(variants)[0] ?? 'main'
      }
    } catch (_) {}
  }

  watch(() => JSON.stringify(variants), saveToStorage, { deep: true })

  return {
    variants, currentVariant, nodes, variantList,
    findInVariant, addNode, deleteNode,
    addVariant, switchVariant, deleteVariant, renameVariant, mergeVariants,
    exportJSON, importJSON, countAll, loadFromStorage
  }
}
