<template>
  <div class="login-bg">
    <div class="card">
      <div class="logo">
        <div class="logo-badge">
          <svg viewBox="0 0 24 24" fill="white" width="26" height="26">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l6 2.67V11c0 3.89-2.67 7.52-6 8.93-3.33-1.41-6-5.04-6-8.93V7.67L12 5z"/>
          </svg>
        </div>
        <div class="logo-text">
          <div class="logo-title">Policía Boliviana</div>
          <div class="logo-sub">Centro de Atención Ciudadana · Oruro</div>
        </div>
      </div>

      <h2>Iniciar Sesión</h2>
      <p class="subtitle">Ingresa tus credenciales para acceder al panel operativo</p>

      <div v-if="error" class="alert">{{ error }}</div>

      <form @submit.prevent="login">
        <div class="field">
          <label>Usuario</label>
          <input v-model="username" type="text" placeholder="Ej. admin" autocomplete="username" :class="{err: !!error}" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <div class="pass-wrap">
            <input v-model="password" :type="showPass ? 'text' : 'password'" placeholder="••••••••" autocomplete="current-password" :class="{err: !!error}" class="pass-inp" />
            <button type="button" class="eye-btn" @click="showPass = !showPass" tabindex="-1">
              <svg v-if="!showPass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>
        <button type="submit" class="btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Verificando...' : 'Ingresar al panel' }}
        </button>
      </form>

      <p class="footer">Panel CAC · Policía Oruro &copy; 2026</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSocket } from '@/composables/useSocket'
import { apiFetch } from '@/lib/api'
import { useConversationsStore } from '@/stores/conversations'
import { useWhatsappStore } from '@/stores/whatsapp'

const router = useRouter()
const auth = useAuthStore()
const convStore = useConversationsStore()
const wa = useWhatsappStore()

const username = ref('admin')
const password = ref('admin1234')
const showPass = ref(false)
const loading = ref(false)
const error = ref('')

async function login() {
  if (!username.value.trim() || !password.value) {
    error.value = 'Completa usuario y contraseña'
    return
  }
  error.value = ''
  loading.value = true
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value.trim(), password: password.value })
    }).then(r => r.json())

    if (res.token) {
      auth.setAuth(res.token, res.user)
      useSocket()
      const [s, list] = await Promise.all([
        apiFetch('/api/status').then(r => r.json()).catch(() => ({})),
        apiFetch('/api/conversations').then(r => r.json()).catch(() => [])
      ])
      if (s.status === 'ready') wa.setReady(s.phone)
      else if (s.status === 'qr' && s.qrDataUrl) wa.setQR(s.qrDataUrl)
      convStore.setAll(Array.isArray(list) ? list : [])
      router.replace('/bandeja')
    } else {
      error.value = res.error || 'Error al iniciar sesión'
    }
  } catch {
    error.value = 'Error de conexión con el servidor'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
*{box-sizing:border-box}
.login-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1f3c;padding:20px;font-family:'IBM Plex Sans',system-ui,sans-serif}
.card{background:#fff;border-radius:18px;padding:40px 44px;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,.35)}
.logo{display:flex;align-items:center;gap:14px;margin-bottom:32px}
.logo-badge{width:46px;height:46px;border-radius:12px;background:#0a1f3c;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-title{font-size:17px;font-weight:700;color:#0a1f3c;line-height:1.2}
.logo-sub{font-size:12px;color:#7a8fa8;font-weight:500;margin-top:2px}
h2{font-size:22px;font-weight:700;color:#0a1f3c;margin:0 0 6px}
.subtitle{font-size:13px;color:#7a8fa8;margin:0 0 28px}
.alert{background:#fbe9e7;border:1px solid #f5c6c2;color:#922b21;border-radius:9px;padding:11px 14px;font-size:13px;margin-bottom:20px}
label{display:block;font-size:12px;font-weight:600;color:#3d5068;margin-bottom:6px;letter-spacing:.3px;text-transform:uppercase}
input{width:100%;padding:11px 14px;border:1.5px solid #dce3ed;border-radius:9px;font-size:14px;font-family:inherit;color:#0a1f3c;outline:none;background:#fafbfd;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.12);background:#fff}
input.err{border-color:#c0392b}
.field{margin-bottom:20px}
.pass-wrap{position:relative;display:flex;align-items:center}
.pass-inp{width:100%;padding-right:42px}
.eye-btn{position:absolute;right:12px;background:none;border:none;cursor:pointer;color:#9aa6b6;padding:0;display:flex;align-items:center;transition:color .15s}
.eye-btn:hover{color:#3d5068}
.eye-btn svg{width:18px;height:18px}
.btn{width:100%;padding:13px;background:#0a1f3c;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:8px;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:8px}
.btn:hover:not(:disabled){background:#132d55}
.btn:disabled{background:#9aabb8;cursor:not-allowed}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.footer{margin-top:28px;text-align:center;font-size:12px;color:#aab4be;margin-bottom:0}
</style>
