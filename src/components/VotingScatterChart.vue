<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
})
const emit = defineEmits(['select'])

const W = 320, H = 210
const PAD = { top: 18, right: 16, bottom: 28, left: 36 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

function sx(v) { return PAD.left + ((v - 1) / 4) * plotW }
function sy(v) { return PAD.top + ((5 - v) / 4) * plotH }

const TYPE_COLORS = { question: '#2563eb', subquestion: '#16a34a', icf: '#ea580c' }
const TYPE_LABELS = { question: 'Screeningfrage', subquestion: 'Unterfrage', icf: 'ICF-Item' }

const containerRef = ref(null)
const svgRef = ref(null)
const tooltip = ref(null)

const plottable = computed(() =>
  props.nodes.filter(n => n.avgImportance !== null && n.avgUnderstandability !== null)
)

function nodeR(n) { return Math.max(4, Math.min(10, 4 + n.nRatings * 0.5)) }

function onMove(e, node) {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  tooltip.value = { left: x + 10, top: y - 40, flipX: x > rect.width * 0.55, node }
}
function onLeave() { tooltip.value = null }

const midX = computed(() => sx(3))
const midY = computed(() => sy(3))
</script>

<template>
  <div ref="containerRef" style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;gap:4px">
    <div style="flex:1;min-height:0">
      <svg ref="svgRef" :viewBox="`0 0 ${W} ${H}`" style="width:100%;height:100%" xmlns="http://www.w3.org/2000/svg">
        <!-- Quadrant backgrounds:
             X = Wichtigkeit (links=1, rechts=5), Y = Verständlichkeit (oben=5, unten=1)
             Oben-links:  niedrig W, hoch V  → Nice-to-have  (#eff6ff)
             Oben-rechts: hoch W,   hoch V   → Kernthema     (#dcfce7)
             Unten-links: niedrig W, niedrig V → Überdenken  (#fee2e2)
             Unten-rechts:hoch W,   niedrig V → Optimierungsbedarf (#fef3c7) -->
        <rect :x="PAD.left" :y="PAD.top" :width="midX-PAD.left" :height="midY-PAD.top" fill="#eff6ff" opacity="0.4"/>
        <rect :x="midX" :y="PAD.top" :width="PAD.left+plotW-midX" :height="midY-PAD.top" fill="#dcfce7" opacity="0.4"/>
        <rect :x="PAD.left" :y="midY" :width="midX-PAD.left" :height="PAD.top+plotH-midY" fill="#fee2e2" opacity="0.4"/>
        <rect :x="midX" :y="midY" :width="PAD.left+plotW-midX" :height="PAD.top+plotH-midY" fill="#fef3c7" opacity="0.4"/>
        <!-- Border -->
        <rect :x="PAD.left" :y="PAD.top" :width="plotW" :height="plotH" fill="none" stroke="#e2e8f0" stroke-width="1"/>
        <!-- Quadrant dividers -->
        <line :x1="midX" :y1="PAD.top" :x2="midX" :y2="PAD.top+plotH" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"/>
        <line :x1="PAD.left" :y1="midY" :x2="PAD.left+plotW" :y2="midY" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3"/>
        <!-- Quadrant labels -->
        <text :x="PAD.left+4" :y="PAD.top+10" font-size="7.5" fill="#1d4ed8" font-weight="600" opacity="0.85">Nice-to-have</text>
        <text :x="midX+4" :y="PAD.top+10" font-size="7.5" fill="#15803d" font-weight="600" opacity="0.85">Kernthema</text>
        <text :x="PAD.left+4" :y="midY+10" font-size="7.5" fill="#b91c1c" font-weight="600" opacity="0.85">Überdenken</text>
        <text :x="midX+4" :y="midY+10" font-size="7.5" fill="#92400e" font-weight="600" opacity="0.85">Optimierungsbedarf</text>
        <!-- X ticks -->
        <template v-for="v in [1,2,3,4,5]" :key="'xt'+v">
          <line :x1="sx(v)" :y1="PAD.top+plotH" :x2="sx(v)" :y2="PAD.top+plotH+3" stroke="#cbd5e1" stroke-width="1"/>
          <text :x="sx(v)" :y="PAD.top+plotH+11" font-size="7.5" fill="#94a3b8" text-anchor="middle">{{v}}</text>
        </template>
        <!-- Y ticks -->
        <template v-for="v in [1,2,3,4,5]" :key="'yt'+v">
          <line :x1="PAD.left-3" :y1="sy(v)" :x2="PAD.left" :y2="sy(v)" stroke="#cbd5e1" stroke-width="1"/>
          <text :x="PAD.left-5" :y="sy(v)+3" font-size="7.5" fill="#94a3b8" text-anchor="end">{{v}}</text>
        </template>
        <!-- Axis labels -->
        <text :x="PAD.left+plotW/2" :y="H-1" font-size="8" fill="#64748b" text-anchor="middle">Wichtigkeit →</text>
        <text x="8" :y="PAD.top+plotH/2" font-size="8" fill="#64748b" text-anchor="middle" :transform="`rotate(-90,8,${PAD.top+plotH/2})`">Verständlichkeit →</text>
        <!-- Points -->
        <g
          v-for="node in plottable" :key="node.id"
          style="cursor:pointer"
          @mousemove="onMove($event, node)"
          @mouseleave="onLeave"
          @click="emit('select', selectedId === node.id ? null : node.id)"
        >
          <circle
            :cx="sx(node.avgImportance)"
            :cy="sy(node.avgUnderstandability)"
            :r="nodeR(node) + (selectedId === node.id ? 2 : 0)"
            :fill="TYPE_COLORS[node.type] ?? '#64748b'"
            :stroke="selectedId === node.id ? '#1e293b' : '#fff'"
            :stroke-width="selectedId === node.id ? 2.5 : 1.5"
            :opacity="selectedId && selectedId !== node.id ? 0.35 : 0.85"
          />
        </g>
        <!-- Empty state -->
        <text
          v-if="!plottable.length"
          :x="W/2" :y="H/2"
          font-size="11" fill="#94a3b8" text-anchor="middle"
        >Keine Bewertungen vorhanden</text>
      </svg>
    </div>

    <!-- Legend row -->
    <div style="display:flex;gap:12px;justify-content:center;flex-shrink:0;padding-bottom:2px">
      <span
        v-for="(color, type) in TYPE_COLORS" :key="type"
        style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text3,#64748b)"
      >
        <span :style="`width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0`"></span>
        {{ TYPE_LABELS[type] }}
      </span>
    </div>

    <!-- HTML Tooltip -->
    <div
      v-if="tooltip"
      class="voting-scatter-tooltip"
      :style="{
        left: (tooltip.flipX ? tooltip.left - 160 : tooltip.left) + 'px',
        top: tooltip.top + 'px',
      }"
    >
      <div class="voting-scatter-tooltip-title">{{ tooltip.node.label }}</div>
      <div class="voting-scatter-tooltip-sub">
        W: {{ tooltip.node.avgImportance.toFixed(1) }}
        &nbsp;·&nbsp;
        V: {{ tooltip.node.avgUnderstandability.toFixed(1) }}
        &nbsp;·&nbsp;
        n={{ tooltip.node.nRatings }}
      </div>
      <div v-if="tooltip.node.sectionLabel" class="voting-scatter-tooltip-sec">
        {{ tooltip.node.sectionLabel }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.voting-scatter-tooltip {
  position: absolute;
  pointer-events: none;
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  max-width: 200px;
  white-space: normal;
}
.voting-scatter-tooltip-title {
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 2px;
}
.voting-scatter-tooltip-sub {
  color: #94a3b8;
  font-size: 10px;
}
.voting-scatter-tooltip-sec {
  color: #64748b;
  font-size: 9.5px;
  margin-top: 2px;
}
</style>
