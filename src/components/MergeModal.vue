<script setup>
import { ref } from 'vue'

const props = defineProps({ variants: Object })
const emit = defineEmits(['close', 'merge'])

const keys = Object.keys(props.variants)
const fromId = ref(keys[0] ?? '')
const toId = ref(keys[1] ?? keys[0] ?? '')
const newName = ref('')
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>Varianten zusammenführen</h3>
      <p>Nodes aus einer Variante werden ans Ende einer anderen angefügt.</p>
      <div class="row">
        <div class="field col">
          <label>Quelle (von)</label>
          <select v-model="fromId">
            <option v-for="v in variants" :key="v.id" :value="v.id">{{ v.label }}</option>
          </select>
        </div>
        <div class="field col">
          <label>Ziel (nach)</label>
          <select v-model="toId">
            <option v-for="v in variants" :key="v.id" :value="v.id">{{ v.label }}</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Ergebnis als neue Variante (leer = Ziel überschreiben)</label>
        <input type="text" v-model="newName" placeholder="z.B. merged_v2" />
      </div>
      <div class="modal-actions">
        <button class="btn" @click="emit('close')">Abbrechen</button>
        <button class="btn btn-primary" @click="emit('merge', { fromId, toId, newName })">Zusammenführen</button>
      </div>
    </div>
  </div>
</template>
