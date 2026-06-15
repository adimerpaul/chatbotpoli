import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const AZUL       = [20, 52, 120]
const AZUL_LIGHT = [47, 111, 237]
const GRIS_DARK  = [21, 35, 58]
const GRIS_MED   = [90, 107, 130]
const GRIS_LINE  = [224, 229, 238]
const ROJO       = [192, 57, 43]
const NARANJA    = [185, 117, 26]
const VERDE      = [31, 138, 91]

const TIPO_COLOR = {
  Emergencia: ROJO,
  Denuncia:   NARANJA,
  Consulta:   AZUL_LIGHT,
}
const PRIO_COLOR = {
  Alta:  ROJO,
  Media: NARANJA,
  Baja:  VERDE,
}
const EST_COLOR = {
  Nuevo:       AZUL_LIGHT,
  'En proceso': NARANJA,
  Cerrado:     GRIS_MED,
}

function rgb(arr) { return { r: arr[0], g: arr[1], b: arr[2] } }

function drawHeader(doc, conv) {
  const W = doc.internal.pageSize.getWidth()

  // Fondo degradado simulado: barra superior azul oscura
  doc.setFillColor(...AZUL)
  doc.rect(0, 0, W, 38, 'F')

  // Escudo policial simplificado (círculo + estrella)
  const cx = 22, cy = 19
  doc.setFillColor(255, 255, 255)
  doc.circle(cx, cy, 10, 'F')
  doc.setFillColor(...AZUL_LIGHT)
  doc.circle(cx, cy, 8, 'F')
  doc.setFillColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('P', cx, cy + 3.5, { align: 'center' })

  // Título institución
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('POLICÍA BOLIVIANA', 38, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 200, 240)
  doc.text('Centro de Atención al Ciudadano — Oruro', 38, 21)
  doc.setFontSize(8)
  doc.text('Sistema de Gestión de Casos CAC', 38, 27)

  // Folio + fecha — lado derecho
  const now = new Date()
  const fechaStr = now.toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' })
  const horaStr  = now.toLocaleTimeString('es-BO', { hour:'2-digit', minute:'2-digit' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(conv.id, W - 15, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(180, 200, 240)
  doc.text(`${fechaStr}  ·  ${horaStr}`, W - 15, 20, { align: 'right' })

  // Tipo de caso — badge derecho
  const tipoColor = TIPO_COLOR[conv.tipo] || GRIS_MED
  doc.setFillColor(...tipoColor)
  doc.roundedRect(W - 48, 25, 33, 9, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text((conv.tipo || '—').toUpperCase(), W - 31.5, 30.8, { align: 'center' })

  return 44 // y inicial para el cuerpo
}

function drawSectionTitle(doc, text, y) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...AZUL)
  doc.rect(15, y, 4, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GRIS_DARK)
  doc.text(text, 22, y + 5.5)
  doc.setDrawColor(...GRIS_LINE)
  doc.setLineWidth(0.3)
  doc.line(15, y + 9, W - 15, y + 9)
  return y + 13
}

function colorBadgeText(doc, label, x, y, color) {
  const tw = doc.getTextWidth(label) + 6
  doc.setFillColor(...color)
  doc.roundedRect(x, y - 4.5, tw, 6.5, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(label, x + 3, y)
  return tw
}

export function generatePdf(conv) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  let y = drawHeader(doc, conv)

  // ── DATOS DEL CASO ──────────────────────────────────────────────
  y = drawSectionTitle(doc, 'DATOS DEL CASO', y)

  const leftX  = 15
  const col1W  = 55
  const col2X  = leftX + col1W
  const rowH   = 8

  const datoRows = [
    ['Número de folio',   conv.id || '—'],
    ['Estado del caso',   conv.estado || '—'],
    ['Tipo de delito',    conv.delito || '—'],
    ['Tipo de caso',      conv.tipo || '—'],
    ['Prioridad',         conv.prioridad || '—'],
    ['Zona',              conv.zona || '—'],
    ['Canal de reporte',  conv.channel || 'WhatsApp'],
    ['Teléfono',          conv.phone ? `+${conv.phone}` : '—'],
    ['Agente asignado',   conv.agente || '—'],
  ]

  datoRows.forEach(([label, val], i) => {
    const rowY = y + i * rowH
    if (i % 2 === 0) {
      doc.setFillColor(247, 249, 252)
      doc.rect(15, rowY, W - 30, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRIS_MED)
    doc.text(label, leftX + 3, rowY + 5.5)

    // Badges para ciertos campos
    if (label === 'Estado del caso') {
      colorBadgeText(doc, val, col2X, rowY + 5.5, EST_COLOR[val] || GRIS_MED)
    } else if (label === 'Prioridad') {
      colorBadgeText(doc, val, col2X, rowY + 5.5, PRIO_COLOR[val] || GRIS_MED)
    } else if (label === 'Tipo de caso') {
      colorBadgeText(doc, val, col2X, rowY + 5.5, TIPO_COLOR[val] || GRIS_MED)
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...GRIS_DARK)
      doc.text(String(val), col2X, rowY + 5.5)
    }
  })

  y += datoRows.length * rowH + 8

  // ── ANÁLISIS IA ─────────────────────────────────────────────────
  y = drawSectionTitle(doc, 'ANÁLISIS DEL ASISTENTE IA', y)

  // Barra de confianza
  const conf = conv.aiConfidence || 0
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRIS_MED)
  doc.text('Nivel de confianza del análisis', leftX, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...AZUL_LIGHT)
  doc.text(`${conf}%`, W - 15, y, { align: 'right' })
  y += 4
  // Track
  doc.setFillColor(...GRIS_LINE)
  doc.roundedRect(leftX, y, W - 30, 4, 2, 2, 'F')
  // Fill
  if (conf > 0) {
    const fillW = Math.max(4, (W - 30) * conf / 100)
    doc.setFillColor(...AZUL_LIGHT)
    doc.roundedRect(leftX, y, fillW, 4, 2, 2, 'F')
  }
  y += 9

  // Puntos clave
  const puntos = conv.aiPuntos || []
  if (puntos.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...GRIS_MED)
    doc.text('PUNTOS CLAVE', leftX, y)
    y += 5
    puntos.forEach(p => {
      doc.setFillColor(...AZUL_LIGHT)
      doc.circle(leftX + 1.5, y - 1, 1.5, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...GRIS_DARK)
      const lines = doc.splitTextToSize(p, W - 45)
      doc.text(lines, leftX + 6, y)
      y += lines.length * 5 + 2
    })
  }

  // Recomendación
  if (conv.recomendacion) {
    const tipoColor = TIPO_COLOR[conv.tipo] || GRIS_MED
    doc.setFillColor(tipoColor[0], tipoColor[1], tipoColor[2], 0.08)
    const recomLines = doc.splitTextToSize(conv.recomendacion, W - 42)
    const recomH = recomLines.length * 5 + 10
    doc.setFillColor(245, 248, 255)
    doc.roundedRect(leftX, y, W - 30, recomH, 2, 2, 'F')
    doc.setFillColor(...tipoColor)
    doc.rect(leftX, y, 3, recomH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS_MED)
    doc.text('RECOMENDACIÓN', leftX + 7, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRIS_DARK)
    doc.text(recomLines, leftX + 7, y + 10)
    y += recomH + 8
  } else {
    y += 4
  }

  // ── TRANSCRIPCIÓN ────────────────────────────────────────────────
  y = drawSectionTitle(doc, 'TRANSCRIPCIÓN DE LA CONVERSACIÓN', y)

  const messages = (conv.messages || []).filter(m => m.from !== 'sistema')
  if (messages.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...GRIS_MED)
    doc.text('Sin mensajes en esta conversación.', leftX, y + 4)
    y += 12
  } else {
    const rows = messages.map(m => {
      const quien = m.from === 'ciudadano' ? 'Ciudadano'
                  : m.from === 'bot'       ? 'Asistente IA'
                  : m.from === 'agente'    ? (conv.agente !== 'Sin asignar' ? conv.agente : 'Operador')
                  : m.from
      const contenido = m.type !== 'text' && m.type !== undefined && m.type !== null
        ? `[${(m.type||'').charAt(0).toUpperCase()+(m.type||'').slice(1)}] ${m.text||''}`
        : (m.text || '')
      return [m.time || '', quien, contenido]
    })

    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Remitente', 'Mensaje']],
      body: rows,
      margin: { left: 15, right: 15 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: GRIS_LINE,
        lineWidth: 0.3,
        textColor: GRIS_DARK,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: AZUL,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', textColor: GRIS_MED },
        1: { cellWidth: 38, fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const from = messages[data.row.index]?.from
          if (from === 'bot')       data.cell.styles.textColor = [91, 111, 168]
          if (from === 'agente')    data.cell.styles.textColor = AZUL_LIGHT
          if (from === 'ciudadano') data.cell.styles.textColor = GRIS_DARK
        }
      },
      didDrawPage(data) {
        drawFooter(doc, conv)
      },
    })
  }

  // Footer en última página si no lo dibujó autoTable
  drawFooter(doc, conv)

  doc.save(`${conv.id}_reporte.pdf`)
}

function drawFooter(doc, conv) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const pages = doc.internal.getNumberOfPages()

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GRIS_LINE)
    doc.setLineWidth(0.3)
    doc.line(15, H - 14, W - 15, H - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS_MED)
    const now = new Date()
    doc.text(
      `Generado el ${now.toLocaleDateString('es-BO',{day:'2-digit',month:'long',year:'numeric'})} a las ${now.toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'})}  ·  CAC Policía Boliviana — Oruro`,
      15, H - 8
    )
    doc.text(`Página ${i} de ${pages}`, W - 15, H - 8, { align: 'right' })
  }
}
