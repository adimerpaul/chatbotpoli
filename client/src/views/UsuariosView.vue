<template>
  <div class="usr-view">
    <div class="usr-content">
      <div class="header-row">
        <div>
          <div class="page-h">Gestión de Usuarios</div>
          <div class="page-s">Administra las cuentas y permisos del panel</div>
        </div>
        <button class="btn-new" @click="openNew">+ Nuevo usuario</button>
      </div>

      <div v-if="loading" class="loading">Cargando usuarios...</div>

      <div v-else class="user-list">
        <div v-for="u in users" :key="u.id" class="user-card">
          <div class="uav">{{ initials(u) }}</div>
          <div class="uinfo">
            <div class="uname-row">
              <span class="uname">{{ u.nombre || u.username }}</span>
              <span class="badge-act" :class="u.activo ? 'on' : 'off'">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
            </div>
            <div class="umeta">@{{ u.username }}<span v-if="u.email"> · {{ u.email }}</span></div>
            <div class="perm-list">
              <span v-if="!u.permisos?.length" class="no-perm">Sin permisos</span>
              <span v-for="p in u.permisos" :key="p" class="perm-tag">{{ PERM_LABELS[p] || p }}</span>
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

    <!-- Modal -->
    <div v-if="modal" class="overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <span>{{ editing ? `Editar usuario: @${editing.username}` : 'Nuevo usuario' }}</span>
          <button class="modal-close" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <div class="mfield">
            <label>Usuario</label>
            <input v-model="form.username" :disabled="!!editing" placeholder="nombre_usuario" :class="{disabled: !!editing}" />
          </div>
          <div class="mfield">
            <label>Nombre completo</label>
            <input v-model="form.nombre" placeholder="Nombre y apellido" />
          </div>
          <div class="mfield">
            <label>Email</label>
            <input v-model="form.email" type="email" placeholder="correo@ejemplo.com" />
          </div>
          <div class="mfield">
            <label>{{ editing ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña' }}</label>
            <div class="pass-wrap">
              <input v-model="form.password" :type="showPass ? 'text' : 'password'" placeholder="••••••••" class="pass-inp" />
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
          <div v-if="editing" class="mfield mcheck">
            <label class="check-label">
              <input v-model="form.activo" type="checkbox" />
              <span>Usuario activo</span>
            </label>
          </div>
          <div class="mfield">
            <label>Permisos</label>
            <div class="perm-checks">
              <label v-for="p in allPermisos" :key="p" class="pcheck">
                <input v-model="form.permisos" type="checkbox" :value="p" />
                <span>{{ PERM_LABELS[p] || p }}</span>
              </label>
            </div>
          </div>
          <div v-if="formError" class="form-err">{{ formError }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn-save" @click="save" :disabled="saving">
            {{ saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear usuario') }}
          </button>
          <button class="btn-cancel" @click="closeModal">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { apiFetch } from '@/lib/api'

const PERM_LABELS = {
  ver_conversaciones:      'Ver conversaciones',
  enviar_mensajes:         'Enviar mensajes',
  tomar_casos:             'Tomar casos',
  cambiar_estado:          'Cambiar estado/agente',
  eliminar_conversaciones: 'Eliminar conversaciones',
  gestionar_usuarios:      'Gestionar usuarios',
  gestionar_bot:           'Configurar bot/WA'
}

const users = ref([])
const allPermisos = ref([])
const loading = ref(true)
const modal = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({ username: '', nombre: '', email: '', password: '', activo: true, permisos: [] })
const showPass = ref(false)

function initials(u) { return (u.nombre || u.username || '?').slice(0, 2).toUpperCase() }

async function load() {
  loading.value = true
  try {
    const data = await apiFetch('/api/auth/users').then(r => r.json())
    users.value = data.users || []
    allPermisos.value = data.allPermisos || []
  } finally {
    loading.value = false
  }
}

function openNew() {
  editing.value = null
  Object.assign(form, { username: '', nombre: '', email: '', password: '', activo: true, permisos: [] })
  formError.value = ''
  showPass.value = false
  modal.value = true
}

function openEdit(u) {
  editing.value = u
  Object.assign(form, { username: u.username, nombre: u.nombre || '', email: u.email || '', password: '', activo: u.activo, permisos: [...(u.permisos || [])] })
  formError.value = ''
  showPass.value = false
  modal.value = true
}

function closeModal() { modal.value = false }

async function save() {
  formError.value = ''
  if (!editing.value && !form.username.trim()) { formError.value = 'El usuario es requerido'; return }
  if (!editing.value && !form.password) { formError.value = 'La contraseña es requerida'; return }

  saving.value = true
  try {
    const url = editing.value ? `/api/auth/users/${editing.value.id}` : '/api/auth/users'
    const method = editing.value ? 'PUT' : 'POST'
    const body = editing.value
      ? { nombre: form.nombre, email: form.email || null, permisos: form.permisos, activo: form.activo, ...(form.password ? { password: form.password } : {}) }
      : { username: form.username.trim(), password: form.password, nombre: form.nombre, email: form.email || null, permisos: form.permisos }

    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    if (res.error) { formError.value = res.error; return }
    modal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function deleteUser(u) {
  if (!confirm(`¿Eliminar el usuario @${u.username}? Esta acción no se puede deshacer.`)) return
  const res = await apiFetch(`/api/auth/users/${u.id}`, { method: 'DELETE' }).then(r => r.json())
  if (res.error) { alert(res.error); return }
  await load()
}

onMounted(load)
</script>

<style scoped>
.usr-view{height:100%;overflow:auto;padding:28px 32px;background:#eef1f6}
.usr-content{max-width:860px;margin:0 auto}
.header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.page-h{font-size:18px;font-weight:700;color:#15233a}
.page-s{font-size:12.5px;color:#7a8699;margin-top:3px}
.btn-new{background:#0a1f3c;color:#fff;border:none;font-size:13.5px;font-weight:600;padding:10px 20px;border-radius:10px;cursor:pointer}
.btn-new:hover{background:#132d55}
.loading{text-align:center;color:#9aa6b6;padding:40px;font-size:14px}
.user-list{display:flex;flex-direction:column;gap:12px}
.user-card{background:#fff;border:1px solid #e6ebf2;border-radius:12px;padding:18px;display:flex;gap:16px;align-items:flex-start}
.uav{width:42px;height:42px;border-radius:50%;background:#e7f0ff;color:#2f6fed;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0}
.uinfo{flex:1;min-width:0}
.uname-row{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.uname{font-size:14px;font-weight:700;color:#15233a}
.badge-act{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px}
.badge-act.on{background:#e6f5ee;color:#1f8a5b}
.badge-act.off{background:#eef1f6;color:#7a8699}
.umeta{font-size:12px;color:#7a8699;font-family:'IBM Plex Mono',monospace;margin-bottom:10px}
.perm-list{display:flex;flex-wrap:wrap;gap:5px}
.no-perm{font-size:11.5px;color:#9aa6b6}
.perm-tag{background:#e7f0ff;color:#2f6fed;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.uactions{display:flex;gap:7px;flex-shrink:0}
.btn-edit{border:1px solid #e3e8f0;background:#f7f9fc;color:#5a6b82;font-size:12px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer}
.btn-del{border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-size:12px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer}
.empty{text-align:center;color:#9aa6b6;padding:40px;font-size:14px}

.overlay{position:fixed;inset:0;background:rgba(10,31,60,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#fff;border-radius:16px;width:100%;max-width:500px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.3)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:22px 24px 0;font-size:17px;font-weight:700;color:#0a1f3c;flex-shrink:0}
.modal-close{border:none;background:none;font-size:24px;color:#9aa6b6;cursor:pointer;line-height:1;padding:0}
.modal-body{padding:20px 24px;overflow:auto;flex:1}
.modal-footer{padding:16px 24px;border-top:1px solid #eef1f6;display:flex;gap:10px;flex-shrink:0}
.mfield{margin-bottom:18px}
label{display:block;font-size:11.5px;font-weight:600;color:#5a6b82;margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px}
input[type=text],input[type=email],input[type=password]{width:100%;padding:10px 13px;border:1.5px solid #dce3ed;border-radius:8px;font-size:13.5px;font-family:inherit;outline:none;background:#fafbfd}
input:focus{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.1);background:#fff}
input.disabled{background:#f5f7fa;color:#7a8699;cursor:not-allowed}
.mcheck{margin-top:-6px}
.check-label{display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;color:#33405a;font-weight:500;text-transform:none;letter-spacing:0}
.check-label input{width:15px;height:15px}
.perm-checks{display:flex;flex-direction:column;gap:7px}
.pcheck{display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid #e3e8f0;border-radius:8px;cursor:pointer;background:#fafbfd}
.pcheck input{width:15px;height:15px;cursor:pointer}
.pcheck span{font-size:13px;color:#33405a}
.form-err{color:#c0392b;font-size:13px;margin-top:6px;padding:10px 12px;background:#fbe9e7;border-radius:8px}
.btn-save{flex:1;background:#0a1f3c;color:#fff;border:none;font-size:14px;font-weight:600;padding:12px;border-radius:9px;cursor:pointer;font-family:inherit}
.btn-save:disabled{background:#9aabb8;cursor:not-allowed}
.btn-cancel{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:14px;font-weight:500;padding:12px 18px;border-radius:9px;cursor:pointer;font-family:inherit}
.pass-wrap{position:relative;display:flex;align-items:center}
.pass-inp{width:100%;padding-right:42px}
.eye-btn{position:absolute;right:12px;background:none;border:none;cursor:pointer;color:#9aa6b6;padding:0;display:flex;align-items:center}
.eye-btn:hover{color:#3d5068}
.eye-btn svg{width:18px;height:18px}
</style>
