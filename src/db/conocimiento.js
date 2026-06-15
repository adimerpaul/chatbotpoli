const pool = require('./connection');

async function getAll({ search = '', page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';
  if (search.trim()) {
    where += ' AND (pregunta LIKE ? OR respuesta LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM base_conocimiento ${where}`, params);
  const [rows] = await pool.query(
    `SELECT id, pregunta, respuesta, activo, created_at FROM base_conocimiento ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );
  return { rows, total, pages: Math.ceil(total / Number(limit)) || 1 };
}

async function getActivos() {
  const [rows] = await pool.query(
    'SELECT pregunta, respuesta FROM base_conocimiento WHERE activo = 1 ORDER BY id ASC'
  );
  return rows;
}

async function create({ pregunta, respuesta }) {
  const [r] = await pool.query(
    'INSERT INTO base_conocimiento (pregunta, respuesta) VALUES (?, ?)',
    [pregunta, respuesta]
  );
  return r.insertId;
}

async function update(id, { pregunta, respuesta, activo }) {
  const sets = [], vals = [];
  if (pregunta !== undefined) { sets.push('pregunta = ?'); vals.push(pregunta); }
  if (respuesta !== undefined) { sets.push('respuesta = ?'); vals.push(respuesta); }
  if (activo !== undefined) { sets.push('activo = ?'); vals.push(activo ? 1 : 0); }
  if (!sets.length) return;
  vals.push(id);
  await pool.query(`UPDATE base_conocimiento SET ${sets.join(', ')} WHERE id = ?`, vals);
}

async function remove(id) {
  await pool.query('DELETE FROM base_conocimiento WHERE id = ?', [id]);
}

module.exports = { getAll, getActivos, create, update, remove };
