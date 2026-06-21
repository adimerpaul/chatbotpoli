<template>
  <div class="stats-view">

    <!-- Filtro de fechas -->
    <div class="date-bar">
      <span class="date-lbl">Período:</span>
      <input type="date" v-model="desde" class="date-inp" @change="clampDesde" />
      <span class="date-sep">→</span>
      <input type="date" v-model="hasta" class="date-inp" @change="clampHasta" />
      <button class="date-btn" @click="setMesActual">Este mes</button>
      <button class="date-btn" @click="setUlt30">Últimos 30 días</button>
      <button class="date-btn" @click="setAnio">Este año</button>
      <span class="date-count">{{ convsFiltradas.length }} caso{{ convsFiltradas.length !== 1 ? 's' : '' }}</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi" v-for="k in kpis" :key="k.label">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-val">{{ k.value }}</div>
        <div class="kpi-sub" :style="{color:k.color}">{{ k.sub }}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="card">
        <div class="ctitle">Distribución por tipo</div>
        <div class="donut-area">
          <div class="donut" :style="{background:`conic-gradient(#b9751a 0 ${pDen}%,#2f6fed ${pDen}% ${pDen+pCon}%,#c0392b ${pDen+pCon}% 100%)`}">
            <div class="donut-hole"><span class="dtotal">{{ total }}</span><span class="dtlbl">total</span></div>
          </div>
          <div class="leg">
            <div v-for="l in legend" :key="l.label" class="leg-item">
              <span class="leg-dot" :style="{background:l.color}"></span>
              <span class="leg-lbl">{{ l.label }}</span>
              <span class="leg-val">{{ l.pct }}%</span>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="ctitle">Casos por zona</div>
        <div v-if="zonaData.length" class="bars-wrap">
          <div v-for="z in zonaData" :key="z.name" class="bcol">
            <span class="bnum">{{ z.count }}</span>
            <div class="bar" :style="{height:barH(z.count)+'px'}"></div>
            <span class="blbl">{{ z.name }}</span>
          </div>
        </div>
        <div v-else class="no-data">Sin datos en el período</div>
      </div>
    </div>

    <div class="card">
      <div class="ctitle">Delitos más reportados</div>
      <div v-if="delitoData.length" class="del-list">
        <div v-for="d in delitoData" :key="d.label" class="del-row">
          <span class="del-lbl">{{ d.label }}</span>
          <div class="del-bar-wrap"><div class="del-bar" :style="{width:(d.count/delitoMax*100)+'%'}"></div></div>
          <span class="del-val">{{ d.count }}</span>
        </div>
      </div>
      <div v-else class="no-data">Sin datos en el período</div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useConversationsStore } from '@/stores/conversations'

const store = useConversationsStore()

// ── Fecha helpers ──────────────────────────────────────────────
function toInput(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function startOfDay(dateStr) { const d = new Date(dateStr); d.setHours(0,0,0,0); return d.getTime() }
function endOfDay(dateStr)   { const d = new Date(dateStr); d.setHours(23,59,59,999); return d.getTime() }

function mesActualDesde() { const d = new Date(); d.setDate(1); return toInput(d.getTime()) }
function hoyStr()         { return toInput(Date.now()) }

const desde = ref(mesActualDesde())
const hasta = ref(hoyStr())

function clampDesde() { if (desde.value > hasta.value) hasta.value = desde.value }
function clampHasta() { if (hasta.value < desde.value) desde.value = hasta.value }

function setMesActual()  { desde.value = mesActualDesde(); hasta.value = hoyStr() }
function setUlt30()      { const d = new Date(); d.setDate(d.getDate()-29); desde.value = toInput(d.getTime()); hasta.value = hoyStr() }
function setAnio()       { const d = new Date(); d.setMonth(0); d.setDate(1); desde.value = toInput(d.getTime()); hasta.value = hoyStr() }

// ── Lista filtrada ──────────────────────────────────────────────
const convsFiltradas = computed(() => {
  const d0 = startOfDay(desde.value)
  const d1 = endOfDay(hasta.value)
  return store.convs.filter(c => c.createdAt >= d0 && c.createdAt <= d1)
})

// ── KPIs ────────────────────────────────────────────────────────
const total     = computed(() => convsFiltradas.value.length)
const cerrados  = computed(() => convsFiltradas.value.filter(c => c.estado === 'Cerrado').length)
const emergencias = computed(() => convsFiltradas.value.filter(c => c.tipo === 'Emergencia' && c.estado !== 'Cerrado').length)
const tasaRes   = computed(() => total.value > 0 ? Math.round(cerrados.value / total.value * 100) : 0)

const kpis = computed(() => [
  { label: 'Casos totales',         value: String(total.value),       sub: 'En el período seleccionado', color: '#1f8a5b' },
  { label: 'Emergencias activas',   value: String(emergencias.value), sub: 'Requieren atención',         color: '#c0392b' },
  { label: 'Casos cerrados',        value: String(cerrados.value),    sub: `${tasaRes.value}% tasa de resolución`, color: '#1f8a5b' },
  { label: 'Tasa de resolución',    value: tasaRes.value + '%',       sub: 'Meta 85%',                   color: '#b9751a' }
])

// ── Gráficas ────────────────────────────────────────────────────
const tc = computed(() => {
  const c = { Emergencia: 0, Denuncia: 0, Consulta: 0 }
  convsFiltradas.value.forEach(v => { c[v.tipo] = (c[v.tipo] || 0) + 1 })
  return c
})
const t1   = computed(() => total.value || 1)
const pDen = computed(() => Math.round(tc.value.Denuncia   / t1.value * 100))
const pCon = computed(() => Math.round(tc.value.Consulta   / t1.value * 100))
const legend = computed(() => [
  { label: 'Denuncias',   pct: pDen.value, color: '#b9751a' },
  { label: 'Consultas',   pct: pCon.value, color: '#2f6fed' },
  { label: 'Emergencias', pct: Math.round(tc.value.Emergencia / t1.value * 100), color: '#c0392b' }
])

const zonaData  = computed(() => { const m = {}; convsFiltradas.value.forEach(c => { m[c.zona] = (m[c.zona] || 0) + 1 }); return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,6).map(([name,count]) => ({name,count})) })
const zonaMax   = computed(() => Math.max(...zonaData.value.map(z => z.count), 1))
const barH = n  => Math.round(n / zonaMax.value * 140) + 8

const delitoData = computed(() => { const m = {}; convsFiltradas.value.forEach(c => { m[c.delito] = (m[c.delito] || 0) + 1 }); return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,6).map(([label,count]) => ({label,count})) })
const delitoMax  = computed(() => Math.max(...delitoData.value.map(d => d.count), 1))
</script>

<style scoped>
.stats-view{height:100%;overflow:auto;padding:20px 28px;display:flex;flex-direction:column;gap:14px;background:#eef1f6}

/* ── Filtro fechas ── */
.date-bar{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e6ebf2;border-radius:12px;padding:12px 16px;flex-wrap:wrap}
.date-lbl{font-size:12.5px;font-weight:600;color:#5a6b82;white-space:nowrap}
.date-inp{border:1.5px solid #dce3ed;border-radius:8px;padding:6px 10px;font-size:13px;color:#15233a;font-family:inherit;outline:none;background:#fafbfd}
.date-inp:focus{border-color:#2f6fed}
.date-sep{color:#9aa6b6;font-weight:600;font-size:13px}
.date-btn{border:1px solid #e3e8f0;background:#f7f9fc;color:#5a6b82;font-size:12px;font-weight:600;padding:6px 12px;border-radius:7px;cursor:pointer;white-space:nowrap}
.date-btn:hover{background:#eef1f6;border-color:#c5cdd9}
.date-count{margin-left:auto;font-size:12px;font-weight:600;color:#9aa6b6;white-space:nowrap}

/* ── KPIs ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.kpi{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(16,30,54,.04)}
.kpi-label{font-size:12.5px;color:#7a8699;font-weight:500}
.kpi-val{font-size:28px;font-weight:700;color:#15233a;margin:8px 0 4px;letter-spacing:-.5px}
.kpi-sub{font-size:12px;font-weight:600}

/* ── Charts ── */
.charts-row{display:grid;grid-template-columns:1.1fr 1.4fr;gap:14px}
.card{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:20px}
.ctitle{font-size:14px;font-weight:700;color:#15233a;margin-bottom:18px}
.donut-area{display:flex;align-items:center;gap:26px}
.donut{width:148px;height:148px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.donut-hole{width:96px;height:96px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dtotal{font-size:24px;font-weight:700;color:#15233a}.dtlbl{font-size:11px;color:#7a8699}
.leg{display:flex;flex-direction:column;gap:13px;flex:1}
.leg-item{display:flex;align-items:center;gap:10px}
.leg-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0}
.leg-lbl{font-size:13px;color:#33405a;flex:1}.leg-val{font-size:13px;font-weight:700;color:#15233a}
.bars-wrap{display:flex;align-items:flex-end;gap:18px;height:160px;padding:0 6px}
.bcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:9px;height:100%;justify-content:flex-end}
.bnum{font-size:12px;font-weight:700;color:#15233a}
.bar{width:100%;max-width:46px;background:linear-gradient(180deg,#5b8def,#2f6fed);border-radius:7px 7px 3px 3px}
.blbl{font-size:11.5px;color:#7a8699;text-align:center;word-break:break-word}
.del-list{display:flex;flex-direction:column;gap:14px}
.del-row{display:flex;align-items:center;gap:14px}
.del-lbl{width:200px;font-size:13px;color:#33405a;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.del-bar-wrap{flex:1;height:9px;background:#eef1f6;border-radius:999px;overflow:hidden}
.del-bar{height:100%;background:linear-gradient(90deg,#2f6fed,#5b8def);border-radius:999px;transition:width .3s}
.del-val{width:34px;text-align:right;font-size:13px;font-weight:700;color:#15233a}
.no-data{text-align:center;color:#9aa6b6;font-size:13px;padding:32px 0}

@media(max-width:1150px){
  .kpi-grid{grid-template-columns:repeat(2,1fr)}
  .charts-row{grid-template-columns:1fr}
  .date-bar{gap:8px}
}
@media(max-width:767px){
  .stats-view{padding:14px 12px}
  .kpi-grid{grid-template-columns:repeat(2,1fr);gap:10px}
  .del-lbl{width:130px}
  .date-inp{font-size:12px;padding:5px 8px}
}
</style>
