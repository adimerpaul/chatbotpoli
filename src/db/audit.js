const pool = require('./connection');

// req.user ya viene decodificado por el authMiddleware — no hay que re-verificar el JWT
function userFromReq(req) {
  if (!req) return { id: null, nombre: 'Sistema' };
  if (req.user) return { id: req.user.id ?? null, nombre: req.user.nombre || req.user.username || 'Operador' };
  return { id: null, nombre: 'Sistema' };
}

// Guarda una entrada en la tabla audits
// evento: 'created' | 'updated' | 'deleted' | 'restored' | 'system'
// tabla: 'conversaciones' | 'mensajes' | 'bot' | etc.
async function saveAudit({ evento, tabla, registroId, antes = null, despues = null, req = null, usuarioId = null, usuarioNombre = null }) {
  try {
    const user = (usuarioId || usuarioNombre)
      ? { id: usuarioId, nombre: usuarioNombre }
      : userFromReq(req);
    const ip = req
      ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null)
      : null;

    await pool.query(
      `INSERT INTO audits (evento, tabla, registro_id, usuario_id, usuario_nombre, valores_antes, valores_despues, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evento,
        tabla,
        String(registroId),
        user.id,
        user.nombre,
        antes   ? JSON.stringify(antes)   : null,
        despues ? JSON.stringify(despues) : null,
        ip
      ]
    );
  } catch (err) {
    // Audit nunca debe romper el flujo principal
    console.error('[AUDIT]', err.message);
  }
}

// Devuelve los últimos audits con filtros opcionales
async function getAudits({ tabla = null, registroId = null, limit = 100, offset = 0 } = {}) {
  try {
    const wheres = [];
    const vals   = [];
    if (tabla)      { wheres.push('tabla = ?');       vals.push(tabla); }
    if (registroId) { wheres.push('registro_id = ?'); vals.push(String(registroId)); }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM audits ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM audits ${where}`,
      vals
    );
    return { rows, total };
  } catch (err) {
    console.error('[AUDIT:get]', err.message);
    return { rows: [], total: 0 };
  }
}

module.exports = { saveAudit, getAudits, userFromReq };
