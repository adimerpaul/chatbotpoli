const express = require('express');
const router = express.Router();
const store = require('../store/conversations');
const { sendMessage, isConnected } = require('../bot/whatsapp');

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

router.get('/conversations', (_req, res) => {
  res.json(store.getAll());
});

router.get('/status', (_req, res) => {
  res.json({ whatsapp: isConnected() ? 'ready' : 'connecting' });
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
router.post('/conversations/:id/tomar', (req, res) => {
  const conv = store.getById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });

  const agente = req.body.agente || process.env.OPERATOR_NAME || 'Of. Gutiérrez (Tú)';
  const t = now();

  store.addMessage(conv.phone, { from: 'sistema', text: `Caso asignado a ${agente} · ${t}` });
  const updated = store.update(conv.phone, { agente, estado: 'En proceso' });

  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

// Actualizar estado o agente
router.patch('/conversations/:id', (req, res) => {
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
  req.app.get('io').emit('conversation:updated', updated);
  res.json(updated);
});

module.exports = router;
