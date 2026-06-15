const pool = require('./connection');
const bcrypt = require('bcryptjs');

const ALL_PERMS = [
  'ver_conversaciones',
  'enviar_mensajes',
  'tomar_casos',
  'cambiar_estado',
  'eliminar_conversaciones',
  'gestionar_usuarios',
  'gestionar_bot'
];

async function findUserByUsername(username) {
  const [[row]] = await pool.query(
    'SELECT id, username, password, nombre, email, activo FROM usuarios WHERE username = ? AND activo = 1',
    [username]
  );
  return row || null;
}

async function getUserPermissions(userId) {
  const [rows] = await pool.query('SELECT permiso FROM permisos WHERE usuario_id = ?', [userId]);
  return rows.map(r => r.permiso);
}

async function getAllUsers() {
  const [users] = await pool.query(
    'SELECT id, username, nombre, email, activo, created_at FROM usuarios ORDER BY id ASC'
  );
  for (const user of users) {
    user.permisos = await getUserPermissions(user.id);
  }
  return users;
}

async function createUser({ username, password, nombre, email, permisos = [] }) {
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO usuarios (username, password, nombre, email) VALUES (?, ?, ?, ?)',
    [username, hash, nombre || username, email || null]
  );
  const userId = result.insertId;
  for (const perm of permisos) {
    if (ALL_PERMS.includes(perm)) {
      await pool.query('INSERT IGNORE INTO permisos (usuario_id, permiso) VALUES (?, ?)', [userId, perm]);
    }
  }
  return userId;
}

async function updateUser(id, { nombre, email, password, activo }) {
  const sets = [];
  const values = [];
  if (nombre !== undefined) { sets.push('nombre = ?'); values.push(nombre); }
  if (email !== undefined) { sets.push('email = ?'); values.push(email || null); }
  if (activo !== undefined) { sets.push('activo = ?'); values.push(activo ? 1 : 0); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    sets.push('password = ?');
    values.push(hash);
  }
  if (sets.length === 0) return;
  values.push(id);
  await pool.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, values);
}

async function setUserPermisos(userId, permisos) {
  await pool.query('DELETE FROM permisos WHERE usuario_id = ?', [userId]);
  for (const perm of permisos) {
    if (ALL_PERMS.includes(perm)) {
      await pool.query('INSERT INTO permisos (usuario_id, permiso) VALUES (?, ?)', [userId, perm]);
    }
  }
}

async function deleteUser(id) {
  await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
}

module.exports = { findUserByUsername, getUserPermissions, getAllUsers, createUser, updateUser, setUserPermisos, deleteUser, ALL_PERMS };
