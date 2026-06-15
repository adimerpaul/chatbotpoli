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
        <span class="meta-txt">{{ total }} entrada{{ total !== 1 ? 's' : '' }} encontrada{{ total !== 1 ? 's' : '' }}</span>
        <span class="meta-txt">Página {{ page }} de {{ pages }}</span>
      </div>

      <!-- Lista -->
      <div v-if="loading" class="loading">Cargando...</div>

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
            </div>
            <div class="kb-q">
              <span class="kb-qlbl">P:</span>
              {{ item.pregunta }}
            </div>
            <div class="kb-a">
              <span class="kb-albl">R:</span>
              <span class="kb-atext">{{ item.respuesta }}</span>
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
          <button v-for="p in pageRange" :key="p"
            class="pg-num" :class="{active: p === page}"
            @click="goPage(p)">{{ p }}</button>
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
            <textarea v-model="form.pregunta" placeholder="Ej: ¿Cuál es el número de ENDE?" rows="3" class="mta"></textarea>
            <div class="mhint">Escribe la pregunta tal como la haría un ciudadano</div>
          </div>
          <div class="mfield">
            <label>Respuesta que debe dar la IA</label>
            <textarea v-model="form.respuesta" placeholder="Ej: El número de ENDE Oruro es 02-5250000…" rows="5" class="mta"></textarea>
            <div class="mhint">Incluye datos concretos: números, direcciones, requisitos exactos</div>
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
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/lib/api'

const LIMIT = 8

const rows = ref([])
const total = ref(0)
const pages = ref(1)
const page = ref(1)
const loading = ref(false)
const searchInput = ref('')
const searchQuery = ref('')
let searchTimer = null

const modal = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')
const form = ref({ pregunta: '', respuesta: '' })

const pageRange = computed(() => {
  const r = []
  const start = Math.max(1, page.value - 2)
  const end = Math.min(pages.value, page.value + 2)
  for (let i = start; i <= end; i++) r.push(i)
  return r
})

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ search: searchQuery.value, page: page.value, limit: LIMIT })
    const data = await apiFetch(`/api/conocimiento?${params}`).then(r => r.json())
    rows.value = data.rows || []
    total.value = data.total || 0
    pages.value = data.pages || 1
  } finally {
    loading.value = false
  }
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery.value = searchInput.value
    page.value = 1
    load()
  }, 350)
}

function clearSearch() {
  searchInput.value = ''
  searchQuery.value = ''
  page.value = 1
  load()
}

function goPage(p) { page.value = p; load() }

function openNew() {
  editing.value = null
  form.value = { pregunta: '', respuesta: '' }
  formError.value = ''
  modal.value = true
}

function openEdit(item) {
  editing.value = item
  form.value = { pregunta: item.pregunta, respuesta: item.respuesta }
  formError.value = ''
  modal.value = true
}

function closeModal() { modal.value = false }

async function save() {
  formError.value = ''
  if (!form.value.pregunta.trim()) { formError.value = 'La pregunta es requerida'; return }
  if (!form.value.respuesta.trim()) { formError.value = 'La respuesta es requerida'; return }
  saving.value = true
  try {
    const url = editing.value ? `/api/conocimiento/${editing.value.id}` : '/api/conocimiento'
    const method = editing.value ? 'PUT' : 'POST'
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: form.value.pregunta.trim(), respuesta: form.value.respuesta.trim() })
    }).then(r => r.json())
    if (res.error) { formError.value = res.error; return }
    modal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function toggleActivo(item) {
  await apiFetch(`/api/conocimiento/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo: !item.activo })
  })
  await load()
}

async function deleteItem(item) {
  if (!confirm(`¿Eliminar esta entrada?\n\n"${item.pregunta.slice(0, 80)}..."\n\nEsta acción no se puede deshacer.`)) return
  await apiFetch(`/api/conocimiento/${item.id}`, { method: 'DELETE' })
  if (rows.value.length === 1 && page.value > 1) page.value--
  await load()
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
.kb-meta{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.kb-num{font-size:11px;font-family:'IBM Plex Mono',monospace;color:#9aa6b6;font-weight:600}
.kb-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.kb-badge.on{background:#e6f5ee;color:#1f8a5b}
.kb-badge.off{background:#eef1f6;color:#7a8699}
.kb-q{font-size:13.5px;font-weight:600;color:#15233a;line-height:1.5;margin-bottom:8px;display:flex;gap:8px}
.kb-qlbl{color:#2f6fed;font-weight:700;flex-shrink:0}
.kb-a{font-size:13px;color:#5a6b82;line-height:1.6;display:flex;gap:8px;align-items:flex-start}
.kb-albl{color:#1f8a5b;font-weight:700;flex-shrink:0;margin-top:1px}
.kb-atext{flex:1}
.kb-actions{border-top:1px solid #f1f4f9;padding:10px 16px;display:flex;gap:8px;align-items:center}
.btn-toggle{font-size:11.5px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer;border:1.5px solid}
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

.overlay{position:fixed;inset:0;background:rgba(10,31,60,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.3)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:22px 24px 0;font-size:17px;font-weight:700;color:#0a1f3c;flex-shrink:0}
.modal-close{border:none;background:none;font-size:24px;color:#9aa6b6;cursor:pointer;line-height:1;padding:0}
.modal-body{padding:20px 24px;overflow:auto;flex:1}
.modal-footer{padding:16px 24px;border-top:1px solid #eef1f6;display:flex;gap:10px;flex-shrink:0}
.mfield{margin-bottom:18px}
label{display:block;font-size:11.5px;font-weight:600;color:#5a6b82;margin-bottom:7px;text-transform:uppercase;letter-spacing:.3px}
.mta{width:100%;padding:11px 13px;border:1.5px solid #dce3ed;border-radius:9px;font-size:13.5px;font-family:inherit;color:#1a2433;outline:none;resize:vertical;background:#fafbfd;line-height:1.55}
.mta:focus{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.1);background:#fff}
.mhint{font-size:11.5px;color:#9aa6b6;margin-top:5px}
.form-err{color:#c0392b;font-size:13px;padding:10px 12px;background:#fbe9e7;border-radius:8px;margin-top:4px}
.btn-save{flex:1;background:#0a1f3c;color:#fff;border:none;font-size:14px;font-weight:600;padding:12px;border-radius:9px;cursor:pointer;font-family:inherit}
.btn-save:disabled{background:#9aabb8;cursor:not-allowed}
.btn-cancel{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:14px;font-weight:500;padding:12px 18px;border-radius:9px;cursor:pointer;font-family:inherit}
</style>
