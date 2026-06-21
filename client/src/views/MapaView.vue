<template>
  <div class="mapa-view">
    <div ref="mapEl" class="map-area"></div>
    <aside class="mapa-side">
      <div class="side-title">Incidentes por zona</div>
      <div class="zona-list">
        <div v-for="z in zonas" :key="z.name" class="zona-item">
          <span class="zdot" :style="{background:z.color}"></span>
          <div class="zinfo"><div class="zname">{{ z.name }}</div><div class="zsub">{{ z.tipos }}</div></div>
          <span class="zcount">{{ z.count }}</span>
        </div>
        <div v-if="!zonas.length" class="no-zonas">Sin casos con ubicación</div>
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
const TC = { Emergencia:'#c0392b', Denuncia:'#b9751a', Consulta:'#2f6fed' }

function getLL(c) {
  if (c.coords && c.coords!=='—') { const p=c.coords.split(',').map(s=>parseFloat(s.trim())); if(!isNaN(p[0])) return p }
  const lm=c.messages?.find(m=>m.type==='location'&&m.lat!==undefined); return lm?[lm.lat,lm.lng]:null
}

function refreshMarkers() {
  if (!map) return
  markers.forEach(m=>m.remove()); markers.length=0
  for (const c of store.convs) {
    const ll=getLL(c); if(!ll) continue
    const col=TC[c.tipo]||'#5a6b82'
    const icon=L.divIcon({className:'',html:`<div style="width:14px;height:14px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,iconSize:[14,14],iconAnchor:[7,7]})
    markers.push(L.marker(ll,{icon}).bindPopup(`<b>${c.name}</b><br>${c.tipo} · ${c.prioridad}<br><span style="font-family:monospace;font-size:11px">${c.id}</span>`).addTo(map))
  }
}

const zonas = computed(() => {
  const m={}
  store.convs.forEach(c=>{ if(!m[c.zona]) m[c.zona]={count:0,tipos:[],color:TC[c.tipo]||'#5a6b82'}; m[c.zona].count++; if(!m[c.zona].tipos.includes(c.tipo)) m[c.zona].tipos.push(c.tipo) })
  return Object.entries(m).sort((a,b)=>b[1].count-a[1].count).slice(0,8).map(([name,v])=>({name,count:v.count,tipos:v.tipos.join(' · '),color:v.color}))
})

onMounted(() => {
  map=L.map(mapEl.value,{attributionControl:false}).setView(ORURO,13)
  const road=L.tileLayer('https://mt{s}.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',{subdomains:['0','1','2','3'],maxZoom:20})
  const sat=L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['0','1','2','3'],maxZoom:20})
  road.addTo(map)
  L.control.layers({'🗺 Normal':road,'🛰 Satélite':sat},{},{position:'topright'}).addTo(map)
  const leg=L.control({position:'bottomright'}); leg.onAdd=()=>{ const d=L.DomUtil.create('div'); d.style.cssText='background:rgba(255,255,255,.95);border:1px solid #e0e5ee;border-radius:11px;padding:12px 15px;display:flex;flex-direction:column;gap:9px'; d.innerHTML=Object.entries(TC).map(([t,c])=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#33405a"><span style="width:10px;height:10px;border-radius:50%;background:${c};display:inline-block"></span>${t}</div>`).join(''); return d }; leg.addTo(map)
  refreshMarkers()
})
watch(()=>store.convs, refreshMarkers, {deep:true})
onUnmounted(()=>{ if(map){map.remove();map=null} })
</script>
<style scoped>
.mapa-view{height:100%;display:flex}
.map-area{flex:1;min-width:0;min-height:0}
.mapa-side{width:300px;flex-shrink:0;border-left:1px solid #e0e5ee;background:#fff;overflow:auto;padding:20px}
.side-title{font-size:14px;font-weight:700;color:#15233a;margin-bottom:16px}
.zona-list{display:flex;flex-direction:column;gap:10px}
.zona-item{display:flex;align-items:center;gap:12px;padding:13px 14px;border:1px solid #eef1f6;border-radius:11px}
.zdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.zinfo{flex:1}.zname{font-size:13.5px;font-weight:600;color:#15233a}.zsub{font-size:11.5px;color:#7a8699}
.zcount{font-size:18px;font-weight:700;color:#15233a}
.no-zonas{font-size:13px;color:#9aa6b6;text-align:center;padding:20px}

/* ── Tablet ──────────────────────────────── */
@media (min-width:768px) and (max-width:1150px){
  .mapa-side{width:220px;padding:14px}
}

/* ── Móvil ───────────────────────────────── */
@media (max-width:767px){
  .mapa-view{flex-direction:column}
  .map-area{flex:0 0 52vh}
  .mapa-side{width:100%;border-left:none;border-top:1px solid #e0e5ee;padding:14px 16px;flex:1;overflow:auto}
  .side-title{font-size:13px;margin-bottom:10px}
  .zona-list{flex-direction:row;flex-wrap:wrap;gap:8px}
  .zona-item{flex:1 1 calc(50% - 4px);padding:10px 12px;min-width:140px}
  .zcount{font-size:16px}
}
</style>
