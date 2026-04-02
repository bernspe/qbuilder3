<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'import'])

const raw = ref('')
const asVariant = ref('')
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>JSON importieren</h3>
      <p>Export-JSON einfügen. Ohne Variantenname werden alle bestehenden Daten ersetzt.</p>
      <div class="field">
        <label>JSON-Inhalt</label>
        <textarea v-model="raw" placeholder='{"exportedAt":"...","variants":{"main":{...}}}'></textarea>
      </div>
      <div class="field">
        <label>Als neue Variante (Name, optional)</label>
        <input type="text" v-model="asVariant" placeholder="z.B. kollegin_version" />
      </div>
      <div class="modal-actions">
        <button class="btn" @click="emit('close')">Abbrechen</button>
        <button class="btn btn-primary" @click="emit('import', { raw, asVariant })">Importieren</button>
      </div>
    </div>
  </div>
</template>
