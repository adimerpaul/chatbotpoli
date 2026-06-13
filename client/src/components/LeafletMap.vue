<template>
  <div v-if="coords" ref="mapEl" class="lmap"></div>
  <div v-else class="no-loc">Sin ubicación reportada</div>
</template>
<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const props = defineProps({ coords: { type: String, default: null } })
const mapEl = ref(null)
let map = null

function parse(str) {
  if (!str) return null
  const p = str.split(',').map(s => parseFloat(s.trim()))
  return p.length>=2 && !isNaN(p[0]) ? [p[0],p[1]] : null
}
function initMap() {
  if (!mapEl.value || !props.coords) return
  const ll = parse(props.coords); if (!ll) return
  if (map) { map.remove(); map = null }
  map = L.map(mapEl.value, { attributionControl: false }).setView(ll, 16)
  const road = L.tileLayer('https://mt{s}.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', { subdomains:['0','1','2','3'], maxZoom:20 })
  const sat  = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains:['0','1','2','3'], maxZoom:20 })
  road.addTo(map)
  L.control.layers({ '🗺 Normal': road, '🛰 Satélite': sat }, {}, { position: 'topright' }).addTo(map)
  L.marker(ll).addTo(map)
    .bindPopup(`<b>📍 Ubicación</b><br><span style="font-family:monospace;font-size:11px">${props.coords}</span>`)
    .openPopup()
}
// flush:'post' → corre DESPUÉS de que Vue actualiza el DOM, garantizando que mapEl.value ya existe
// cuando coords pasa de null a un valor (el v-if crea el div en ese mismo ciclo)
onMounted(initMap)
watch(() => props.coords, initMap, { flush: 'post' })
onUnmounted(() => { if(map){map.remove();map=null} })
</script>
<style scoped>
.lmap{height:210px;border-radius:11px;border:1px solid #e3e8f0;overflow:hidden}
.no-loc{height:80px;border-radius:11px;border:1px solid #e3e8f0;background:#f7f9fc;display:flex;align-items:center;justify-content:center;color:#9aa6b6;font-size:13px}
</style>
