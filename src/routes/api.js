const express = require('express');
const router = express.Router();
const store = require('../store/conversations');
const { sendMessage, isConnected, getWAInfo, resetSession } = require('../bot/whatsapp');
const db = require('../db/service');

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

router.get('/conversations', (_req, res) => {
  res.json(store.getAll());
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

// Borrar sesión guardada y reconectar (muestra QR nuevo)
router.post('/wa/reset', async (req, res) => {
  try {
    await resetSession(req.app.get('io'));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

  // Enviar por WhatsApp si el canal es WhatsApp y está conectado
  if (conv.channel === 'WhatsApp' || conv.channel === 'whatsapp') {
    try {
      await sendMessage(conv.phone, text.trim());
    } catch (err) {
      console.error('[API] Error enviando WhatsApp:', err.message);
    }
  }

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

  store.addMessage(conv.phone, { from: 'sistema', text: sistemaText });
  const updated = store.update(conv.phone, { agente, estado: 'En proceso' });

  await db.saveMessage(conv.id, { origen: 'sistema', texto: sistemaText, hora: t });
  await db.updateConversacion(conv.id, { agente, estado: 'En proceso' });

  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

// Soft delete de conversación
router.delete('/conversations/:id', async (req, res) => {
  const conv = store.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  try {
    await db.deleteConversacion(conv.id);
    store.remove(conv.phone);
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

  // Si se asigna agente desde Sin asignar, marcar En proceso
  if (changes.agente && changes.agente !== 'Sin asignar' && conv.estado === 'Nuevo') {
    changes.estado = 'En proceso';
  }

  const updated = store.update(conv.phone, changes);
  await db.updateConversacion(conv.id, changes);

  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

module.exports = router;
