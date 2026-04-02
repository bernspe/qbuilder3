import { ref } from 'vue'

export function useToast() {
  const toasts = ref([])

  function show(msg) {
    const id = Date.now()
    toasts.value.push({ id, msg })
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 2200)
  }

  return { toasts, show }
}
