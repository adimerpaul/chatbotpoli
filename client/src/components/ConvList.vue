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
      <div v-for="c in store.filtered" :key="c.id" class="row" :class="{sel:c.id===store.selectedId}" @click="store.select(c.id)">
        <div class="row-top">
          <div class="av" :style="avStyle(c.tipo)">{{ c.initials }}</div>
          <div class="row-mid">
            <div class="name-line"><span class="rname">{{ c.name }}</span><span v-if="c.unread" class="udot"></span></div>
            <div class="rmeta">{{ c.id }} · {{ c.channel }}</div>
          </div>
          <span class="rtime">{{ c.time }}</span>
        </div>
        <div class="rprev">{{ c.preview }}</div>
        <div class="rbadges">
          <span class="badge" :style="bs(tipoCol(c.tipo))">{{ c.tipo }}</span>
          <span class="badge" :style="bs(prioCol(c.prioridad))">{{ c.prioridad }}</span>
          <span class="rzona">· {{ c.zona }}</span>
        </div>
      </div>
      <div v-if="!store.filtered.length" class="empty">Sin resultados</div>
    </div>
  </section>
</template>
<script setup>
import { ref } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { apiFetch } from '@/lib/api'

const store = useConversationsStore()
const loading = ref(false)

async function reload() {
  if (loading.value) return
  loading.value = true
  try {
    const list = await apiFetch('/api/db/reload', { method: 'POST' }).then(r => r.json())
    store.setAll(Array.isArray(list) ? list : [])
  } catch (e) {
    console.error('[reload]', e)
  } finally {
    loading.value = false
  }
}
const tipos = [
  {val:'Todos',      label:'Todos',       cls:'chip-dark'},
  {val:'Emergencia', label:'Emergencias', cls:'chip-red'},
  {val:'Denuncia',   label:'Denuncias',   cls:'chip-orange'},
  {val:'Consulta',   label:'Consultas',   cls:'chip-blue'}
]
const tipoCol = t => ({Emergencia:['#c0392b','#fbe9e7'],Denuncia:['#b9751a','#fbf1e0'],Consulta:['#2f6fed','#e7f0ff']})[t]||['#5a6b82','#eef1f6']
const prioCol = p => ({Alta:['#c0392b','#fbe9e7'],Media:['#b9751a','#fbf1e0'],Baja:['#1f8a5b','#e6f5ee']})[p]||['#5a6b82','#eef1f6']
const avStyle = t => { const [fg,bg]=tipoCol(t); return {width:'38px',height:'38px',borderRadius:'11px',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'600',fontSize:'14px',flexShrink:'0'} }
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
.row{padding:13px 15px;border-bottom:1px solid #f1f4f9;cursor:pointer;display:flex;flex-direction:column;gap:7px;background:#fff}
.row.sel{background:#f5f8ff;box-shadow:inset 3px 0 0 #2f6fed}
.row:hover:not(.sel){background:#fafbfd}
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
</style>
