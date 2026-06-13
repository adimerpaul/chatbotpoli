<template>
  <aside class="caso-panel">
    <!-- AI -->
    <div class="sec">
      <div class="sec-title"><span class="sec-dot"></span>Análisis del asistente IA</div>
      <div class="ai-card">
        <div class="ai-top">
          <span class="badge" :style="bs(tipoCol(sel.tipo))">{{ sel.tipo }} detectada</span>
          <span class="conf-lbl">{{ sel.aiConfidence||0 }}% confianza</span>
        </div>
        <div class="conf-bar"><div class="conf-fill" :style="{width:(sel.aiConfidence||0)+'%'}"></div></div>
        <div class="puntos-lbl">PUNTOS CLAVE</div>
        <div class="puntos">
          <div v-for="(p,i) in (sel.aiPuntos||[])" :key="i" class="punto"><span class="pdot"></span><span>{{ p }}</span></div>
          <div v-if="!sel.aiPuntos?.length" class="punto-empty">Analizando conversación...</div>
        </div>
        <div v-if="sel.recomendacion" class="recom" :style="{borderLeftColor:tipoCol(sel.tipo)[0],background:tipoCol(sel.tipo)[1]}">
          <div class="recom-lbl">RECOMENDACIÓN</div>
          <div class="recom-text">{{ sel.recomendacion }}</div>
        </div>
      </div>
    </div>

    <!-- Datos -->
    <div class="sec">
      <div class="sec-title2">Datos del caso</div>
      <div class="drows">
        <div class="drow"><span>Folio</span><span class="mono fw6">{{ sel.id }}</span></div>
        <div class="drow"><span>Tipo de delito</span><span class="fw6">{{ sel.delito }}</span></div>
        <div class="drow"><span>Zona</span><span class="fw6">{{ sel.zona }}</span></div>
        <div class="drow"><span>Canal</span><span class="fw6">{{ sel.channel||'WhatsApp' }}</span></div>
        <div v-if="sel.phone" class="drow"><span>Teléfono</span><span class="mono fw6">+{{ sel.phone }}</span></div>
        <div class="drow"><span>Prioridad</span><span class="badge" :style="bs(prioCol(sel.prioridad))">{{ sel.prioridad }}</span></div>
        <div class="dblock">
          <span class="dlbl">Tipo de caso</span>
          <div class="est-btns">
            <button v-for="t in ['Emergencia','Denuncia','Consulta']" :key="t" class="est-btn"
              :class="{active:sel.tipo===t}"
              :style="sel.tipo===t?{borderColor:tipoCol(t)[0],background:tipoCol(t)[1],color:tipoCol(t)[0]}:{}"
              @click="patch({tipo:t})">{{ t }}</button>
          </div>
        </div>
        <div class="dblock">
          <span class="dlbl">Estado del caso</span>
          <div class="est-btns">
            <button v-for="e in ['En proceso','Cerrado']" :key="e" class="est-btn"
              :class="{active:sel.estado===e}"
              :style="sel.estado===e?{borderColor:estCol(e)[0],background:estCol(e)[1],color:estCol(e)[0]}:{}"
              @click="patch({estado:e})">{{ e }}</button>
          </div>
        </div>
        <div class="dblock">
          <span class="dlbl">Agente asignado</span>
          <select v-model="agenteV" class="sel-full" @change="patch({agente:agenteV})">
            <option v-for="a in agentes" :key="a">{{ a }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Evidencia -->
    <div class="sec">
      <div class="sec-title2">Evidencia adjunta</div>
      <div class="evid-grid">
        <template v-for="(e,i) in (sel.evidencia||[])" :key="i">
          <a v-if="/\.(jpg|jpeg|png|gif|webp)$/i.test(e)" :href="e" target="_blank" class="ecell">
            <img :src="e" class="eimg" @error="el=>el.target.parentElement.style.display='none'" />
          </a>
          <div v-else class="ecell eicon">
            <span>{{ /\.mp4$/i.test(e)?'🎥':/\.(ogg|mp3|m4a)$/i.test(e)?'🎤':/\.pdf$/i.test(e)?'📄':'📎' }}</span>
            <span class="ename mono">{{ e.split('/').pop() }}</span>
          </div>
        </template>
        <div class="ecell eadd">+</div>
      </div>
    </div>

    <!-- Mapa -->
    <div class="sec">
      <div class="sec-title2">Ubicación reportada</div>
      <LeafletMap :coords="coordStr" />
      <div v-if="coordStr" class="coords mono">{{ coordStr }}</div>
    </div>

    <!-- Acciones -->
    <div class="sec last-sec">
      <button class="btn-del" @click="deleteCaso">Eliminar caso</button>
    </div>
  </aside>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import LeafletMap from './LeafletMap.vue'
const store = useConversationsStore()
const sel = computed(() => store.selected)
const agenteV = ref(sel.value?.agente||'Sin asignar')
watch(() => sel.value?.agente, v => { if(v) agenteV.value=v })
watch(() => sel.value?.id, () => { agenteV.value = sel.value?.agente||'Sin asignar' })
const agentes = ['Sin asignar','Sgto. Flores','Cabo Choque','Sgto. Mamani','Of. Gutiérrez (Tú)']
const coordStr = computed(() => {
  if (sel.value?.coords && sel.value.coords!=='—') return sel.value.coords
  const lm = sel.value?.messages?.find(m=>m.type==='location'&&m.lat!==undefined)
  return lm ? `${lm.lat.toFixed(5)}, ${lm.lng.toFixed(5)}` : null
})
async function patch(changes) {
  const u = await fetch(`/api/conversations/${sel.value.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)}).then(r=>r.json())
  store.upsert(u)
}
async function deleteCaso() {
  if(!confirm(`¿Eliminar el caso ${sel.value.id}?`)) return
  const r = await fetch(`/api/conversations/${sel.value.id}`,{method:'DELETE'}).then(r=>r.json())
  if(r.ok) store.remove(sel.value.id)
}
const tipoCol = t => ({Emergencia:['#c0392b','#fbe9e7'],Denuncia:['#b9751a','#fbf1e0'],Consulta:['#2f6fed','#e7f0ff']})[t]||['#5a6b82','#eef1f6']
const prioCol = p => ({Alta:['#c0392b','#fbe9e7'],Media:['#b9751a','#fbf1e0'],Baja:['#1f8a5b','#e6f5ee']})[p]||['#5a6b82','#eef1f6']
const estCol  = e => ({Nuevo:['#2f6fed','#e7f0ff'],'En proceso':['#b9751a','#fbf1e0'],Cerrado:['#5a6b82','#eef1f6']})[e]||['#5a6b82','#eef1f6']
const bs = ([fg,bg]) => ({display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:'600',color:fg,background:bg})
</script>
<style scoped>
.caso-panel{width:366px;flex-shrink:0;border-left:1px solid #e0e5ee;background:#fff;overflow:auto;min-height:0}
.sec{padding:18px;border-bottom:1px solid #eef1f6}.last-sec{border-bottom:none}
.sec-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#15233a;margin-bottom:13px}
.sec-dot{width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#2f6fed,#5b8def);flex-shrink:0}
.sec-title2{font-size:13px;font-weight:700;color:#15233a;margin-bottom:14px}
.ai-card{background:#f5f8ff;border:1px solid #dde8ff;border-radius:11px;padding:13px}
.ai-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.conf-lbl{font-size:11px;color:#5a6b82;font-weight:600}
.conf-bar{height:5px;background:#e3ebfa;border-radius:999px;overflow:hidden;margin-bottom:13px}
.conf-fill{height:100%;background:linear-gradient(90deg,#2f6fed,#5b8def);border-radius:999px;transition:width .4s}
.puntos-lbl{font-size:11px;font-weight:600;color:#64769a;letter-spacing:.4px;margin-bottom:8px}
.puntos{display:flex;flex-direction:column;gap:8px}
.punto{display:flex;gap:9px;align-items:flex-start}
.pdot{width:6px;height:6px;border-radius:50%;background:#2f6fed;margin-top:6px;flex-shrink:0}
.punto span:last-child{font-size:12.5px;color:#33405a;line-height:1.5}
.punto-empty{font-size:12.5px;color:#9aa6b6}
.recom{margin-top:13px;border-left:3px solid;padding:9px 11px;border-radius:0 8px 8px 0}
.recom-lbl{font-size:11px;font-weight:600;color:#64769a;letter-spacing:.4px;margin-bottom:7px}
.recom-text{font-size:12.5px;color:#33405a;line-height:1.55}
.drows{display:flex;flex-direction:column;gap:13px}
.drow{display:flex;align-items:center;justify-content:space-between}
.drow span:first-child{font-size:12.5px;color:#7a8699}
.fw6{font-size:12.5px;font-weight:600;color:#15233a}
.mono{font-family:'IBM Plex Mono',monospace}
.dblock{display:flex;flex-direction:column;gap:8px}
.dlbl{font-size:12.5px;color:#7a8699}
.est-btns{display:flex;gap:6px}
.est-btn{flex:1;border:1px solid #e3e8f0;background:#fff;color:#7a8699;font-weight:500;font-size:11.5px;padding:8px 4px;border-radius:8px;cursor:pointer}
.sel-full{width:100%;border:1px solid #e3e8f0;background:#f7f9fc;border-radius:9px;padding:9px 11px;font-size:13px;color:#15233a;outline:none;cursor:pointer;font-weight:500}
.evid-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ecell{aspect-ratio:1;border-radius:9px;border:1px solid #e3e8f0;overflow:hidden;display:block}
.eimg{width:100%;height:100%;object-fit:cover;display:block}
.eicon{background:#f7f9fc;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px}
.eicon span:first-child{font-size:22px}
.ename{font-size:9px;color:#7a8699;text-align:center;word-break:break-all;line-height:1.2}
.eadd{border:1.5px dashed #cdd5e2 !important;display:flex;align-items:center;justify-content:center;color:#9aa6b6;font-size:22px;cursor:pointer;background:transparent}
.coords{font-size:11px;color:#7a8699;margin-top:7px;padding-left:2px}
.btn-del{width:100%;border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-weight:600;font-size:12.5px;padding:10px;border-radius:9px;cursor:pointer}
</style>
