const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../db/conocimiento');

router.get('/', authMiddleware, async (req, res) => {
  const { search = '', page = 1, limit = 10 } = req.query;
  try {
    const result = await db.getAll({ search, page: Number(page), limit: Number(limit) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_conocimiento')) return res.status(403).json({ error: 'Sin permisos' });
  const { pregunta, respuesta } = req.body;
  if (!pregunta?.trim() || !respuesta?.trim()) return res.status(400).json({ error: 'Pregunta y respuesta requeridas' });
  try {
    const id = await db.create({ pregunta: pregunta.trim(), respuesta: respuesta.trim() });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_conocimiento')) return res.status(403).json({ error: 'Sin permisos' });
  const { pregunta, respuesta, activo } = req.body;
  try {
    await db.update(req.params.id, { pregunta, respuesta, activo });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_conocimiento')) return res.status(403).json({ error: 'Sin permisos' });
  try {
    await db.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
