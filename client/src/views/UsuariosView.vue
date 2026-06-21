<template>
  <div class="usr-view">
    <div class="usr-content">

      <div class="header-row">
        <div>
          <div class="page-h">Gestión de Usuarios</div>
          <div class="page-s">Administra las cuentas y permisos del panel operativo</div>
        </div>
        <button class="btn-new" @click="openNew">+ Nuevo usuario</button>
      </div>

      <div v-if="loading" class="loading">Cargando usuarios…</div>

      <div v-else class="user-list">
        <div v-for="u in users" :key="u.id" class="user-card">
          <!-- Avatar -->
          <div class="uav" :style="{background: avatarBg(u)}">{{ initials(u) }}</div>

          <div class="uinfo">
            <div class="uname-row">
              <span class="uname">{{ u.nombre || u.username }}</span>
              <span class="ubadge-user">@{{ u.username }}</span>
              <span class="badge-act" :class="u.activo ? 'on' : 'off'">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
            </div>
            <div class="umeta">
              <span v-if="u.email">✉ {{ u.email }}</span>
              <span v-if="u.celular">📱 {{ u.celular }}</span>
            </div>
            <div class="perm-list">
              <span v-if="!u.permisos?.length" class="no-perm">Sin permisos asignados</span>
              <span v-for="p in u.permisos" :key="p" class="perm-tag" :class="permGroup(p)">
                {{ PERM_LABELS[p] || p }}
              </span>
            </div>
          </div>

          <div class="uactions">
            <button class="btn-edit" @click="openEdit(u)">Editar</button>
            <button class="btn-del" @click="deleteUser(u)">Eliminar</button>
          </div>
        </div>
        <div v-if="!users.length" class="empty">No hay usuarios registrados</div>
      </div>
    </div>

    <!-- ── Modal ───────────────────────────────────────────────── -->
    <div v-if="modal" class="overlay" @click.self="closeModal">
      <div class="modal">

        <!-- Header -->
        <div class="modal-header">
          <div class="mh-left">
            <div class="mh-av" :style="{background: editing ? avatarBg(editing) : '#2f6fed'}">
              {{ editing ? initials(editing) : '+' }}
            </div>
            <div>
              <div class="mh-title">{{ editing ? 'Editar usuario' : 'Nuevo usuario' }}</div>
              <div class="mh-sub">{{ editing ? `@${editing.username}` : 'Completa los datos del nuevo operador' }}</div>
            </div>
          </div>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-body">

          <!-- Sección: datos básicos -->
          <div class="msection">
            <div class="msec-title">Datos personales</div>
            <div class="mfields-grid">
              <div class="mfield" v-if="!editing">
                <label>Usuario <span class="req">*</span></label>
                <input v-model="form.username" placeholder="nombre_usuario" class="minp" />
              </div>
              <div class="mfield">
                <label>Nombre completo</label>
                <input v-model="form.nombre" placeholder="Ej: Sgto. Juan Flores" class="minp" />
              </div>
              <div class="mfield">
                <label>Correo electrónico</label>
                <input v-model="form.email" type="email" placeholder="correo@policía.bo" class="minp" />
              </div>
              <div class="mfield">
                <label>Celular</label>
                <input v-model="form.celular" type="tel" placeholder="72345678" class="minp" />
              </div>
              <div class="mfield" :class="editing ? '' : 'span2'">
                <label>{{ editing ? 'Nueva contraseña' : 'Contraseña' }} <span class="req" v-if="!editing">*</span></label>
                <div class="pass-wrap">
                  <input v-model="form.password" :type="showPass ? 'text' : 'password'"
                    :placeholder="editing ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'" class="minp pass-inp" />
                  <button type="button" class="eye-btn" @click="showPass = !showPass" tabindex="-1">
                    <svg v-if="!showPass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
              </div>
              <div class="mfield span2" v-if="editing">
                <label class="toggle-label">
                  <span>Estado de la cuenta</span>
                  <button class="activo-toggle" :class="form.activo ? 'on' : 'off'" @click="form.activo = !form.activo">
                    <span class="tog-dot"></span>
                    <span class="tog-txt">{{ form.activo ? 'Activo' : 'Inactivo' }}</span>
                  </button>
                </label>
              </div>
            </div>
          </div>

          <!-- Sección: permisos -->
          <div class="msection">
            <div class="msec-title">Permisos de acceso</div>
            <div v-for="grupo in permGroups" :key="grupo.label" class="perm-group">
              <div class="pgroup-label">{{ grupo.label }}</div>
              <div class="perm-grid">
                <label v-for="p in grupo.perms.filter(p => allPermisos.includes(p))" :key="p"
                  class="perm-card" :class="{ checked: form.permisos.includes(p) }"
                  @click="togglePerm(p)">
                  <div class="pcard-icon">{{ PERM_ICONS[p] }}</div>
                  <div class="pcard-info">
                    <div class="pcard-name">{{ PERM_LABELS[p] }}</div>
                    <div class="pcard-desc">{{ PERM_DESC[p] }}</div>
                  </div>
                  <div class="pcard-check" :class="{ on: form.permisos.includes(p) }">
                    <svg v-if="form.permisos.includes(p)" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <polyline points="1.5,6 4.5,9 10.5,3"/>
                    </svg>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div v-if="formError" class="form-err">{{ formError }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="closeModal">Cancelar</button>
          <button class="btn-save" @click="save" :disabled="saving">
            {{ saving ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear usuario') }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { apiFetch } from '@/lib/api'

// ── Labels, iconos y descripciones de permisos ────────────────
const PERM_LABELS = {
  ver_conversaciones:      'Ver conversaciones',
  enviar_mensajes:         'Enviar mensajes',
  tomar_casos:             'Tomar casos',
  cambiar_estado:          'Cambiar estado',
  eliminar_conversaciones: 'Eliminar casos',
  gestionar_usuarios:      'Gestionar usuarios',
  gestionar_bot:           'Configurar bot/WA',
  gestionar_conocimiento:  'Base de Conocimiento IA',
  ver_reportes:            'Ver reportes'
}

const PERM_ICONS = {
  ver_conversaciones:      '👁',
  enviar_mensajes:         '💬',
  tomar_casos:             '🤝',
  cambiar_estado:          '🔄',
  eliminar_conversaciones: '🗑',
  gestionar_usuarios:      '👥',
  gestionar_bot:           '🤖',
  gestionar_conocimiento:  '📚',
  ver_reportes:            '📊'
}

const PERM_DESC = {
  ver_conversaciones:      'Leer el historial de chats',
  enviar_mensajes:         'Escribir al ciudadano como operador',
  tomar_casos:             'Asignarse conversaciones',
  cambiar_estado:          'Modificar estado, prioridad y tipo',
  eliminar_conversaciones: 'Archivar o eliminar casos',
  gestionar_usuarios:      'Crear, editar y borrar operadores',
  gestionar_bot:           'Activar/desactivar el bot y reconectar WA',
  gestionar_conocimiento:  'Editar preguntas y respuestas del bot',
  ver_reportes:            'Exportar reportes en Excel y PDF'
}

const permGroups = [
  { label: 'OPERACIÓN',       perms: ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado','eliminar_conversaciones'] },
  { label: 'ADMINISTRACIÓN',  perms: ['gestionar_usuarios','gestionar_bot','gestionar_conocimiento','ver_reportes'] }
]

// Grupo para el color del tag en la tarjeta
function permGroup(p) {
  return ['gestionar_usuarios','gestionar_bot','gestionar_conocimiento','ver_reportes'].includes(p) ? 'admin' : 'op'
}

// Colores de avatar según inicial
const COLORS = ['#2f6fed','#c0392b','#1f8a5b','#b9751a','#8e44ad','#16a085','#2980b9']
function avatarBg(u) { const s = (u.nombre || u.username || '?'); return COLORS[s.charCodeAt(0) % COLORS.length] }
function initials(u) { return (u.nombre || u.username || '?').slice(0, 2).toUpperCase() }

// ── Estado ────────────────────────────────────────────────────
const users      = ref([])
const allPermisos = ref([])
const loading    = ref(true)
const modal      = ref(false)
const editing    = ref(null)
const saving     = ref(false)
const formError  = ref('')
const showPass   = ref(false)
const form = reactive({ username: '', nombre: '', email: '', celular: '', password: '', activo: true, permisos: [] })

function togglePerm(p) {
  const idx = form.permisos.indexOf(p)
  if (idx >= 0) form.permisos.splice(idx, 1)
  else form.permisos.push(p)
}

async function load() {
  loading.value = true
  try {
    const data = await apiFetch('/api/auth/users').then(r => r.json())
    users.value      = data.users || []
    allPermisos.value = data.allPermisos || []
  } finally {
    loading.value = false
  }
}

function openNew() {
  editing.value = null
  Object.assign(form, { username: '', nombre: '', email: '', celular: '', password: '', activo: true, permisos: [] })
  formError.value = ''; showPass.value = false; modal.value = true
}

function openEdit(u) {
  editing.value = u
  Object.assign(form, { username: u.username, nombre: u.nombre||'', email: u.email||'', celular: u.celular||'', password: '', activo: u.activo, permisos: [...(u.permisos||[])] })
  formError.value = ''; showPass.value = false; modal.value = true
}

function closeModal() { modal.value = false }

async function save() {
  formError.value = ''
  if (!editing.value && !form.username.trim()) { formError.value = 'El usuario es requerido'; return }
  if (!editing.value && !form.password)        { formError.value = 'La contraseña es requerida'; return }
  saving.value = true
  try {
    const url    = editing.value ? `/api/auth/users/${editing.value.id}` : '/api/auth/users'
    const method = editing.value ? 'PUT' : 'POST'
    const body   = editing.value
      ? { nombre: form.nombre, email: form.email||null, celular: form.celular||null, permisos: form.permisos, activo: form.activo, ...(form.password ? { password: form.password } : {}) }
      : { username: form.username.trim(), password: form.password, nombre: form.nombre, email: form.email||null, celular: form.celular||null, permisos: form.permisos }
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    if (res.error) { formError.value = res.error; return }
    modal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function deleteUser(u) {
  if (!confirm(`¿Eliminar el usuario @${u.username}?\nEsta acción no se puede deshacer.`)) return
  const res = await apiFetch(`/api/auth/users/${u.id}`, { method: 'DELETE' }).then(r => r.json())
  if (res.error) { alert(res.error); return }
  await load()
}

onMounted(load)
</script>

<style scoped>
.usr-view{height:100%;overflow:auto;padding:28px 32px;background:#eef1f6}
.usr-content{max-width:920px;margin:0 auto}
.header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;gap:16px;flex-wrap:wrap}
.page-h{font-size:18px;font-weight:700;color:#15233a}
.page-s{font-size:12.5px;color:#7a8699;margin-top:3px}
.btn-new{background:#0a1f3c;color:#fff;border:none;font-size:13.5px;font-weight:600;padding:10px 20px;border-radius:10px;cursor:pointer;white-space:nowrap}
.btn-new:hover{background:#132d55}
.loading{text-align:center;color:#9aa6b6;padding:40px;font-size:14px}

/* Cards de usuario */
.user-list{display:flex;flex-direction:column;gap:11px}
.user-card{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:18px 20px;display:flex;gap:16px;align-items:flex-start;transition:box-shadow .15s}
.user-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.06)}
.uav{width:44px;height:44px;border-radius:12px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
.uinfo{flex:1;min-width:0}
.uname-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap}
.uname{font-size:14.5px;font-weight:700;color:#15233a}
.ubadge-user{font-size:11px;font-family:'IBM Plex Mono',monospace;color:#7a8699;background:#f1f4f9;padding:2px 7px;border-radius:5px}
.badge-act{font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px}
.badge-act.on{background:#e6f5ee;color:#1f8a5b}
.badge-act.off{background:#eef1f6;color:#7a8699}
.umeta{font-size:12px;color:#7a8699;margin-bottom:10px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.perm-list{display:flex;flex-wrap:wrap;gap:5px}
.no-perm{font-size:11.5px;color:#b0bac8;font-style:italic}
.perm-tag{font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px}
.perm-tag.op{background:#eef3ff;color:#2f6fed}
.perm-tag.admin{background:#fef3dc;color:#b9751a}
.uactions{display:flex;gap:7px;flex-shrink:0}
.btn-edit{border:1px solid #e3e8f0;background:#f7f9fc;color:#5a6b82;font-size:12px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:pointer}
.btn-edit:hover{background:#eef1f6}
.btn-del{border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-size:12px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:pointer}
.btn-del:hover{background:#fde8e6}
.empty{text-align:center;color:#9aa6b6;padding:40px;font-size:14px}

/* ── Modal ── */
.overlay{position:fixed;inset:0;background:rgba(10,31,60,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:#fff;border-radius:20px;width:100%;max-width:620px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.35);overflow:hidden}

/* Header del modal */
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:linear-gradient(135deg,#0b2545,#0a1f3c);flex-shrink:0}
.mh-left{display:flex;align-items:center;gap:14px}
.mh-av{width:44px;height:44px;border-radius:12px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;flex-shrink:0}
.mh-title{font-size:16px;font-weight:700;color:#fff}
.mh-sub{font-size:12px;color:#8aa0c0;margin-top:2px}
.modal-close{border:none;background:rgba(255,255,255,.1);color:#8aa0c0;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}
.modal-close:hover{background:rgba(255,255,255,.2);color:#fff}

/* Cuerpo */
.modal-body{padding:0 24px 8px;overflow:auto;flex:1}
.msection{padding:18px 0 4px;border-bottom:1px solid #f1f4f9}
.msection:last-child{border-bottom:none}
.msec-title{font-size:10.5px;font-weight:700;color:#9aa6b6;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}

/* Grid de campos */
.mfields-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mfield{display:flex;flex-direction:column;gap:5px}
.mfield.span2{grid-column:1/-1}
label{font-size:11px;font-weight:600;color:#5a6b82;text-transform:uppercase;letter-spacing:.3px}
.req{color:#c0392b}
.minp{padding:9px 12px;border:1.5px solid #dce3ed;border-radius:9px;font-size:13.5px;font-family:inherit;color:#15233a;outline:none;background:#fafbfd;transition:border-color .15s,box-shadow .15s;width:100%;box-sizing:border-box}
.minp:focus{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.1);background:#fff}
.pass-wrap{position:relative;display:flex;align-items:center}
.pass-inp{width:100%;padding-right:42px}
.eye-btn{position:absolute;right:11px;background:none;border:none;cursor:pointer;color:#9aa6b6;padding:0;display:flex;align-items:center;transition:color .15s}
.eye-btn:hover{color:#3d5068}
.eye-btn svg{width:17px;height:17px}

/* Toggle activo */
.toggle-label{display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#33405a;font-weight:500;text-transform:none;letter-spacing:0;cursor:pointer}
.activo-toggle{display:flex;align-items:center;gap:8px;border:none;border-radius:9px;padding:7px 14px;cursor:pointer;font-size:12.5px;font-weight:600;transition:background .2s,color .2s}
.activo-toggle.on{background:#e6f5ee;color:#1f8a5b}
.activo-toggle.off{background:#eef1f6;color:#7a8699}
.tog-dot{width:9px;height:9px;border-radius:50%;background:currentColor;flex-shrink:0}

/* Permisos */
.perm-group{margin-bottom:14px}
.pgroup-label{font-size:10px;font-weight:700;color:#b0bac8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
.perm-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.perm-card{display:flex;align-items:center;gap:11px;padding:11px 13px;border:1.5px solid #e6ebf2;border-radius:11px;cursor:pointer;background:#fafbfd;transition:border-color .15s,background .15s}
.perm-card:hover{border-color:#c5d4f0;background:#f3f7ff}
.perm-card.checked{border-color:#2f6fed;background:#eef3ff}
.pcard-icon{font-size:20px;flex-shrink:0;width:28px;text-align:center}
.pcard-info{flex:1;min-width:0}
.pcard-name{font-size:13px;font-weight:600;color:#15233a}
.pcard-desc{font-size:11px;color:#9aa6b6;margin-top:1px;line-height:1.4}
.pcard-check{width:20px;height:20px;border-radius:6px;border:2px solid #dce3ed;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,border-color .15s}
.pcard-check.on{background:#2f6fed;border-color:#2f6fed}
.pcard-check svg{width:12px;height:12px;color:#fff;stroke:#fff}

/* Footer */
.modal-footer{padding:14px 24px;border-top:1px solid #eef1f6;display:flex;gap:10px;justify-content:flex-end;flex-shrink:0}
.btn-save{background:#0a1f3c;color:#fff;border:none;font-size:13.5px;font-weight:600;padding:11px 24px;border-radius:10px;cursor:pointer;font-family:inherit;transition:background .15s}
.btn-save:hover:not(:disabled){background:#132d55}
.btn-save:disabled{background:#9aabb8;cursor:not-allowed}
.btn-cancel{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:13.5px;font-weight:500;padding:11px 20px;border-radius:10px;cursor:pointer;font-family:inherit}
.btn-cancel:hover{background:#f1f4f9}
.form-err{color:#c0392b;font-size:13px;padding:10px 13px;background:#fbe9e7;border-radius:9px;margin-top:4px}

@media(max-width:767px){
  .usr-view{padding:14px 12px}
  .mfields-grid{grid-template-columns:1fr}
  .perm-grid{grid-template-columns:1fr}
  .user-card{flex-wrap:wrap}
  .uactions{width:100%;justify-content:flex-end}
}
</style>
