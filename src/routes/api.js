const express = require('express');
const router = express.Router();
const store = require('../store/conversations');
const { sendMessage, isConnected, getWAInfo, resetSession, getBotEnabled, setBotEnabled } = require('../bot/whatsapp');
const db = require('../db/service');
const { saveAudit, getAudits } = require('../db/audit');

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

router.get('/conversations', (_req, res) => {
  res.json(store.getAll());
});

// Recarga el store en memoria desde la BD
// Útil cuando se modifican datos directamente en MySQL (ej: borrar deleted_at)
router.post('/db/reload', async (req, res) => {
  try {
    const data = await db.loadAllConversaciones();
    store.clear();
    if (data.length > 0) store.load(data);
    const all = store.getAll();
    req.app.get('io').emit('conversations:reloaded', all);
    console.log(`🔄 Store recargado desde BD: ${data.length} conversaciones`);
    res.json(all);
  } catch (err) {
    console.error('[RELOAD]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Truncate completo — limpia todas las tablas y el store en memoria
router.post('/db/truncate', async (req, res) => {
  try {
    await db.truncateAll();
    // Vaciar el store en memoria también
    store.clear();
    req.app.get('io').emit('store:cleared');
    console.log('🗑️  Truncate completo ejecutado');
    res.json({ ok: true });
  } catch (err) {
    console.error('[TRUNCATE]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (_req, res) => {
  res.json(getWAInfo());
});

router.get('/bot/status', (_req, res) => {
  res.json({ enabled: getBotEnabled() });
});

router.post('/bot/toggle', (req, res) => {
  const next = req.body.enabled !== undefined ? !!req.body.enabled : !getBotEnabled();
  setBotEnabled(next);
  console.log(`🤖 Bot IA ${next ? 'activado' : 'desactivado'}`);
  req.app.get('io').emit('bot:status', { enabled: next });
  res.json({ enabled: next });
});

// Borrar sesión guardada y reconectar (muestra QR nuevo)
router.post('/wa/reset', async (req, res) => {
  try {
    await resetSession(req.app.get('io'));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: historial de auditoría
router.get('/audits', async (req, res) => {
  const { tabla, registro_id, limit = 100, offset = 0 } = req.query;
  const result = await getAudits({ tabla, registroId: registro_id, limit: Number(limit), offset: Number(offset) });
  res.json(result);
});

// Enviar mensaje a ciudadano (desde el panel del operador)
router.post('/conversations/:id/send', async (req, res) => {
  const conv = store.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  const operatorName = process.env.OPERATOR_NAME || 'Of. Gutiérrez (Tú)';
  const t = now();

  store.addMessage(conv.phone, { from: 'agente', text: text.trim(), time: t });
  await db.saveMessage(conv.id, { origen: 'agente', texto: text.trim(), hora: t });

  if (conv.channel === 'WhatsApp' || conv.channel === 'whatsapp') {
    try { await sendMessage(conv.phone, text.trim()); }
    catch (err) { console.error('[API] Error enviando WhatsApp:', err.message); }
  }

  saveAudit({ evento: 'created', tabla: 'mensajes', registroId: conv.id,
    despues: { texto: text.trim(), origen: 'agente', hora: t }, req });

  const updated = store.get(conv.phone);
  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

// Tomar caso como operador
router.post('/conversations/:id/tomar', async (req, res) => {
  const conv = store.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  const agente = req.body.agente || process.env.OPERATOR_NAME || 'Of. Gutiérrez (Tú)';
  const t = now();
  const sistemaText = `Caso asignado a ${agente} · ${t}`;
  const antes = { agente: conv.agente, estado: conv.estado };

  store.addMessage(conv.phone, { from: 'sistema', text: sistemaText });
  const updated = store.update(conv.phone, { agente, estado: 'En proceso' });

  await db.saveMessage(conv.id, { origen: 'sistema', texto: sistemaText, hora: t });
  await db.updateConversacion(conv.id, { agente, estado: 'En proceso' });

  saveAudit({ evento: 'updated', tabla: 'conversaciones', registroId: conv.id,
    antes, despues: { agente, estado: 'En proceso' }, req });

  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

// Soft delete de conversación
router.delete('/conversations/:id', async (req, res) => {
  const conv = store.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  try {
    const snap = { id: conv.id, phone: conv.phone, tipo: conv.tipo, estado: conv.estado, agente: conv.agente };
    await db.deleteConversacion(conv.id);
    store.removeById(conv.id);

    saveAudit({ evento: 'deleted', tabla: 'conversaciones', registroId: conv.id,
      antes: snap, req });

    req.app.get('io').emit('conversation:deleted', { id: conv.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar estado o agente
router.patch('/conversations/:id', async (req, res) => {
  const conv = store.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  const allowed = ['estado', 'agente', 'prioridad', 'tipo'];
  const changes = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) changes[key] = req.body[key];
  }

  if (changes.agente && changes.agente !== 'Sin asignar' && conv.estado === 'Nuevo') {
    changes.estado = 'En proceso';
  }

  // Capturar solo los campos que realmente van a cambiar
  const antes = {};
  for (const k of Object.keys(changes)) antes[k] = conv[k];

  const updated = store.updateById(conv.id, changes);
  await db.updateConversacion(conv.id, changes);

  saveAudit({ evento: 'updated', tabla: 'conversaciones', registroId: conv.id,
    antes, despues: changes, req });

  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

// ── Reportes ─────────────────────────────────────────────────────────────────
const pool = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

router.get('/reportes', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('ver_reportes')) return res.status(403).json({ error: 'Sin permisos' });

  const { desde, hasta, celular, tipo, keyword, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const wheres = ['c.deleted_at IS NULL', 'ci.deleted_at IS NULL'];
  const vals = [];

  if (desde) { wheres.push('c.created_at >= ?'); vals.push(desde + ' 00:00:00'); }
  if (hasta) { wheres.push('c.created_at <= ?'); vals.push(hasta + ' 23:59:59'); }
  if (celular) { wheres.push('ci.phone LIKE ?'); vals.push(`%${celular.replace(/\D/g,'')}%`); }
  if (tipo && tipo !== 'Todos') { wheres.push('c.tipo = ?'); vals.push(tipo); }
  if (keyword) {
    wheres.push('(c.delito LIKE ? OR c.zona LIKE ? OR c.recomendacion LIKE ? OR ci.nombre LIKE ?)');
    const kw = `%${keyword}%`;
    vals.push(kw, kw, kw, kw);
  }

  const where = 'WHERE ' + wheres.join(' AND ');

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM conversaciones c JOIN ciudadanos ci ON ci.id = c.ciudadano_id ${where}`,
      vals
    );
    const [rows] = await pool.query(
      `SELECT c.folio, c.tipo, c.prioridad, c.estado, c.delito, c.zona, c.agente,
              c.ai_confidence, c.recomendacion, c.created_at, c.updated_at,
              ci.phone, ci.nombre,
              (SELECT COUNT(*) FROM mensajes m WHERE m.conversacion_id = c.id AND m.deleted_at IS NULL) AS total_mensajes
       FROM conversaciones c
       JOIN ciudadanos ci ON ci.id = c.ciudadano_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...vals, Number(limit), offset]
    );
    res.json({ rows, total, pages: Math.ceil(total / Number(limit)) || 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
