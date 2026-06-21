<template>
  <section class="conv-list">
    <div class="filters">
      <div class="chips">
        <button v-for="t in tipos" :key="t.val" class="chip" :class="[t.cls, {active: store.filterTipo===t.val}]" @click="store.filterTipo=t.val">
          {{ t.label }} <span class="chip-n">{{ store.counts[t.val]||0 }}</span>
        </button>
      </div>
      <div class="prio-row">
        <span class="prio-label">Prioridad</span>
        <select v-model="store.filterPrioridad" class="sel">
          <option v-for="p in ['Todas','Alta','Media','Baja']" :key="p">{{ p }}</option>
        </select>
        <button class="btn-refresh" @click="reload" :disabled="loading" :title="loading ? 'Actualizando…' : 'Actualizar desde base de datos'">
          <svg :class="{ spinning: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="list-scroll">
      <div
        v-for="c in store.paginated"
        :key="c.id"
        class="row"
        :class="{ sel: c.id===store.selectedId, cerrado: c.estado==='Cerrado' }"
        @click="store.select(c.id)"
      >
        <div class="row-top">
          <div class="av" :style="avStyle(c.tipo, c.estado)">{{ c.initials }}</div>
          <div class="row-mid">
            <div class="name-line">
              <span class="rname">{{ c.name }}</span>
              <span v-if="c.unread" class="udot"></span>
              <span v-if="c.estado==='Cerrado'" class="badge-cerrado">Cerrado</span>
            </div>
            <div class="rmeta">{{ c.id }} · {{ c.channel }}</div>
          </div>
          <span class="rtime">{{ c.time }}</span>
        </div>
        <div class="rprev">{{ c.preview }}</div>
        <div class="rbadges">
          <span class="badge" :style="bs(tipoCol(c.tipo, c.estado))">{{ c.tipo }}</span>
          <span class="badge" :style="bs(prioCol(c.prioridad, c.estado))">{{ c.prioridad }}</span>
          <span class="rzona">· {{ c.zona }}</span>
        </div>
      </div>
      <div v-if="!store.filtered.length" class="empty">Sin resultados</div>
    </div>

    <!-- Paginación -->
    <div class="pagination" v-if="store.totalPages > 1">
      <button class="pg-btn" :disabled="store.currentPage===1" @click="store.setPage(1)" title="Primera">«</button>
      <button class="pg-btn" :disabled="store.currentPage===1" @click="store.setPage(store.currentPage-1)" title="Anterior">‹</button>
      <button
        v-for="n in pageNumbers"
        :key="n"
        class="pg-btn"
        :class="{ active: n===store.currentPage }"
        @click="store.setPage(n)"
      >{{ n }}</button>
      <button class="pg-btn" :disabled="store.currentPage===store.totalPages" @click="store.setPage(store.currentPage+1)" title="Siguiente">›</button>
      <button class="pg-btn" :disabled="store.currentPage===store.totalPages" @click="store.setPage(store.totalPages)" title="Última">»</button>
      <span class="pg-info">{{ store.currentPage }}/{{ store.totalPages }}</span>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { apiFetch } from '@/lib/api'

const store = useConversationsStore()
const loading = ref(false)

// ── Paginación ──────────────────────────────────────────────────────────────
const pageNumbers = computed(() => {
  const total = store.totalPages
  const cur   = store.currentPage
  const pages = []
  for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i)
  return pages
})

// ── Recarga desde BD ────────────────────────────────────────────────────────
async function reload() {
  if (loading.value) return
  loading.value = true
  try {
    const list = await apiFetch('/api/db/reload', { method: 'POST' }).then(r => r.json())
    store.setAll(Array.isArray(list) ? list : [])
  } catch (e) { console.error('[reload]', e) }
  finally { loading.value = false }
}

// ── Alerta de voz para emergencias nuevas (Web Speech API) ──────────────────
const alertedIds = new Set()

onMounted(() => {
  store.convs.forEach(c => alertedIds.add(c.id))
})

watch(() => store.convs.length, () => {
  store.convs.forEach(c => {
    if (alertedIds.has(c.id)) return
    alertedIds.add(c.id)
    const age = Date.now() - (c.createdAt || 0)
    if (c.tipo === 'Emergencia' && age < 15000) speakEmergency()
  })
})

function speakEmergency() {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance('Atención. Entró una emergencia al sistema.')
  u.lang = 'es-ES'
  u.rate = 0.82
  u.pitch = 0.7
  u.volume = 1
  window.speechSynthesis.speak(u)
}

// ── Colores ─────────────────────────────────────────────────────────────────
const tipos = [
  {val:'Todos',      label:'Todos',       cls:'chip-dark'},
  {val:'Emergencia', label:'Emergencias', cls:'chip-red'},
  {val:'Denuncia',   label:'Denuncias',   cls:'chip-orange'},
  {val:'Consulta',   label:'Consultas',   cls:'chip-blue'}
]
function tipoCol(t, estado) {
  if (estado === 'Cerrado') return ['#8a96a8','#eef1f6']
  return ({Emergencia:['#c0392b','#fbe9e7'],Denuncia:['#b9751a','#fbf1e0'],Consulta:['#2f6fed','#e7f0ff']})[t]||['#5a6b82','#eef1f6']
}
function prioCol(p, estado) {
  if (estado === 'Cerrado') return ['#8a96a8','#eef1f6']
  return ({Alta:['#c0392b','#fbe9e7'],Media:['#b9751a','#fbf1e0'],Baja:['#1f8a5b','#e6f5ee']})[p]||['#5a6b82','#eef1f6']
}
function avStyle(t, estado) {
  const [fg,bg] = tipoCol(t, estado)
  return {width:'38px',height:'38px',borderRadius:'11px',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'600',fontSize:'14px',flexShrink:'0'}
}
const bs = ([fg,bg]) => ({display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:'600',color:fg,background:bg})
</script>
<style scoped>
.conv-list{width:384px;flex-shrink:0;border-right:1px solid #e0e5ee;background:#fff;display:flex;flex-direction:column;min-height:0}
@media (max-width:1150px){.conv-list{width:100%}}
.filters{padding:13px 14px;border-bottom:1px solid #eef1f6;display:flex;flex-direction:column;gap:11px}
.chips{display:flex;gap:7px;flex-wrap:wrap}
.chip{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:12px;font-weight:500;padding:6px 11px;border-radius:8px;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
.chip.active.chip-dark{border-color:#13315c;background:#13315c;color:#fff}
.chip.active.chip-red{border-color:#c0392b;background:#c0392b;color:#fff}
.chip.active.chip-orange{border-color:#b9751a;background:#b9751a;color:#fff}
.chip.active.chip-blue{border-color:#2f6fed;background:#2f6fed;color:#fff}
.chip-n{opacity:.65}
.prio-row{display:flex;align-items:center;gap:9px}
.prio-label{font-size:11.5px;color:#7a8699;font-weight:500}
.sel{flex:1;border:1px solid #e3e8f0;background:#f7f9fc;border-radius:8px;padding:6px 9px;font-size:12.5px;color:#1a2433;outline:none;cursor:pointer}
.btn-refresh{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid #e3e8f0;background:#f7f9fc;border-radius:8px;cursor:pointer;color:#5a6b82;transition:background .15s,color .15s}
.btn-refresh:hover:not(:disabled){background:#e3e8f0;color:#15233a}
.btn-refresh:disabled{opacity:.5;cursor:not-allowed}
.btn-refresh svg.spinning{animation:spin-refresh .8s linear infinite}
@keyframes spin-refresh{to{transform:rotate(360deg)}}
.list-scroll{flex:1;overflow:auto;min-height:0}
.row{padding:13px 15px;border-bottom:1px solid #f1f4f9;cursor:pointer;display:flex;flex-direction:column;gap:7px;background:#fff;transition:background .12s}
.row.sel{background:#f5f8ff;box-shadow:inset 3px 0 0 #2f6fed}
.row:hover:not(.sel){background:#fafbfd}
/* Cerrado */
.row.cerrado{background:#f8f9fb}
.row.cerrado .rname{color:#8a96a8}
.row.cerrado .rprev{color:#aab2bf}
.row.cerrado .rzona{color:#b5bec9}
.row.cerrado .rtime{color:#b5bec9}
.row.cerrado:hover:not(.sel){background:#f3f4f7}
.badge-cerrado{font-size:10px;font-weight:600;color:#7a8699;background:#eef1f6;border-radius:99px;padding:2px 7px}
.row-top{display:flex;align-items:center;gap:10px}
.row-mid{flex:1;min-width:0}
.name-line{display:flex;align-items:center;gap:6px}
.rname{font-weight:600;font-size:13.5px;color:#15233a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.udot{width:7px;height:7px;border-radius:50%;background:#2f6fed;flex-shrink:0}
.rmeta{font-size:11px;color:#9aa6b6;margin-top:1px;font-family:'IBM Plex Mono',monospace}
.rtime{font-size:11px;color:#9aa6b6;flex-shrink:0}
.rprev{font-size:12.5px;color:#5a6b82;line-height:1.45;margin-left:48px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rbadges{display:flex;align-items:center;gap:6px;margin-left:48px;flex-wrap:wrap}
.rzona{font-size:11px;color:#8a96a8}
.empty{padding:30px;text-align:center;color:#9aa6b6;font-size:13px}
/* Paginación */
.pagination{display:flex;align-items:center;gap:4px;padding:10px 14px;border-top:1px solid #eef1f6;background:#fff;flex-shrink:0}
.pg-btn{min-width:30px;height:30px;padding:0 6px;border:1px solid #e3e8f0;background:#f7f9fc;border-radius:7px;font-size:13px;color:#5a6b82;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s}
.pg-btn:hover:not(:disabled){background:#e3e8f0;color:#15233a}
.pg-btn:disabled{opacity:.4;cursor:default}
.pg-btn.active{background:#2f6fed;border-color:#2f6fed;color:#fff;font-weight:600}
.pg-info{margin-left:auto;font-size:11.5px;color:#9aa6b6;white-space:nowrap}
</style>
