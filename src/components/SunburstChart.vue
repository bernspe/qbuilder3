<script setup>
import { use } from 'echarts/core'
import { SunburstChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { computed } from 'vue'

use([SunburstChart, TooltipComponent, CanvasRenderer])

const props = defineProps({
  // sections[].children = questions[].children = items[]
  sections: { type: Array, default: () => [] },
  selectedSectionId: { type: String, default: null },
  selectedQuestionId: { type: String, default: null },
  selectedNodeId: { type: String, default: null },
  // When set, chart zooms into this section only (questions → inner, items → outer)
  zoomedSectionId: { type: String, default: null },
})

const emit = defineEmits(['select-section', 'select-question', 'select-node'])

function heatColor(ratio) {
  if (ratio === 0) return '#e2e8f0'
  const stops = [
    [0.001, '#bfdbfe'],
    [0.25,  '#6ee7b7'],
    [0.5,   '#fde68a'],
    [0.75,  '#fb923c'],
    [1.0,   '#ef4444'],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (ratio <= t1) {
      return lerpColor(c0, c1, (ratio - t0) / (t1 - t0))
    }
  }
  return stops[stops.length - 1][1]
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerpColor(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`
}

function itemBorder(id, selectedId, width = 2) {
  return {
    borderColor: selectedId === id ? '#1d4ed8' : '#fff',
    borderWidth: selectedId === id ? 3 : width,
  }
}

function buildQuestionNode(question, sectionId) {
  const qRatio = question.changeCount > 0 && question.totalVariants > 0
    ? Math.min(1, question.changeCount / ((1 + question.children.length) * question.totalVariants))
    : 0
  const itemCount = Math.max(1, question.children.length)
  const itemValue = 1 / itemCount

  return {
    name: question.label,
    id: question.id,
    _level: 'question',
    _sectionId: sectionId,
    _changeCount: question.changeCount,
    _total: question.totalVariants,
    itemStyle: {
      color: heatColor(qRatio),
      ...itemBorder(question.id, props.selectedQuestionId, 1),
    },
    label: { show: true, fontSize: 10, overflow: 'truncate' },
    children: question.children.length
      ? question.children.map(item => {
          const itemRatio = item.totalVariants > 0
            ? item.changeCount / item.totalVariants
            : 0
          return {
            name: item.label,
            id: item.id,
            _level: 'item',
            _sectionId: sectionId,
            _questionId: question.id,
            _changeCount: item.changeCount,
            _total: item.totalVariants,
            _type: item.type,
            value: itemValue,
            itemStyle: {
              color: heatColor(itemRatio),
              ...itemBorder(item.id, props.selectedNodeId, 1),
            },
            label: { show: false },
          }
        })
      : [{ name: '', value: 1, itemStyle: { color: heatColor(qRatio) }, label: { show: false } }],
  }
}

const option = computed(() => {
  const zoomed = props.zoomedSectionId
    ? props.sections.find(s => s.id === props.zoomedSectionId)
    : null

  // ── Zoomed view: questions as inner ring, items as outer ring ──
  if (zoomed) {
    const data = zoomed.children.map(q => buildQuestionNode(q, zoomed.id))

    return {
      tooltip: {
        trigger: 'item',
        formatter: p => {
          const d = p.data
          if (d._level === 'item') {
            return `<b>${d.name}</b><br/>${d._type}<br/>Geändert in ${d._changeCount} von ${d._total} Variante(n)`
          }
          if (d._level === 'question') {
            return `<b>${d.name}</b><br/>Screeningfrage<br/>Änderungen gesamt: ${d._changeCount}`
          }
          return d.name ?? ''
        },
      },
      series: [{
        type: 'sunburst',
        data,
        radius: ['10%', '95%'],
        sort: undefined,
        nodeClick: false,
        emphasis: { focus: 'ancestor' },
        levels: [
          {},
          // Questions – inner ring
          {
            r0: '10%', r: '55%',
            itemStyle: { borderWidth: 2 },
            label: { rotate: 'tangential', fontSize: 11, fontWeight: 600, overflow: 'truncate', width: 80 },
          },
          // Items – outer ring
          {
            r0: '55%', r: '95%',
            itemStyle: { borderWidth: 1 },
            label: { show: false },
          },
        ],
      }],
    }
  }

  // ── Full view: sections → questions → items ──
  const data = props.sections.map(section => {
    const secRatio = section.maxPossible > 0
      ? section.changeCount / section.maxPossible
      : 0

    return {
      name: section.label,
      id: section.id,
      _level: 'section',
      itemStyle: {
        color: heatColor(secRatio),
        ...itemBorder(section.id, props.selectedSectionId, 1),
      },
      label: { show: true, fontSize: 11, fontWeight: 600 },
      children: section.children.map(q => buildQuestionNode(q, section.id)),
    }
  })

  return {
    tooltip: {
      trigger: 'item',
      formatter: p => {
        const d = p.data
        if (d._level === 'item') {
          return `<b>${d.name}</b><br/>${d._type}<br/>Geändert in ${d._changeCount} von ${d._total} Variante(n)`
        }
        if (d._level === 'question') {
          return `<b>${d.name}</b><br/>Screeningfrage<br/>Änderungen gesamt: ${d._changeCount}`
        }
        const sec = props.sections.find(s => s.id === d.id)
        if (sec) return `<b>${d.name}</b><br/>Abschnitt<br/>Änderungen gesamt: ${sec.changeCount}`
        return d.name
      },
    },
    series: [{
      type: 'sunburst',
      data,
      radius: ['10%', '95%'],
      sort: undefined,
      nodeClick: false,
      emphasis: { focus: 'ancestor' },
      levels: [
        {},
        // Level 1 – Sections (inner)
        {
          r0: '10%', r: '38%',
          itemStyle: { borderWidth: 2 },
          label: { rotate: 'tangential', fontSize: 11, fontWeight: 600 },
        },
        // Level 2 – Screening questions (middle)
        {
          r0: '38%', r: '65%',
          itemStyle: { borderWidth: 1 },
          label: { rotate: 'tangential', fontSize: 10, overflow: 'truncate', width: 60 },
        },
        // Level 3 – Items (outer)
        {
          r0: '65%', r: '95%',
          itemStyle: { borderWidth: 1 },
          label: { show: false },
        },
      ],
    }],
  }
})

function handleClick(params) {
  const d = params.data
  if (!d) return
  if (d._level === 'item') {
    emit('select-node', { nodeId: d.id, questionId: d._questionId, sectionId: d._sectionId })
  } else if (d._level === 'question') {
    emit('select-question', { questionId: d.id, sectionId: d._sectionId })
  } else if (d._level === 'section' && d.id) {
    emit('select-section', d.id)
  }
}
</script>

<template>
  <VChart
    :option="option"
    autoresize
    style="width:100%;height:100%"
    @click="handleClick"
  />
</template>
