<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-logo">PB</div>
        <div>
          <div class="brand-name">Policía Boliviana</div>
          <div class="brand-sub">Comando Oruro · CAC</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-label">OPERACIÓN</div>
        <RouterLink to="/bandeja" class="nav-item">
          <span class="nav-dot" style="background:#5b8def"></span>
          Bandeja de atención
          <span v-if="newCount" class="nav-badge">{{ newCount }}</span>
        </RouterLink>
        <RouterLink to="/mapa" class="nav-item">
          <span class="nav-dot" style="background:#3fae7a"></span>
          Mapa de incidentes
        </RouterLink>
        <RouterLink to="/stats" class="nav-item">
          <span class="nav-dot" style="background:#d6a23a"></span>
          Estadísticas
        </RouterLink>
        <div class="nav-label" style="margin-top:10px">CANALES</div>
        <RouterLink to="/whatsapp" class="nav-item">
          <span class="nav-dot" :style="{ background: waDot }"></span>
          Conectar celular WA
          <span v-if="wa.status==='qr'" class="nav-badge">!</span>
        </RouterLink>
        <div class="ai-card">
          <div class="ai-card-head"><span class="ai-live-dot"></span>ASISTENTE IA ACTIVO</div>
          <div class="ai-card-body">Clasificando mensajes entrantes y resumiendo en tiempo real.</div>
        </div>
      </nav>
      <div class="sidebar-user">
        <div class="user-av">OG</div>
        <div><div class="user-name">Of. Gutiérrez</div><div class="user-sub">Operador · Turno A</div></div>
        <span class="user-online"></span>
      </div>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <div>
          <div class="page-title">{{ pageTitle }}</div>
          <div class="page-sub">{{ pageSub }}</div>
        </div>
        <div style="flex:1"></div>
        <div class="search-wrap">
          <span class="search-icon"></span>
          <input v-model="convStore.search" placeholder="Buscar folio, ciudadano o delito…" class="search-inp" />
        </div>
        <!-- WA badge -->
        <RouterLink to="/whatsapp" class="wa-badge" :class="wa.status">
          <span class="wa-dot"></span>
          {{ wa.status==='ready'?'WhatsApp activo': wa.status==='qr'?'📱 Escanea QR':'WA conectando...' }}
        </RouterLink>
      </header>
      <main class="main-content"><RouterView /></main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import { useWhatsappStore } from '@/stores/whatsapp'
import { useSocket } from '@/composables/useSocket'

const route = useRoute()
const convStore = useConversationsStore()
const wa = useWhatsappStore()
useSocket()

const newCount = computed(() => convStore.convs.filter(c => c.unread).length || null)
const waDot = computed(() => wa.status==='ready'?'#3fae7a':wa.status==='qr'?'#d6a23a':'#64769a')

const META = {
  '/bandeja':  ['Bandeja de atención','Conversaciones entrantes del chatbot ciudadano'],
  '/mapa':     ['Mapa de incidentes','Distribución geográfica de casos en Oruro'],
  '/stats':    ['Estadísticas','Indicadores de gestión del centro de atención'],
  '/whatsapp': ['Conectar celular de WhatsApp','Vincula el número de WhatsApp del canal ciudadano']
}
const pageTitle = computed(() => (META[route.path]||META['/bandeja'])[0])
const pageSub   = computed(() => (META[route.path]||META['/bandeja'])[1])

onMounted(async () => {
  const s = await fetch('/api/status').then(r=>r.json()).catch(()=>({}))
  if (s.status==='ready') wa.setReady(s.phone)
  else if (s.status==='qr' && s.qrDataUrl) wa.setQR(s.qrDataUrl)
  const list = await fetch('/api/conversations').then(r=>r.json()).catch(()=>[])
  convStore.setAll(list)
})
</script>

<style scoped>
.app-layout{height:100vh;display:flex;overflow:hidden;background:#eef1f6;color:#1a2433}
.sidebar{width:252px;flex-shrink:0;background:linear-gradient(180deg,#0b2545,#0a1f3c);color:#dbe4f3;display:flex;flex-direction:column}
.sidebar-brand{padding:20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.08)}
.brand-logo{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#2f6fed,#5b8def);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff;box-shadow:0 4px 14px rgba(47,111,237,.4)}
.brand-name{font-weight:700;font-size:14px;color:#fff}.brand-sub{font-size:11px;color:#8aa0c0;margin-top:2px}
.sidebar-nav{padding:14px 12px;flex:1;display:flex;flex-direction:column;gap:2px}
.nav-label{font-size:10px;font-weight:600;letter-spacing:1px;color:#64769a;padding:6px 12px 8px}
.nav-item{position:relative;display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:9px;font-size:13.5px;font-weight:500;color:#dbe4f3;text-decoration:none}
.nav-item:hover{background:rgba(255,255,255,.06)}
.nav-item.router-link-active{background:rgba(91,141,239,.16);box-shadow:inset 3px 0 0 #5b8def}
.nav-dot{width:8px;height:8px;border-radius:3px;flex-shrink:0}
.nav-badge{margin-left:auto;font-size:11px;font-weight:600;background:#c0392b;color:#fff;padding:1px 7px;border-radius:999px}
.ai-card{margin-top:auto;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:13px}
.ai-card-head{display:flex;align-items:center;gap:8px;font-size:11px;color:#8aa0c0;font-weight:600}
.ai-live-dot{width:7px;height:7px;border-radius:50%;background:#3fae7a;animation:livedot 1.8s infinite;flex-shrink:0}
.ai-card-body{font-size:11.5px;color:#aab8d0;margin-top:7px;line-height:1.5}
.sidebar-user{padding:12px 16px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:11px}
.user-av{width:36px;height:36px;border-radius:50%;background:#1d3a66;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;color:#cfe0ff;flex-shrink:0}
.user-name{font-size:13px;font-weight:600;color:#fff}.user-sub{font-size:11px;color:#8aa0c0}
.user-online{width:8px;height:8px;border-radius:50%;background:#3fae7a;margin-left:auto;flex-shrink:0}
.main-col{flex:1;display:flex;flex-direction:column;min-width:0}
.topbar{height:62px;flex-shrink:0;background:#fff;border-bottom:1px solid #e0e5ee;display:flex;align-items:center;padding:0 22px;gap:18px}
.page-title{font-size:16px;font-weight:700;color:#15233a}.page-sub{font-size:12px;color:#7a8699;margin-top:1px}
.search-wrap{display:flex;align-items:center;gap:9px;background:#f1f4f9;border:1px solid #e3e8f0;border-radius:10px;padding:8px 13px;width:260px}
.search-icon{width:14px;height:14px;border:2px solid #9aa6b6;border-radius:50%;flex-shrink:0}
.search-inp{border:none;background:transparent;outline:none;font-size:13px;color:#1a2433;width:100%}
.wa-badge{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:9px;text-decoration:none}
.wa-badge.ready{color:#1f8a5b;background:#eaf6ef;border:1px solid #cdeada}
.wa-badge.qr{color:#b9751a;background:#fbf1e0;border:1px solid #f5d9a0}
.wa-badge.connecting{color:#5a6b82;background:#eef1f6;border:1px solid #e0e5ee}
.wa-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.main-content{flex:1;min-height:0;overflow:hidden}
</style>
