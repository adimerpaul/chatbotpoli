const pool = require('./connection');

// Registra la sesión del bot de WhatsApp cuando conecta
async function saveSession(phone) {
  try {
    await pool.query('INSERT INTO wa_sesiones (phone) VALUES (?)', [phone]);
  } catch (err) {
    console.error('[DB] saveSession:', err.message);
  }
}

// Inserta o actualiza el ciudadano, devuelve su ID
async function upsertCiudadano(phone) {
  try {
    await pool.query(
      `INSERT INTO ciudadanos (phone)
       VALUES (?)
       ON DUPLICATE KEY UPDATE ultimo_contacto = NOW()`,
      [phone]
    );
    const [[row]] = await pool.query(
      'SELECT id FROM ciudadanos WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    return row?.id ?? null;
  } catch (err) {
    console.error('[DB] upsertCiudadano:', err.message);
    return null;
  }
}

// Inserta la conversación si no existe; devuelve su ID de BD
async function upsertConversacion(folio, ciudadanoId) {
  try {
    await pool.query(
      'INSERT IGNORE INTO conversaciones (folio, ciudadano_id) VALUES (?, ?)',
      [folio, ciudadanoId]
    );
    const [[row]] = await pool.query(
      'SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL',
      [folio]
    );
    return row?.id ?? null;
  } catch (err) {
    console.error('[DB] upsertConversacion:', err.message);
    return null;
  }
}

// Guarda un mensaje en la BD
// origen: 'ciudadano' | 'bot' | 'agente' | 'sistema'
async function saveMessage(folio, { origen, texto, hora }) {
  try {
    const [[conv]] = await pool.query(
      'SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL',
      [folio]
    );
    if (!conv) return;
    await pool.query(
      'INSERT INTO mensajes (conversacion_id, origen, texto, hora) VALUES (?, ?, ?, ?)',
      [conv.id, origen, texto, hora || '']
    );
  } catch (err) {
    console.error('[DB] saveMessage:', err.message);
  }
}

// Actualiza campos de la conversación
async function updateConversacion(folio, changes = {}) {
  try {
    const fieldMap = {
      tipo:          'tipo',
      prioridad:     'prioridad',
      delito:        'delito',
      zona:          'zona',
      estado:        'estado',
      agente:        'agente',
      ai_confidence: 'ai_confidence',
      aiConfidence:  'ai_confidence',  // camelCase desde Claude
      recomendacion: 'recomendacion'
    };

    const sets = [];
    const values = [];
    const usedCols = new Set();

    for (const [key, col] of Object.entries(fieldMap)) {
      if (changes[key] !== undefined && !usedCols.has(col)) {
        sets.push(`\`${col}\` = ?`);
        values.push(changes[key]);
        usedCols.add(col);
      }
    }
    if (changes.aiPuntos !== undefined) {
      sets.push('`ai_puntos` = ?');
      values.push(JSON.stringify(changes.aiPuntos));
    }

    if (sets.length === 0) return;
    values.push(folio);
    await pool.query(
      `UPDATE conversaciones SET ${sets.join(', ')} WHERE folio = ? AND deleted_at IS NULL`,
      values
    );
  } catch (err) {
    console.error('[DB] updateConversacion:', err.message);
  }
}

module.exports = { saveSession, upsertCiudadano, upsertConversacion, saveMessage, updateConversacion };
