import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useConversationsStore = defineStore('conversations', () => {
  const convs = ref([])
  const selectedId = ref(null)
  const filterTipo = ref('Todos')
  const filterPrioridad = ref('Todas')
  const search = ref('')
  const mobileView = ref('list') // 'list' | 'chat' | 'caso'
  const showCasoPanel = ref(false) // tablet: caso slide-over
  const currentPage = ref(1)
  const PAGE_SIZE = 10

  const selected = computed(() => convs.value.find(c => c.id === selectedId.value) ?? null)

  const filtered = computed(() => {
    let list = convs.value
    if (filterTipo.value !== 'Todos') list = list.filter(c => c.tipo === filterTipo.value)
    if (filterPrioridad.value !== 'Todas') list = list.filter(c => c.prioridad === filterPrioridad.value)
    const q = search.value.trim().toLowerCase()
    if (q) list = list.filter(c => (c.name+' '+c.id+' '+c.delito+' '+c.zona).toLowerCase().includes(q))
    return list
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

  const paginated = computed(() => {
    const p = Math.min(currentPage.value, totalPages.value)
    const start = (p - 1) * PAGE_SIZE
    return filtered.value.slice(start, start + PAGE_SIZE)
  })

  // Vuelve a pág 1 cuando cambia cualquier filtro
  watch([filterTipo, filterPrioridad, search], () => { currentPage.value = 1 })

  const counts = computed(() => {
    const c = { Todos: convs.value.length, Emergencia: 0, Denuncia: 0, Consulta: 0 }
    convs.value.forEach(v => { c[v.tipo] = (c[v.tipo]||0)+1 })
    return c
  })

  function upsert(conv) {
    const idx = convs.value.findIndex(c => c.id === conv.id)
    if (idx >= 0) {
      convs.value[idx] = conv
      // Solo sube al top si hay mensaje nuevo del ciudadano; cambios de estado no mueven la fila
      if (idx !== 0 && conv.unread) {
        convs.value.splice(idx, 1)
        convs.value.unshift(conv)
      }
    } else {
      convs.value.unshift(conv)
    }
    if (!selectedId.value) selectedId.value = conv.id
  }

  function setPage(n) {
    currentPage.value = Math.max(1, Math.min(n, totalPages.value))
  }

  function remove(id) {
    convs.value = convs.value.filter(c => c.id !== id)
    if (selectedId.value === id) selectedId.value = convs.value[0]?.id ?? null
  }
  function removeMany(ids) {
    convs.value = convs.value.filter(c => !ids.includes(c.id))
    if (ids.includes(selectedId.value)) selectedId.value = convs.value[0]?.id ?? null
  }
  function setAll(list) { convs.value = list; selectedId.value = list[0]?.id ?? null; currentPage.value = 1 }
  function clear() { convs.value = []; selectedId.value = null; currentPage.value = 1 }
  function select(id) { selectedId.value = id; const c = convs.value.find(v => v.id === id); if (c) c.unread = false; mobileView.value = 'chat' }
  function setMobileView(v) { mobileView.value = v }

  return { convs, selectedId, filterTipo, filterPrioridad, search, mobileView, showCasoPanel, selected, filtered, paginated, totalPages, currentPage, counts, upsert, setPage, remove, removeMany, setAll, clear, select, setMobileView }
})
