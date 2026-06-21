const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authDb = require('../db/auth');
const { authMiddleware, SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  try {
    const user = await authDb.findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const permisos = await authDb.getUserPermissions(user.id);
    const token = jwt.sign(
      { id: user.id, username: user.username, nombre: user.nombre, permisos },
      SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, nombre: user.nombre, permisos } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const permisos = await authDb.getUserPermissions(req.user.id);
    res.json({ user: { ...req.user, permisos } });
  } catch {
    res.json({ user: req.user });
  }
});

// Lista de agentes activos — accesible a cualquier usuario autenticado (para el dropdown)
router.get('/agents', authMiddleware, async (req, res) => {
  try {
    const agents = await authDb.getActiveAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_usuarios')) return res.status(403).json({ error: 'Sin permisos' });
  try {
    const users = await authDb.getAllUsers();
    res.json({ users, allPermisos: authDb.ALL_PERMS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_usuarios')) return res.status(403).json({ error: 'Sin permisos' });
  const { username, password, nombre, email, celular, permisos } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  try {
    const id = await authDb.createUser({ username, password, nombre, email, celular, permisos: permisos || [] });
    res.json({ ok: true, id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_usuarios')) return res.status(403).json({ error: 'Sin permisos' });
  const { nombre, email, celular, password, activo, permisos } = req.body;
  try {
    await authDb.updateUser(req.params.id, { nombre, email, celular, password, activo });
    if (permisos !== undefined) await authDb.setUserPermisos(req.params.id, permisos);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_usuarios')) return res.status(403).json({ error: 'Sin permisos' });
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  try {
    await authDb.deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
