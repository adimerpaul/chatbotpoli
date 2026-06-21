<template>
  <div class="kb-view">
    <div class="kb-content">

      <!-- Cabecera -->
      <div class="header-row">
        <div>
          <div class="page-h">Base de Conocimiento IA</div>
          <div class="page-s">Preguntas y respuestas que el asistente IA usará para atender al ciudadano</div>
        </div>
        <button class="btn-new" @click="openNew">+ Nueva entrada</button>
      </div>

      <!-- Buscador -->
      <div class="search-bar">
        <svg class="search-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="9" r="6"/><path d="m15 15 3 3"/>
        </svg>
        <input v-model="searchInput" @input="onSearch" placeholder="Buscar por pregunta o respuesta…" class="search-inp" />
        <span v-if="searchInput" class="search-clear" @click="clearSearch">×</span>
      </div>

      <!-- Contador -->
      <div class="meta-row">
        <span class="meta-txt">{{ total }} entrada{{ total !== 1 ? 's' : '' }}</span>
        <span class="meta-txt">Página {{ page }} de {{ pages }}</span>
      </div>

      <!-- Lista -->
      <div v-if="loading && rows.length === 0" class="loading">Cargando...</div>

      <div v-else-if="rows.length === 0" class="empty">
        <div class="empty-ico">📚</div>
        <div>No hay entradas en la base de conocimiento</div>
        <div style="font-size:13px;color:#9aa6b6;margin-top:6px">Agrega preguntas frecuentes para que el asistente IA las use automáticamente</div>
      </div>

      <div v-else class="kb-list">
        <div v-for="item in rows" :key="item.id" class="kb-card" :class="{inactive: !item.activo}">
          <div class="kb-card-body">
            <div class="kb-meta">
              <span class="kb-num">#{{ item.id }}</span>
              <span class="kb-badge" :class="item.activo ? 'on' : 'off'">{{ item.activo ? 'Activo' : 'Inactivo' }}</span>
              <span v-if="item.archivo_url" class="kb-badge has-file" :title="item.archivo_nombre">
                📎 {{ fileLabel(item.archivo_nombre) }}
              </span>
            </div>
            <div class="kb-q"><span class="kb-qlbl">P:</span>{{ item.pregunta }}</div>
            <div class="kb-a">
              <span class="kb-albl">R:</span>
              <span class="kb-atext">{{ item.respuesta }}</span>
            </div>
            <!-- Preview de imagen si existe -->
            <div v-if="item.archivo_url" class="kb-file-preview">
              <img :src="item.archivo_url" class="kfp-img" />
            </div>
          </div>
          <div class="kb-actions">
            <button class="btn-toggle" :class="item.activo ? 'on' : 'off'" @click="toggleActivo(item)" :title="item.activo ? 'Desactivar' : 'Activar'">
              {{ item.activo ? '✓ Activo' : '○ Inactivo' }}
            </button>
            <button class="btn-edit" @click="openEdit(item)">Editar</button>
            <button class="btn-del" @click="deleteItem(item)">Eliminar</button>
          </div>
        </div>
      </div>

      <!-- Paginación -->
      <div v-if="pages > 1" class="pagination">
        <button class="pg-btn" :disabled="page <= 1" @click="goPage(page - 1)">← Anterior</button>
        <div class="pg-nums">
          <button v-for="p in pageRange" :key="p" class="pg-num" :class="{active: p === page}" @click="goPage(p)">{{ p }}</button>
        </div>
        <button class="pg-btn" :disabled="page >= pages" @click="goPage(page + 1)">Siguiente →</button>
      </div>

    </div>

    <!-- Modal crear/editar -->
    <div v-if="modal" class="overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <span>{{ editing ? 'Editar entrada' : 'Nueva entrada' }}</span>
          <button class="modal-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="mfield">
            <label>Pregunta del ciudadano</label>
            <textarea v-model="form.pregunta" placeholder="Ej: ¿Cuáles son los requisitos para hacer una denuncia?" rows="3" class="mta"></textarea>
            <div class="mhint">Escribe la pregunta tal como la haría un ciudadano</div>
          </div>
          <div class="mfield">
            <label>Respuesta que debe dar la IA</label>
            <textarea v-model="form.respuesta" placeholder="Ej: Para hacer una denuncia necesitas…" rows="5" class="mta"></textarea>
            <div class="mhint">Incluye datos concretos: números, direcciones, requisitos exactos</div>
          </div>

          <!-- Sección de imagen adjunta -->
          <div class="mfield">
            <label>Imagen adjunta <span class="lbl-opt">(opcional)</span></label>
            <div class="mhint" style="margin-bottom:9px">Si el ciudadano pregunta sobre este tema, el bot enviará esta imagen por WhatsApp. Se comprime a WebP automáticamente.</div>

            <!-- Imagen actual -->
            <div v-if="editing && editing.archivo_url && !form.newFile" class="file-current">
              <img :src="editing.archivo_url" class="fc-img" />
              <span class="fc-name">{{ editing.archivo_nombre }}</span>
              <button class="btn-rm-file" @click="removeFile" :disabled="removingFile">
                {{ removingFile ? '…' : '✕ Quitar' }}
              </button>
            </div>

            <!-- Zona de upload (siempre visible para reemplazar) -->
            <div class="upload-zone" :class="{dragover}" @dragover.prevent="dragover=true" @dragleave="dragover=false" @drop.prevent="onDrop">
              <input ref="fileInput" type="file" accept=".jpg,.jpeg,.png,.gif,.webp" class="file-input" @change="onFileChange" />
              <div v-if="!form.newFile" class="uz-placeholder" @click="fileInput.click()">
                <span class="uz-ico">🖼</span>
                <span>Arrastra una imagen o <u>haz clic para seleccionar</u></span>
                <span class="uz-hint">JPG, PNG, GIF, WebP — máx 20 MB · se comprime a WebP</span>
              </div>
              <div v-else class="uz-selected">
                <img :src="previewUrl" class="uz-thumb" />
                <span class="uz-fname">{{ form.newFile.name }}</span>
                <button class="btn-rm-selected" @click.stop="clearFile">×</button>
              </div>
            </div>
          </div>

          <div v-if="formError" class="form-err">{{ formError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-save" :disabled="saving" @click="save">
            {{ saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear entrada') }}
          </button>
          <button class="btn-cancel" @click="closeModal">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { apiFetch } from '@/lib/api'

const LIMIT = 8

const rows    = ref([])
const total   = ref(0)
const pages   = ref(1)
const page    = ref(1)
const loading = ref(false)
const searchInput = ref('')
const searchQuery = ref('')
let searchTimer = null

const modal       = ref(false)
const editing     = ref(null)
const saving      = ref(false)
const removingFile = ref(false)
const formError   = ref('')
const form      = ref({ pregunta: '', respuesta: '', newFile: null })
const fileInput  = ref(null)
const dragover   = ref(false)
const previewUrl = ref(null)

watch(() => form.value.newFile, (file) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = file ? URL.createObjectURL(file) : null
})

const pageRange = computed(() => {
  const r = [], start = Math.max(1, page.value - 2), end = Math.min(pages.value, page.value + 2)
  for (let i = start; i <= end; i++) r.push(i)
  return r
})

function fileLabel(name) {
  if (!name) return 'Imagen'
  return name.length > 24 ? name.slice(0, 22) + '…' : name
}

function clearFile() {
  form.value.newFile = null
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e) {
  dragover.value = false
  const file = e.dataTransfer.files[0]
  if (file && /image\//i.test(file.type)) form.value.newFile = file
}
function onFileChange(e) {
  form.value.newFile = e.target.files[0] || null
  if (fileInput.value) fileInput.value.value = ''
}

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    const params = new URLSearchParams({ search: searchQuery.value, page: page.value, limit: LIMIT })
    const data = await apiFetch(`/api/conocimiento?${params}`).then(r => r.json())
    rows.value  = data.rows  || []
    total.value = data.total || 0
    pages.value = data.pages || 1
  } finally {
    loading.value = false
  }
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchQuery.value = searchInput.value; page.value = 1; load() }, 350)
}
function clearSearch() { searchInput.value = ''; searchQuery.value = ''; page.value = 1; load() }
function goPage(p) { page.value = p; load() }

function openNew() {
  editing.value  = null
  form.value     = { pregunta: '', respuesta: '', newFile: null }
  formError.value = ''
  modal.value    = true
}
function openEdit(item) {
  editing.value  = item
  form.value     = { pregunta: item.pregunta, respuesta: item.respuesta, newFile: null }
  formError.value = ''
  modal.value    = true
}
function closeModal() { modal.value = false }

async function save() {
  formError.value = ''
  if (!form.value.pregunta.trim()) { formError.value = 'La pregunta es requerida'; return }
  if (!form.value.respuesta.trim()) { formError.value = 'La respuesta es requerida'; return }
  saving.value = true
  try {
    const url    = editing.value ? `/api/conocimiento/${editing.value.id}` : '/api/conocimiento'
    const method = editing.value ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: form.value.pregunta.trim(), respuesta: form.value.respuesta.trim() })
    }).then(r => r.json())
    if (res.error) { formError.value = res.error; return }

    // Subir imagen si se seleccionó una
    const targetId = editing.value ? editing.value.id : res.id
    let archivoActualizado = null
    if (form.value.newFile && targetId) {
      const fd = new FormData()
      fd.append('archivo', form.value.newFile)
      const uploadRes = await apiFetch(`/api/conocimiento/${targetId}/archivo`, { method: 'POST', body: fd }).then(r => r.json())
      if (uploadRes.ok) archivoActualizado = { archivo_url: uploadRes.archivo_url, archivo_nombre: uploadRes.archivo_nombre }
    }

    modal.value = false

    // Actualizar lista local sin recargar (evita scroll-to-top)
    if (editing.value) {
      const idx = rows.value.findIndex(r => r.id === targetId)
      if (idx >= 0) {
        rows.value[idx] = {
          ...rows.value[idx],
          pregunta: form.value.pregunta.trim(),
          respuesta: form.value.respuesta.trim(),
          ...(archivoActualizado || {})
        }
      }
    } else {
      await load(true)
    }
  } finally {
    saving.value = false
  }
}

// Toggle activo IN-PLACE sin recargar toda la lista ni mover el scroll
async function toggleActivo(item) {
  await apiFetch(`/api/conocimiento/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo: !item.activo })
  })
  // Actualizar solo ese item en el array reactivo
  const idx = rows.value.findIndex(r => r.id === item.id)
  if (idx >= 0) rows.value[idx] = { ...rows.value[idx], activo: !item.activo }
}

// Eliminar sin mover el scroll
async function deleteItem(item) {
  if (!confirm(`¿Eliminar esta entrada?\n\n"${item.pregunta.slice(0, 80)}…"\n\nEsta acción no se puede deshacer.`)) return
  await apiFetch(`/api/conocimiento/${item.id}`, { method: 'DELETE' })
  // Quitar del array local directamente
  rows.value = rows.value.filter(r => r.id !== item.id)
  total.value = Math.max(0, total.value - 1)
  // Si la página quedó vacía y no es la primera, ir a la anterior
  if (rows.value.length === 0 && page.value > 1) { page.value--; await load(true) }
}


async function removeFile() {
  if (!editing.value) return
  removingFile.value = true
  try {
    await apiFetch(`/api/conocimiento/${editing.value.id}/archivo`, { method: 'DELETE' })
    // Actualizar el objeto editing y la lista sin recargar
    editing.value = { ...editing.value, archivo_url: null, archivo_nombre: null }
    const idx = rows.value.findIndex(r => r.id === editing.value.id)
    if (idx >= 0) rows.value[idx] = { ...rows.value[idx], archivo_url: null, archivo_nombre: null }
  } finally {
    removingFile.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.kb-view{height:100%;overflow:auto;padding:28px 32px;background:#eef1f6}
.kb-content{max-width:860px;margin:0 auto}
.header-row{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:16px}
.page-h{font-size:18px;font-weight:700;color:#15233a}
.page-s{font-size:12.5px;color:#7a8699;margin-top:3px;line-height:1.5}
.btn-new{background:#0a1f3c;color:#fff;border:none;font-size:13.5px;font-weight:600;padding:10px 20px;border-radius:10px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.btn-new:hover{background:#132d55}

.search-bar{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #e3e8f0;border-radius:11px;padding:10px 14px;margin-bottom:14px;transition:border-color .15s}
.search-bar:focus-within{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.1)}
.search-ico{width:16px;height:16px;color:#9aa6b6;flex-shrink:0}
.search-inp{flex:1;border:none;outline:none;font-size:13.5px;color:#1a2433;background:transparent;font-family:inherit}
.search-inp::placeholder{color:#b0bac8}
.search-clear{color:#9aa6b6;cursor:pointer;font-size:18px;line-height:1;padding:0 2px}
.search-clear:hover{color:#c0392b}

.meta-row{display:flex;justify-content:space-between;margin-bottom:14px}
.meta-txt{font-size:12px;color:#9aa6b6;font-weight:500}

.loading{text-align:center;color:#9aa6b6;padding:48px;font-size:14px}
.empty{text-align:center;padding:48px 20px;color:#7a8699;font-size:14px}
.empty-ico{font-size:40px;margin-bottom:12px}

.kb-list{display:flex;flex-direction:column;gap:10px}
.kb-card{background:#fff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;transition:opacity .2s}
.kb-card.inactive{opacity:.6}
.kb-card-body{padding:16px 18px}
.kb-meta{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.kb-num{font-size:11px;font-family:'IBM Plex Mono',monospace;color:#9aa6b6;font-weight:600}
.kb-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.kb-badge.on{background:#e6f5ee;color:#1f8a5b}
.kb-badge.off{background:#eef1f6;color:#7a8699}
.kb-badge.has-file{background:#fff3e0;color:#b9751a}
.kb-q{font-size:13.5px;font-weight:600;color:#15233a;line-height:1.5;margin-bottom:8px;display:flex;gap:8px}
.kb-qlbl{color:#2f6fed;font-weight:700;flex-shrink:0}
.kb-a{font-size:13px;color:#5a6b82;line-height:1.6;display:flex;gap:8px;align-items:flex-start}
.kb-albl{color:#1f8a5b;font-weight:700;flex-shrink:0;margin-top:1px}
.kb-atext{flex:1}

/* Preview archivo en tarjeta */
.kb-file-preview{margin-top:12px;padding-top:12px;border-top:1px solid #f1f4f9}
.kfp-img{max-height:140px;max-width:100%;border-radius:8px;object-fit:cover;cursor:pointer}

.kb-actions{border-top:1px solid #f1f4f9;padding:10px 16px;display:flex;gap:8px;align-items:center}
.btn-toggle{font-size:11.5px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer;border:1.5px solid;transition:all .15s}
.btn-toggle.on{border-color:#1f8a5b;color:#1f8a5b;background:#eaf6ef}
.btn-toggle.off{border-color:#cdd5e2;color:#7a8699;background:#f7f9fc}
.btn-edit{border:1px solid #e3e8f0;background:#f7f9fc;color:#5a6b82;font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer;margin-left:auto}
.btn-del{border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer}

.pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px}
.pg-btn{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;cursor:pointer}
.pg-btn:disabled{opacity:.4;cursor:not-allowed}
.pg-btn:not(:disabled):hover{background:#f1f4f9}
.pg-nums{display:flex;gap:4px}
.pg-num{width:34px;height:34px;border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pg-num.active{background:#0a1f3c;color:#fff;border-color:#0a1f3c}
.pg-num:not(.active):hover{background:#f1f4f9}

/* Modal */
.overlay{position:fixed;inset:0;background:rgba(10,31,60,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#fff;border-radius:16px;width:100%;max-width:580px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.3)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:22px 24px 0;font-size:17px;font-weight:700;color:#0a1f3c;flex-shrink:0}
.modal-close{border:none;background:none;font-size:24px;color:#9aa6b6;cursor:pointer;line-height:1;padding:0}
.modal-body{padding:20px 24px;overflow:auto;flex:1}
.modal-footer{padding:16px 24px;border-top:1px solid #eef1f6;display:flex;gap:10px;flex-shrink:0}
.mfield{margin-bottom:18px}
label{display:block;font-size:11.5px;font-weight:600;color:#5a6b82;margin-bottom:7px;text-transform:uppercase;letter-spacing:.3px}
.lbl-opt{font-weight:400;text-transform:none;letter-spacing:0;color:#9aa6b6;font-size:11px}
.mta{width:100%;padding:11px 13px;border:1.5px solid #dce3ed;border-radius:9px;font-size:13.5px;font-family:inherit;color:#1a2433;outline:none;resize:vertical;background:#fafbfd;line-height:1.55;box-sizing:border-box}
.mta:focus{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.1);background:#fff}
.mhint{font-size:11.5px;color:#9aa6b6;margin-top:5px}

/* Imagen actual (edición) */
.file-current{display:flex;align-items:center;gap:12px;padding:10px 13px;background:#f7f9fc;border:1px solid #e3e8f0;border-radius:9px;margin-bottom:10px;flex-wrap:wrap}
.fc-img{height:64px;width:auto;max-width:100px;border-radius:7px;object-fit:cover}
.fc-name{font-size:12.5px;color:#15233a;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-rm-file{border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-size:12px;font-weight:600;padding:5px 10px;border-radius:7px;cursor:pointer;flex-shrink:0;white-space:nowrap}
.btn-rm-file:disabled{opacity:.5;cursor:not-allowed}

/* Zona drag & drop */
.upload-zone{border:2px dashed #dce3ed;border-radius:10px;background:#fafbfd;transition:border-color .15s,background .15s;position:relative}
.upload-zone.dragover{border-color:#2f6fed;background:#eef3ff}
.file-input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.uz-placeholder{display:flex;flex-direction:column;align-items:center;gap:5px;padding:20px;text-align:center;cursor:pointer;color:#7a8699;font-size:13px}
.uz-ico{font-size:28px}
.uz-placeholder u{color:#2f6fed}
.uz-hint{font-size:11px;color:#b0bac8;margin-top:2px}
.uz-selected{display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;color:#15233a;font-weight:500}
.uz-thumb{height:48px;width:auto;max-width:72px;border-radius:6px;object-fit:cover;flex-shrink:0}
.uz-fname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-rm-selected{border:none;background:none;color:#c0392b;font-size:20px;cursor:pointer;line-height:1;padding:0 2px;flex-shrink:0}

.form-err{color:#c0392b;font-size:13px;padding:10px 12px;background:#fbe9e7;border-radius:8px;margin-top:4px}
.btn-save{flex:1;background:#0a1f3c;color:#fff;border:none;font-size:14px;font-weight:600;padding:12px;border-radius:9px;cursor:pointer;font-family:inherit}
.btn-save:disabled{background:#9aabb8;cursor:not-allowed}
.btn-cancel{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:14px;font-weight:500;padding:12px 18px;border-radius:9px;cursor:pointer;font-family:inherit}
</style>
