<template>
  <!-- En la página de login sólo mostrar el RouterView -->
  <RouterView v-if="route.name === 'login'" />

  <!-- Layout principal del panel -->
  <div v-else class="app-shell">
    <!-- Overlay oscuro (solo móvil, cuando sidebar está abierto) -->
    <div v-if="mobileOpen" class="sidebar-backdrop" @click="mobileOpen=false"></div>

    <aside class="sidebar" :class="{ 'mob-open': mobileOpen, 'desk-collapsed': desktopCollapsed }">
      <div class="sidebar-brand">
        <div class="brand-logo">PB</div>
        <div class="brand-text">
          <div class="brand-name">Policía Boliviana</div>
          <div class="brand-sub">Comando Oruro · CAC</div>
        </div>
        <button class="sidebar-close-btn" @click="mobileOpen=false" title="Cerrar menú">✕</button>
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
        <template v-if="auth.hasPerm('gestionar_usuarios') || auth.hasPerm('gestionar_conocimiento') || auth.hasPerm('ver_reportes')">
          <div class="nav-label" style="margin-top:10px">ADMINISTRACIÓN</div>
          <RouterLink v-if="auth.hasPerm('gestionar_usuarios')" to="/usuarios" class="nav-item">
            <span class="nav-dot" style="background:#e87d3e"></span>
            Gestionar usuarios
          </RouterLink>
          <RouterLink v-if="auth.hasPerm('gestionar_conocimiento')" to="/conocimiento" class="nav-item">
            <span class="nav-dot" style="background:#9b59b6"></span>
            Base de Conocimiento IA
          </RouterLink>
          <RouterLink v-if="auth.hasPerm('ver_reportes')" to="/reportes" class="nav-item">
            <span class="nav-dot" style="background:#16a085"></span>
            Reportes
          </RouterLink>
        </template>
        <div class="ai-card">
          <div class="ai-card-head"><span class="ai-live-dot"></span>ASISTENTE IA ACTIVO</div>
          <div class="ai-card-body">Clasificando mensajes entrantes y resumiendo en tiempo real.</div>
        </div>
      </nav>
      <div class="sidebar-user">
        <div class="user-av">{{ userInitials }}</div>
        <div class="user-info">
          <div class="user-name">{{ auth.user?.nombre || auth.user?.username || 'Usuario' }}</div>
          <div class="user-sub">{{ auth.hasPerm('gestionar_usuarios') ? 'Administrador' : 'Operador' }}</div>
        </div>
        <button class="logout-btn" title="Cerrar sesión" @click="logout">↩</button>
      </div>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <!-- Botón toggle del menú (siempre visible) -->
        <button class="menu-toggle-btn" @click="toggleSidebar" :title="desktopCollapsed || !mobileOpen ? 'Mostrar menú' : 'Ocultar menú'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div class="topbar-title">
          <div class="page-title">{{ pageTitle }}</div>
          <div class="page-sub">{{ pageSub }}</div>
        </div>
        <div style="flex:1"></div>
        <div class="search-wrap">
          <span class="search-icon"></span>
          <input v-model="convStore.search" placeholder="Buscar folio, ciudadano o delito…" class="search-inp" />
        </div>
        <RouterLink to="/whatsapp" class="wa-badge" :class="wa.status">
          <span class="wa-dot"></span>
          <span class="wa-badge-txt">{{ wa.status==='ready'?'WhatsApp activo': wa.status==='qr'?'📱 Escanea QR':'WA conectando...' }}</span>
        </RouterLink>
      </header>
      <main class="main-content"><RouterView /></main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import { useWhatsappStore } from '@/stores/whatsapp'
import { useAuthStore } from '@/stores/auth'
import { useSocket } from '@/composables/useSocket'
import { apiFetch } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const convStore = useConversationsStore()
const wa = useWhatsappStore()
const auth = useAuthStore()
if (auth.isLoggedIn) useSocket()

// Desktop: sidebar colapsa (ancho → 0). Empieza expandido.
const desktopCollapsed = ref(false)
// Móvil: sidebar se desliza desde la izquierda. Empieza cerrado.
const mobileOpen = ref(false)

function toggleSidebar() {
  if (window.innerWidth <= 767) {
    mobileOpen.value = !mobileOpen.value
  } else {
    desktopCollapsed.value = !desktopCollapsed.value
  }
}

// Cerrar sidebar móvil al cambiar de ruta
watch(() => route.path, () => { mobileOpen.value = false })

const newCount = computed(() => convStore.convs.filter(c => c.unread).length || null)
const waDot = computed(() => wa.status==='ready'?'#3fae7a':wa.status==='qr'?'#d6a23a':'#64769a')
const userInitials = computed(() => {
  const name = auth.user?.nombre || auth.user?.username || '?'
  return name.slice(0, 2).toUpperCase()
})

const META = {
  '/bandeja':  ['Bandeja de atención','Conversaciones entrantes del chatbot ciudadano'],
  '/mapa':     ['Mapa de incidentes','Distribución geográfica de casos en Oruro'],
  '/stats':    ['Estadísticas','Indicadores de gestión del centro de atención'],
  '/whatsapp': ['Conectar celular de WhatsApp','Vincula el número de WhatsApp del canal ciudadano'],
  '/usuarios':     ['Gestión de Usuarios','Administración de cuentas y permisos del panel'],
  '/conocimiento': ['Base de Conocimiento IA','Preguntas y respuestas que el asistente IA usará para atender al ciudadano'],
  '/reportes':     ['Reportes','Busca, filtra y exporta casos en Excel o PDF']
}
const pageTitle = computed(() => (META[route.path]||META['/bandeja'])[0])
const pageSub   = computed(() => (META[route.path]||META['/bandeja'])[1])

function logout() {
  auth.logout()
  router.replace('/login')
}

onMounted(async () => {
  if (!auth.isLoggedIn) return

  // Refrescar permisos desde la BD (el JWT puede estar desactualizado)
  const me = await apiFetch('/api/auth/me').then(r=>r.json()).catch(()=>null)
  if (me?.user) auth.setAuth(auth.token, me.user)

  const s = await apiFetch('/api/status').then(r=>r.json()).catch(()=>({}))
  if (s.status==='ready') wa.setReady(s.phone)
  else if (s.status==='qr' && s.qrDataUrl) wa.setQR(s.qrDataUrl)
  const list = await apiFetch('/api/conversations').then(r=>r.json()).catch(()=>[])
  convStore.setAll(Array.isArray(list) ? list : [])
})
</script>

<style scoped>
/* Shell wrapper */
.app-shell { height: 100vh; display: flex; overflow: hidden; background: #eef1f6; color: #1a2433; position: relative; }

/* Sidebar — Desktop: colapsa por ancho. Móvil: slide desde la izquierda. */
.sidebar { width: 252px; flex-shrink: 0; overflow: hidden; background: linear-gradient(180deg,#0b2545,#0a1f3c); color: #dbe4f3; display: flex; flex-direction: column; transition: width .25s ease; z-index: 1000; }
/* Desktop: toggle oculta colapsando el ancho */
.sidebar.desk-collapsed { width: 0; }
.sidebar-brand { padding: 16px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,.08); min-height: 62px; }
.brand-logo { width: 42px; height: 42px; border-radius: 11px; background: linear-gradient(135deg,#2f6fed,#5b8def); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: #fff; box-shadow: 0 4px 14px rgba(47,111,237,.4); flex-shrink: 0; }
.brand-text { flex: 1; min-width: 0; }
.brand-name { font-weight: 700; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.brand-sub { font-size: 11px; color: #8aa0c0; margin-top: 2px; }
.sidebar-close-btn { display: none; border: none; background: rgba(255,255,255,.1); color: #8aa0c0; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; flex-shrink: 0; transition: background .15s; }
.sidebar-close-btn:hover { background: rgba(255,255,255,.2); color: #fff; }
.sidebar-nav { padding: 14px 12px; flex: 1; display: flex; flex-direction: column; gap: 2px; overflow: auto; }
.nav-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; color: #64769a; padding: 6px 12px 8px; }
.nav-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 11px 12px; border-radius: 9px; font-size: 13.5px; font-weight: 500; color: #dbe4f3; text-decoration: none; }
.nav-item:hover { background: rgba(255,255,255,.06); }
.nav-item.router-link-active { background: rgba(91,141,239,.16); box-shadow: inset 3px 0 0 #5b8def; }
.nav-dot { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
.nav-badge { margin-left: auto; font-size: 11px; font-weight: 600; background: #c0392b; color: #fff; padding: 1px 7px; border-radius: 999px; }
.ai-card { margin-top: auto; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 13px; }
.ai-card-head { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #8aa0c0; font-weight: 600; }
.ai-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #3fae7a; animation: livedot 1.8s infinite; flex-shrink: 0; }
.ai-card-body { font-size: 11.5px; color: #aab8d0; margin-top: 7px; line-height: 1.5; }
.sidebar-user { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; gap: 11px; flex-shrink: 0; }
.user-av { width: 36px; height: 36px; border-radius: 50%; background: #1d3a66; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; color: #cfe0ff; flex-shrink: 0; }
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-sub { font-size: 11px; color: #8aa0c0; }
.logout-btn { border: none; background: rgba(255,255,255,.08); color: #8aa0c0; border-radius: 7px; width: 30px; height: 30px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s; }
.logout-btn:hover { background: rgba(255,255,255,.16); color: #fff; }

/* Main column */
.main-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { height: 62px; flex-shrink: 0; background: #fff; border-bottom: 1px solid #e0e5ee; display: flex; align-items: center; padding: 0 18px; gap: 14px; }
.menu-toggle-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid #e3e8f0; border-radius: 9px; background: #f1f4f9; color: #5a6b82; cursor: pointer; flex-shrink: 0; transition: background .15s, color .15s; }
.menu-toggle-btn:hover { background: #e3e8f0; color: #15233a; }
.topbar-title { min-width: 0; }
.page-title { font-size: 16px; font-weight: 700; color: #15233a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.page-sub { font-size: 12px; color: #7a8699; margin-top: 1px; }
.search-wrap { display: flex; align-items: center; gap: 9px; background: #f1f4f9; border: 1px solid #e3e8f0; border-radius: 10px; padding: 8px 13px; width: 260px; flex-shrink: 0; }
.search-icon { width: 14px; height: 14px; border: 2px solid #9aa6b6; border-radius: 50%; flex-shrink: 0; }
.search-inp { border: none; background: transparent; outline: none; font-size: 13px; color: #1a2433; width: 100%; }
.wa-badge { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; padding: 6px 11px; border-radius: 9px; text-decoration: none; flex-shrink: 0; }
.wa-badge.ready { color: #1f8a5b; background: #eaf6ef; border: 1px solid #cdeada; }
.wa-badge.qr { color: #b9751a; background: #fbf1e0; border: 1px solid #f5d9a0; }
.wa-badge.connecting { color: #5a6b82; background: #eef1f6; border: 1px solid #e0e5ee; }
.wa-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.main-content { flex: 1; min-height: 0; overflow: hidden; }

/* Backdrop — solo se muestra en móvil (v-if=mobileOpen) */
.sidebar-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 999; }

@keyframes livedot { 0%,100% { opacity: 1 } 50% { opacity: .3 } }

/* ── Tablet (768–1150px) ─────────────────────────────── */
@media (min-width: 768px) and (max-width: 1150px) {
  .sidebar { width: 200px; }
  .sidebar.desk-collapsed { width: 0; }
  .brand-sub { display: none; }
  .search-wrap { width: 180px; }
  .wa-badge-txt { display: none; }
}

/* ── Móvil (< 768px) ─────────────────────────────────── */
@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: 272px !important;   /* anular desk-collapsed en móvil */
    overflow: auto !important;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform .28s ease;
  }
  .sidebar.mob-open { transform: translateX(0); }
  .sidebar-close-btn { display: flex; align-items: center; justify-content: center; }
  .topbar { padding: 0 12px; gap: 10px; }
  .search-wrap { display: none; }
  .page-sub { display: none; }
  .wa-badge-txt { display: none; }
  .page-title { font-size: 14px; }
}
</style>
