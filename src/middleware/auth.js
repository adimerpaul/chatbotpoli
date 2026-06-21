const jwt  = require('jsonwebtoken');
const pool = require('../db/connection');

const SECRET = process.env.JWT_SECRET || 'chatbotpoli_secret_key_2026';

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Permisos siempre frescos desde la BD (el JWT puede estar desactualizado)
  try {
    const [rows] = await pool.query(
      'SELECT permiso FROM permisos WHERE usuario_id = ?',
      [decoded.id]
    );
    decoded.permisos = rows.map(r => r.permiso);
  } catch {
    // Si falla la BD, usar los permisos del token como fallback
  }

  req.user = decoded;
  next();
}

module.exports = { authMiddleware, SECRET };
