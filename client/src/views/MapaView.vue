<template>
  <div class="mapa-view">
    <div ref="mapEl" class="map-area"></div>
    <aside class="mapa-side">
      <div class="side-title">Mapa de incidentes</div>

      <!-- Filtro de fechas -->
      <div class="date-box">
        <div class="date-row">
          <label class="date-lbl">Desde</label>
          <input type="date" v-model="desde" class="date-inp" @change="clampDesde" />
        </div>
        <div class="date-row">
          <label class="date-lbl">Hasta</label>
          <input type="date" v-model="hasta" class="date-inp" @change="clampHasta" />
        </div>
        <div class="date-btns">
          <button class="date-btn" @click="setMesActual">Este mes</button>
          <button class="date-btn" @click="setUlt30">Últ. 30 días</button>
          <button class="date-btn" @click="setAnio">Este año</button>
          <button class="date-btn" @click="setTodo">Todo</button>
        </div>
        <div class="date-count">{{ convsFiltradas.length }} caso{{ convsFiltradas.length !== 1 ? 's' : '' }} · {{ conMarcador }} con ubicación</div>
      </div>

      <!-- Zonas -->
      <div class="sub-title">Incidentes por zona</div>
      <div class="zona-list">
        <div v-for="z in zonas" :key="z.name" class="zona-item">
          <span class="zdot" :style="{background:z.color}"></span>
          <div class="zinfo"><div class="zname">{{ z.name }}</div><div class="zsub">{{ z.tipos }}</div></div>
          <span class="zcount">{{ z.count }}</span>
        </div>
        <div v-if="!zonas.length" class="no-zonas">Sin casos con ubicación en el período</div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useConversationsStore } from '@/stores/conversations'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const store = useConversationsStore()
const mapEl = ref(null)
let map = null
const markers = []
const ORURO = [-17.9644, -67.1022]
const TC = { Emergencia: '#c0392b', Denuncia: '#b9751a', Consulta: '#2f6fed' }

// ── Fecha helpers ────────────────────────────────────────────
function toInput(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function startOfDay(s) { const d = new Date(s); d.setHours(0,0,0,0); return d.getTime() }
function endOfDay(s)   { const d = new Date(s); d.setHours(23,59,59,999); return d.getTime() }

function mesActualDesde() { const d = new Date(); d.setDate(1); return toInput(d.getTime()) }
function hoyStr()         { return toInput(Date.now()) }

const desde = ref(mesActualDesde())
const hasta = ref(hoyStr())

function clampDesde() { if (desde.value > hasta.value) hasta.value = desde.value }
function clampHasta() { if (hasta.value < desde.value) desde.value = hasta.value }

function setMesActual() { desde.value = mesActualDesde(); hasta.value = hoyStr() }
function setUlt30()     { const d = new Date(); d.setDate(d.getDate()-29); desde.value = toInput(d.getTime()); hasta.value = hoyStr() }
function setAnio()      { const d = new Date(); d.setMonth(0); d.setDate(1); desde.value = toInput(d.getTime()); hasta.value = hoyStr() }
function setTodo()      { desde.value = '2020-01-01'; hasta.value = hoyStr() }

// ── Lista filtrada ───────────────────────────────────────────
const convsFiltradas = computed(() => {
  const d0 = startOfDay(desde.value)
  const d1 = endOfDay(hasta.value)
  return store.convs.filter(c => c.createdAt >= d0 && c.createdAt <= d1)
})

// ── Marcadores ───────────────────────────────────────────────
function getLL(c) {
  if (c.coords && c.coords !== '—') {
    const p = c.coords.split(',').map(s => parseFloat(s.trim()))
    if (!isNaN(p[0])) return p
  }
  const lm = c.messages?.find(m => m.type === 'location' && m.lat !== undefined)
  return lm ? [lm.lat, lm.lng] : null
}

const conMarcador = computed(() => convsFiltradas.value.filter(c => getLL(c)).length)

function refreshMarkers() {
  if (!map) return
  markers.forEach(m => m.remove()); markers.length = 0
  for (const c of convsFiltradas.value) {
    const ll = getLL(c); if (!ll) continue
    const col  = TC[c.tipo] || '#5a6b82'
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7]
    })
    markers.push(
      L.marker(ll, { icon })
        .bindPopup(`<b>${c.name}</b><br>${c.tipo} · ${c.prioridad}<br><span style="font-family:monospace;font-size:11px">${c.id}</span>`)
        .addTo(map)
    )
  }
}

// ── Zonas sidebar ────────────────────────────────────────────
const zonas = computed(() => {
  const m = {}
  convsFiltradas.value.forEach(c => {
    if (!getLL(c)) return
    if (!m[c.zona]) m[c.zona] = { count: 0, tipos: [], color: TC[c.tipo] || '#5a6b82' }
    m[c.zona].count++
    if (!m[c.zona].tipos.includes(c.tipo)) m[c.zona].tipos.push(c.tipo)
  })
  return Object.entries(m).sort((a, b) => b[1].count - a[1].count).slice(0, 8)
    .map(([name, v]) => ({ name, count: v.count, tipos: v.tipos.join(' · '), color: v.color }))
})

// ── Lifecycle ────────────────────────────────────────────────
onMounted(() => {
  map = L.map(mapEl.value, { attributionControl: false }).setView(ORURO, 13)
  const road = L.tileLayer('https://mt{s}.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', { subdomains: ['0','1','2','3'], maxZoom: 20 })
  const sat  = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains: ['0','1','2','3'], maxZoom: 20 })
  road.addTo(map)
  L.control.layers({ '🗺 Normal': road, '🛰 Satélite': sat }, {}, { position: 'topright' }).addTo(map)
  const leg = L.control({ position: 'bottomright' })
  leg.onAdd = () => {
    const d = L.DomUtil.create('div')
    d.style.cssText = 'background:rgba(255,255,255,.95);border:1px solid #e0e5ee;border-radius:11px;padding:12px 15px;display:flex;flex-direction:column;gap:9px'
    d.innerHTML = Object.entries(TC).map(([t, c]) =>
      `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#33405a"><span style="width:10px;height:10px;border-radius:50%;background:${c};display:inline-block"></span>${t}</div>`
    ).join('')
    return d
  }
  leg.addTo(map)
  refreshMarkers()
})

// Actualiza marcadores cuando cambia la lista filtrada o los datos del store
watch(convsFiltradas, refreshMarkers, { deep: false })
watch(() => store.convs, refreshMarkers, { deep: true })

onUnmounted(() => { if (map) { map.remove(); map = null } })
</script>

<style scoped>
.mapa-view{height:100%;display:flex}
.map-area{flex:1;min-width:0;min-height:0;isolation:isolate}
.mapa-side{width:300px;flex-shrink:0;border-left:1px solid #e0e5ee;background:#fff;overflow:auto;padding:16px}
.side-title{font-size:14px;font-weight:700;color:#15233a;margin-bottom:14px}
.sub-title{font-size:12.5px;font-weight:700;color:#5a6b82;margin:14px 0 10px;text-transform:uppercase;letter-spacing:.3px}

/* Filtro */
.date-box{background:#f7f9fc;border:1px solid #e6ebf2;border-radius:11px;padding:12px;margin-bottom:4px;display:flex;flex-direction:column;gap:8px}
.date-row{display:flex;align-items:center;gap:8px}
.date-lbl{font-size:11.5px;font-weight:600;color:#5a6b82;width:40px;flex-shrink:0}
.date-inp{flex:1;border:1.5px solid #dce3ed;border-radius:7px;padding:5px 8px;font-size:12.5px;color:#15233a;font-family:inherit;outline:none;background:#fff}
.date-inp:focus{border-color:#2f6fed}
.date-btns{display:flex;flex-wrap:wrap;gap:5px}
.date-btn{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:11px;font-weight:600;padding:4px 9px;border-radius:6px;cursor:pointer;white-space:nowrap}
.date-btn:hover{background:#eef1f6}
.date-count{font-size:11.5px;color:#9aa6b6;font-weight:500;text-align:center}

/* Zonas */
.zona-list{display:flex;flex-direction:column;gap:8px}
.zona-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #eef1f6;border-radius:10px}
.zdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.zinfo{flex:1;min-width:0}
.zname{font-size:13px;font-weight:600;color:#15233a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zsub{font-size:11px;color:#7a8699}
.zcount{font-size:17px;font-weight:700;color:#15233a;flex-shrink:0}
.no-zonas{font-size:13px;color:#9aa6b6;text-align:center;padding:16px}

/* ── Tablet ── */
@media(min-width:768px) and (max-width:1150px){
  .mapa-side{width:230px;padding:12px}
}
/* ── Móvil ── */
@media(max-width:767px){
  .mapa-view{flex-direction:column}
  .map-area{flex:0 0 50vh}
  .mapa-side{width:100%;border-left:none;border-top:1px solid #e0e5ee;padding:12px 14px;flex:1;overflow:auto}
  .date-btns{flex-wrap:wrap}
  .zona-list{flex-direction:row;flex-wrap:wrap;gap:6px}
  .zona-item{flex:1 1 calc(50% - 3px);padding:9px 10px;min-width:130px}
}
</style>
