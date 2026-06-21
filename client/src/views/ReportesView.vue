<template>
  <div class="rep-view">
    <div class="rep-content">

      <!-- Filtros -->
      <div class="filters-card">
        <div class="filters-title">Filtros de búsqueda</div>
        <div class="filters-grid">

          <div class="fgroup">
            <label>Desde</label>
            <input type="date" v-model="f.desde" class="finp" @change="onFilterChange" />
          </div>
          <div class="fgroup">
            <label>Hasta</label>
            <input type="date" v-model="f.hasta" class="finp" @change="onFilterChange" />
          </div>
          <div class="fgroup">
            <label>Tipo</label>
            <select v-model="f.tipo" class="finp" @change="onFilterChange">
              <option value="Todos">Todos los tipos</option>
              <option>Emergencia</option>
              <option>Denuncia</option>
              <option>Consulta</option>
            </select>
          </div>
          <div class="fgroup">
            <label>Celular ciudadano</label>
            <input type="text" v-model="f.celular" class="finp" placeholder="591…" @input="onFilterChange" />
          </div>
          <div class="fgroup fgroup-wide">
            <label>Palabras clave</label>
            <input type="text" v-model="f.keyword" class="finp" placeholder="Buscar en delito, zona, nombre…" @input="onFilterChange" />
          </div>

        </div>
        <div class="filters-actions">
          <div class="filter-presets">
            <button class="preset-btn" @click="setMes">Este mes</button>
            <button class="preset-btn" @click="setUlt30">Últ. 30 días</button>
            <button class="preset-btn" @click="setAnio">Este año</button>
            <button class="preset-btn" @click="setTodo">Todo</button>
          </div>
          <button class="btn-clear" @click="clearFilters">Limpiar filtros</button>
        </div>
      </div>

      <!-- Resultados header -->
      <div class="results-bar">
        <div class="results-info">
          <span class="results-count">{{ total }} resultado{{ total !== 1 ? 's' : '' }}</span>
          <span v-if="loading" class="results-loading">Cargando…</span>
        </div>
        <div class="export-btns">
          <button class="btn-export excel" :disabled="!rows.length" @click="exportExcel">
            <span>📊</span> Excel
          </button>
          <button class="btn-export pdf" :disabled="!rows.length" @click="exportPdf">
            <span>📄</span> PDF
          </button>
        </div>
      </div>

      <!-- Tabla -->
      <div class="table-wrap">
        <div v-if="loading" class="tloading">Cargando resultados…</div>
        <div v-else-if="!rows.length" class="tempty">
          <div style="font-size:32px;margin-bottom:10px">📋</div>
          Sin resultados para los filtros seleccionados
        </div>
        <table v-else class="rep-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha</th>
              <th>Celular</th>
              <th>Ciudadano</th>
              <th>Tipo</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Delito / Motivo</th>
              <th>Zona</th>
              <th>Agente</th>
              <th>Msgs</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.folio">
              <td class="td-folio">{{ r.folio }}</td>
              <td class="td-fecha">{{ fmtFecha(r.created_at) }}</td>
              <td class="td-phone">{{ r.phone ? '+' + r.phone : '—' }}</td>
              <td>{{ r.nombre || '—' }}</td>
              <td><span class="badge" :class="'tipo-'+r.tipo">{{ r.tipo }}</span></td>
              <td><span class="badge" :class="'prio-'+r.prioridad">{{ r.prioridad }}</span></td>
              <td><span class="badge" :class="'est-'+r.estado.replace(' ','-')">{{ r.estado }}</span></td>
              <td class="td-delito" :title="r.delito">{{ r.delito }}</td>
              <td class="td-zona" :title="r.zona">{{ r.zona }}</td>
              <td class="td-agente">{{ r.agente === 'Sin asignar' ? '—' : r.agente }}</td>
              <td class="td-num">{{ r.total_mensajes }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div v-if="pages > 1" class="pagination">
        <button class="pg-btn" :disabled="page <= 1" @click="goPage(page-1)">← Ant.</button>
        <button v-for="p in pageRange" :key="p" class="pg-num" :class="{active: p === page}" @click="goPage(p)">{{ p }}</button>
        <button class="pg-btn" :disabled="page >= pages" @click="goPage(page+1)">Sig. →</button>
        <span class="pg-info">Pág. {{ page }}/{{ pages }}</span>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { apiFetch } from '@/lib/api'

const LIMIT = 50

// ── Fecha helpers ───────────────────────────────────────────
function toInput(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function mesDesde() { const d = new Date(); d.setDate(1); return toInput(d.getTime()) }
function hoy()      { return toInput(Date.now()) }

// ── Filtros ─────────────────────────────────────────────────
const f = ref({ desde: mesDesde(), hasta: hoy(), tipo: 'Todos', celular: '', keyword: '' })

function setMes()  { f.value.desde = mesDesde(); f.value.hasta = hoy(); load() }
function setUlt30(){ const d = new Date(); d.setDate(d.getDate()-29); f.value.desde = toInput(d.getTime()); f.value.hasta = hoy(); load() }
function setAnio() { const d = new Date(); d.setMonth(0); d.setDate(1); f.value.desde = toInput(d.getTime()); f.value.hasta = hoy(); load() }
function setTodo() { f.value.desde = '2020-01-01'; f.value.hasta = hoy(); load() }

function clearFilters() { f.value = { desde: mesDesde(), hasta: hoy(), tipo: 'Todos', celular: '', keyword: '' }; load() }

let debounceTimer = null
function onFilterChange() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; load() }, 400)
}

// ── Datos ────────────────────────────────────────────────────
const rows    = ref([])
const total   = ref(0)
const pages   = ref(1)
const page    = ref(1)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const p = new URLSearchParams({
      desde: f.value.desde,
      hasta: f.value.hasta,
      tipo:  f.value.tipo,
      celular: f.value.celular.trim(),
      keyword: f.value.keyword.trim(),
      page: page.value,
      limit: LIMIT
    })
    const data = await apiFetch(`/api/reportes?${p}`).then(r => r.json())
    if (data.error) { rows.value = []; return }
    rows.value  = data.rows  || []
    total.value = data.total || 0
    pages.value = data.pages || 1
  } finally {
    loading.value = false
  }
}

function goPage(p) { page.value = p; load() }

const pageRange = computed(() => {
  const r = [], s = Math.max(1, page.value-2), e = Math.min(pages.value, page.value+2)
  for (let i = s; i <= e; i++) r.push(i)
  return r
})

// ── Formato ──────────────────────────────────────────────────
function fmtFecha(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function rowsParaExport() {
  return rows.value.map(r => ({
    Folio:     r.folio,
    Fecha:     fmtFecha(r.created_at),
    Celular:   r.phone ? '+' + r.phone : '',
    Ciudadano: r.nombre || '',
    Tipo:      r.tipo,
    Prioridad: r.prioridad,
    Estado:    r.estado,
    Delito:    r.delito,
    Zona:      r.zona,
    Agente:    r.agente === 'Sin asignar' ? '' : r.agente,
    Mensajes:  r.total_mensajes
  }))
}

// ── Export Excel ─────────────────────────────────────────────
async function exportExcel() {
  // Si hay más páginas, exporta todas
  let data = rowsParaExport()
  if (total.value > LIMIT) {
    const p = new URLSearchParams({ desde: f.value.desde, hasta: f.value.hasta, tipo: f.value.tipo, celular: f.value.celular.trim(), keyword: f.value.keyword.trim(), page: 1, limit: 9999 })
    const res = await apiFetch(`/api/reportes?${p}`).then(r => r.json())
    data = (res.rows || []).map(r => ({
      Folio: r.folio, Fecha: fmtFecha(r.created_at), Celular: r.phone ? '+'+r.phone : '',
      Ciudadano: r.nombre||'', Tipo: r.tipo, Prioridad: r.prioridad, Estado: r.estado,
      Delito: r.delito, Zona: r.zona, Agente: r.agente==='Sin asignar'?'':r.agente, Mensajes: r.total_mensajes
    }))
  }

  const ws = XLSX.utils.json_to_sheet(data)
  // Anchos de columna
  ws['!cols'] = [14,12,16,22,12,10,12,30,22,20,8].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, `reporte_cac_${f.value.desde}_${f.value.hasta}.xlsx`)
}

// ── Export PDF ───────────────────────────────────────────────
async function exportPdf() {
  let data = rowsParaExport()
  if (total.value > LIMIT) {
    const p = new URLSearchParams({ desde: f.value.desde, hasta: f.value.hasta, tipo: f.value.tipo, celular: f.value.celular.trim(), keyword: f.value.keyword.trim(), page: 1, limit: 9999 })
    const res = await apiFetch(`/api/reportes?${p}`).then(r => r.json())
    data = (res.rows || []).map(r => ({
      Folio: r.folio, Fecha: fmtFecha(r.created_at), Celular: r.phone ? '+'+r.phone : '',
      Ciudadano: r.nombre||'', Tipo: r.tipo, Prioridad: r.prioridad, Estado: r.estado,
      Delito: r.delito, Zona: r.zona, Agente: r.agente==='Sin asignar'?'':r.agente, Mensajes: r.total_mensajes
    }))
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(11, 37, 69)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('POLICÍA BOLIVIANA — CAC ORURO', 15, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 200, 240)
  doc.text(`Reporte de casos · ${f.value.desde} al ${f.value.hasta}  ·  ${data.length} registros`, 15, 20)
  const now = new Date()
  doc.text(`Generado: ${now.toLocaleDateString('es-BO')} ${now.toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'})}`, W-15, 20, { align: 'right' })

  const TIPO_C = { Emergencia: [192,57,43], Denuncia: [185,117,26], Consulta: [47,111,237] }
  const PRIO_C = { Alta: [192,57,43], Media: [185,117,26], Baja: [31,138,91] }

  autoTable(doc, {
    startY: 33,
    head: [['Folio','Fecha','Celular','Ciudadano','Tipo','Prioridad','Estado','Delito','Zona','Agente','Msgs']],
    body: data.map(r => [r.Folio, r.Fecha, r.Celular, r.Ciudadano, r.Tipo, r.Prioridad, r.Estado, r.Delito, r.Zona, r.Agente, r.Mensajes]),
    margin: { left: 10, right: 10 },
    styles: { fontSize: 7, cellPadding: 2.5, font: 'helvetica', textColor: [21,35,58], lineColor: [224,229,238], lineWidth: 0.25 },
    headStyles: { fillColor: [20,52,120], textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [247,249,252] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 24 },
      3: { cellWidth: 28 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 40 },
      8: { cellWidth: 32 },
      9: { cellWidth: 30 },
      10: { cellWidth: 12, halign: 'center' }
    },
    didParseCell(d) {
      if (d.section !== 'body') return
      if (d.column.index === 4) {
        const c = TIPO_C[d.cell.text[0]]
        if (c) { d.cell.styles.textColor = c; d.cell.styles.fontStyle = 'bold' }
      }
      if (d.column.index === 5) {
        const c = PRIO_C[d.cell.text[0]]
        if (c) { d.cell.styles.textColor = c; d.cell.styles.fontStyle = 'bold' }
      }
    },
    didDrawPage() {
      const H = doc.internal.pageSize.getHeight()
      doc.setDrawColor(224,229,238); doc.setLineWidth(0.25)
      doc.line(10, H-12, W-10, H-12)
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(90,107,130)
      doc.text('CAC Policía Boliviana — Oruro · Sistema de Gestión de Casos', 10, H-7)
      doc.text(`Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`, W-10, H-7, { align: 'right' })
    }
  })

  doc.save(`reporte_cac_${f.value.desde}_${f.value.hasta}.pdf`)
}

onMounted(load)
</script>

<style scoped>
.rep-view{height:100%;overflow:auto;padding:24px 28px;background:#eef1f6}
.rep-content{max-width:1400px;margin:0 auto;display:flex;flex-direction:column;gap:14px}

/* Filtros */
.filters-card{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:20px}
.filters-title{font-size:13px;font-weight:700;color:#15233a;margin-bottom:14px}
.filters-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:14px}
.fgroup-wide{grid-column:1/-1}
@media(min-width:900px){.fgroup-wide{grid-column:span 2}}
.fgroup{display:flex;flex-direction:column;gap:5px}
.fgroup label{font-size:11px;font-weight:600;color:#5a6b82;text-transform:uppercase;letter-spacing:.3px}
.finp{border:1.5px solid #dce3ed;border-radius:8px;padding:7px 11px;font-size:13px;color:#15233a;font-family:inherit;outline:none;background:#fafbfd}
.finp:focus{border-color:#2f6fed;box-shadow:0 0 0 3px rgba(47,111,237,.1)}
select.finp{cursor:pointer}
.filters-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.filter-presets{display:flex;gap:6px;flex-wrap:wrap}
.preset-btn{border:1px solid #e3e8f0;background:#f7f9fc;color:#5a6b82;font-size:12px;font-weight:600;padding:6px 12px;border-radius:7px;cursor:pointer}
.preset-btn:hover{background:#eef1f6}
.btn-clear{border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-size:12px;font-weight:600;padding:6px 14px;border-radius:7px;cursor:pointer}

/* Barra resultados */
.results-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.results-info{display:flex;align-items:center;gap:12px}
.results-count{font-size:13px;font-weight:700;color:#15233a}
.results-loading{font-size:12px;color:#9aa6b6}
.export-btns{display:flex;gap:8px}
.btn-export{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:8px 16px;border-radius:9px;cursor:pointer;border:none;transition:opacity .15s}
.btn-export:disabled{opacity:.4;cursor:not-allowed}
.btn-export.excel{background:#1a7f4b;color:#fff}
.btn-export.excel:not(:disabled):hover{background:#15693d}
.btn-export.pdf{background:#c0392b;color:#fff}
.btn-export.pdf:not(:disabled):hover{background:#a93226}

/* Tabla */
.table-wrap{background:#fff;border:1px solid #e6ebf2;border-radius:14px;overflow:auto}
.tloading,.tempty{text-align:center;padding:48px 20px;color:#7a8699;font-size:14px}
.rep-table{width:100%;border-collapse:collapse;font-size:12.5px}
.rep-table th{background:#0a1f3c;color:#fff;font-size:11.5px;font-weight:600;padding:11px 12px;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:1}
.rep-table td{padding:10px 12px;border-bottom:1px solid #f1f4f9;color:#33405a;vertical-align:middle}
.rep-table tbody tr:hover{background:#f7f9fc}
.rep-table tbody tr:last-child td{border-bottom:none}

.td-folio{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2f6fed;font-weight:600;white-space:nowrap}
.td-fecha{white-space:nowrap;color:#5a6b82}
.td-phone{font-family:'IBM Plex Mono',monospace;font-size:12px;white-space:nowrap}
.td-delito,.td-zona{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-agente{font-size:12px;color:#5a6b82;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}
.td-num{text-align:center;font-weight:700;color:#15233a}

/* Badges */
.badge{display:inline-block;font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}
.tipo-Emergencia{background:#fde8e6;color:#c0392b}
.tipo-Denuncia{background:#fef3dc;color:#b9751a}
.tipo-Consulta{background:#e8f0fe;color:#2f6fed}
.prio-Alta{background:#fde8e6;color:#c0392b}
.prio-Media{background:#fef3dc;color:#b9751a}
.prio-Baja{background:#e6f5ee;color:#1f8a5b}
.est-Nuevo{background:#e8f0fe;color:#2f6fed}
.est-En-proceso{background:#fef3dc;color:#b9751a}
.est-Cerrado{background:#eef1f6;color:#5a6b82}

/* Paginación */
.pagination{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pg-btn{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:pointer}
.pg-btn:disabled{opacity:.4;cursor:not-allowed}
.pg-btn:not(:disabled):hover{background:#f1f4f9}
.pg-num{width:32px;height:32px;border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:12.5px;font-weight:600;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pg-num.active{background:#0a1f3c;color:#fff;border-color:#0a1f3c}
.pg-num:not(.active):hover{background:#f1f4f9}
.pg-info{font-size:12px;color:#9aa6b6;margin-left:6px}

@media(max-width:767px){
  .rep-view{padding:12px}
  .filters-grid{grid-template-columns:1fr 1fr}
  .fgroup-wide{grid-column:1/-1}
  .rep-table{font-size:11.5px}
  .rep-table th,.rep-table td{padding:8px 9px}
}
</style>
