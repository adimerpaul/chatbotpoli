import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useConversationsStore = defineStore('conversations', () => {
  const convs = ref([])
  const selectedId = ref(null)
  const filterTipo = ref('Todos')
  const filterPrioridad = ref('Todas')
  const search = ref('')

  const selected = computed(() => convs.value.find(c => c.id === selectedId.value) ?? null)

  const filtered = computed(() => {
    let list = convs.value
    if (filterTipo.value !== 'Todos') list = list.filter(c => c.tipo === filterTipo.value)
    if (filterPrioridad.value !== 'Todas') list = list.filter(c => c.prioridad === filterPrioridad.value)
    const q = search.value.trim().toLowerCase()
    if (q) list = list.filter(c => (c.name+' '+c.id+' '+c.delito+' '+c.zona).toLowerCase().includes(q))
    return list
  })

  const counts = computed(() => {
    const c = { Todos: convs.value.length, Emergencia: 0, Denuncia: 0, Consulta: 0 }
    convs.value.forEach(v => { c[v.tipo] = (c[v.tipo]||0)+1 })
    return c
  })

  function upsert(conv) {
    const idx = convs.value.findIndex(c => c.id === conv.id)
    if (idx >= 0) {
      // Reemplazar in-place primero para que Vue detecte el cambio sin romper
      // la referencia del computed `selected` — luego mover al inicio
      convs.value[idx] = conv
      if (idx !== 0) {
        convs.value.splice(idx, 1)
        convs.value.unshift(conv)
      }
    } else {
      convs.value.unshift(conv)
    }
    if (!selectedId.value) selectedId.value = conv.id
  }
  function remove(id) {
    convs.value = convs.value.filter(c => c.id !== id)
    if (selectedId.value === id) selectedId.value = convs.value[0]?.id ?? null
  }
  function removeMany(ids) {
    convs.value = convs.value.filter(c => !ids.includes(c.id))
    if (ids.includes(selectedId.value)) selectedId.value = convs.value[0]?.id ?? null
  }
  function setAll(list) { convs.value = list; selectedId.value = list[0]?.id ?? null }
  function clear() { convs.value = []; selectedId.value = null }
  function select(id) { selectedId.value = id; const c = convs.value.find(v => v.id === id); if (c) c.unread = false }

  return { convs, selectedId, filterTipo, filterPrioridad, search, selected, filtered, counts, upsert, remove, removeMany, setAll, clear, select }
})
