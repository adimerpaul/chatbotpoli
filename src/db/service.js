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
async function upsertCiudadano(phone, nombre = null) {
  try {
    // await pool.query(
    //   `INSERT INTO ciudadanos (phone)
    //    VALUES (?)
    //    ON DUPLICATE KEY UPDATE ultimo_contacto = NOW()`,
    //   [phone]
    // );
    findCiudadano = await pool.query(
      'SELECT id FROM ciudadanos WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    if (findCiudadano[0].length === 0) {
      await pool.query(
        'INSERT INTO ciudadanos (phone, nombre) VALUES (?, ?)',
        [phone, nombre || phone]
      );
    }else {
      await pool.query(
        'UPDATE ciudadanos SET ultimo_contacto = NOW() WHERE phone = ? AND deleted_at IS NULL',
        [phone]
      );
    }
    return findCiudadano[0][0]?.id ?? null;
    // if (nombre) {
    //   // Solo actualiza nombre si aún está vacío o era el teléfono como placeholder
    //   await pool.query(
    //     'UPDATE ciudadanos SET nombre = ? WHERE phone = ? AND (nombre IS NULL OR nombre = phone)',
    //     [nombre, phone]
    //   );
    // }
    // const [[row]] = await pool.query(
    //   'SELECT id FROM ciudadanos WHERE phone = ? AND deleted_at IS NULL',
    //   [phone]
    // );
    // return row?.id ?? null;
  } catch (err) {
    console.error('[DB] upsertCiudadano:', err.message);
    return null;
  }
}

// Inserta la conversación si no existe; devuelve su ID de BD
async function upsertConversacion(folio, ciudadanoId) {
  try {
    // console.log(folio, ciudadanoId)
    // await pool.query(
    //   'INSERT IGNORE INTO conversaciones (folio, ciudadano_id) VALUES (?, ?)',
    //   [folio, ciudadanoId]
    // );
    // const [[row]] = await pool.query(
    //   'SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL',
    //   [folio]
    // );
    // return row?.id ?? null;
    const findCoversacion = await pool.query(
      'SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL and estado != "Cerrado"',
      [folio]
    );
    if (findCoversacion[0].length === 0) {
      await pool.query(
        'INSERT INTO conversaciones (folio, ciudadano_id) VALUES (?, ?)',
        [folio, ciudadanoId]
      );
      const [[row]] = await pool.query(
        'SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL',
        [folio]
      );
      return row?.id ?? null;
    }else{
      await pool.query(
        'UPDATE conversaciones SET updated_at = NOW() WHERE folio = ? AND deleted_at IS NULL',
        [folio]
      );
      const [[row]] = await pool.query(
        'SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL',
        [folio]
      );
      return row?.id ?? null;
    }
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
      aiConfidence:  'ai_confidence',
      recomendacion: 'recomendacion',
      coords:        'coords',
      coordsLabel:   'coords_label'
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

// Reconstruye el objeto de mensaje desde el texto guardado en BD
function parseMsgFromDB(row) {
  const texto = row.texto || '';

  // Ubicación: "texto [lat,lng]"
  const locMatch = texto.match(/\[(-?\d+\.?\d*),(-?\d+\.?\d*)\]$/);
  if (locMatch) {
    return {
      from: row.origen, type: 'location',
      text: texto.replace(/\s*\[.*\]$/, '').trim(),
      lat: parseFloat(locMatch[1]), lng: parseFloat(locMatch[2]),
      time: row.hora
    };
  }

  // Media: "texto [/media/archivo.ext]"
  const mediaMatch = texto.match(/\[(\S+\/media\/\S+)\]$/);
  if (mediaMatch) {
    const url = mediaMatch[1];
    const ext = url.split('.').pop().toLowerCase();
    let type = 'document';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) type = 'image';
    else if (['mp4','mov','avi','webm'].includes(ext))   type = 'video';
    else if (['ogg','mp3','m4a','opus','wav'].includes(ext)) type = 'audio';
    return {
      from: row.origen, type,
      text: texto.replace(/\s*\[.*\]$/, '').trim(),
      mediaUrl: url, time: row.hora
    };
  }

  return { from: row.origen, type: 'text', text: texto, time: row.hora };
}

// Carga todas las conversaciones activas con sus mensajes para hidratar el store al arrancar
async function loadAllConversaciones() {
  try {
    const [convRows] = await pool.query(`
      SELECT c.folio, c.tipo, c.prioridad, c.delito, c.zona,
             c.estado, c.agente, c.ai_confidence, c.ai_puntos,
             c.recomendacion, c.coords, c.coords_label, c.created_at,
             ci.phone, ci.nombre
      FROM conversaciones c
      JOIN ciudadanos ci ON ci.id = c.ciudadano_id
      WHERE c.deleted_at IS NULL AND ci.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `);

    if (convRows.length === 0) return [];

    const folios = convRows.map(r => r.folio);
    const [msgRows] = await pool.query(`
      SELECT m.origen, m.texto, m.hora, c.folio
      FROM mensajes m
      JOIN conversaciones c ON c.id = m.conversacion_id
      WHERE c.folio IN (?) AND m.deleted_at IS NULL
      ORDER BY m.id ASC
    `, [folios]);

    const msgsByFolio = {};
    for (const row of msgRows) {
      if (!msgsByFolio[row.folio]) msgsByFolio[row.folio] = [];
      msgsByFolio[row.folio].push(parseMsgFromDB(row));
    }

    return convRows.map(r => {
      const messages = msgsByFolio[r.folio] || [];
      const lastCiudadano = [...messages].reverse().find(m => m.from === 'ciudadano');
      const aiPuntos = r.ai_puntos ? JSON.parse(r.ai_puntos) : [];
      const name = r.nombre || r.phone;
      const parts = name.trim().split(/\s+/);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : name.slice(-2).toUpperCase();
      const lastMsg = messages[messages.length - 1];

      // Reconstruir evidencia desde mensajes con mediaUrl
      const evidencia = messages
        .filter(m => m.from === 'ciudadano' && m.mediaUrl)
        .map(m => m.mediaUrl);

      // Preview: último mensaje del ciudadano (texto o label de media)
      const previewMap = { image:'📷 Foto', video:'🎥 Video', audio:'🎤 Audio', document:'📄 Archivo', location:'📍 Ubicación' };
      const preview = lastCiudadano
        ? (previewMap[lastCiudadano.type] || lastCiudadano.text || '').slice(0, 120)
        : '';

      return {
        id:           r.folio,
        phone:        r.phone,
        name,
        initials,
        channel:      'WhatsApp',
        time:         lastMsg?.time || '00:00',
        tipo:         r.tipo,
        prioridad:    r.prioridad,
        delito:       r.delito,
        zona:         r.zona,
        coordsLabel:  r.coords_label || '—',
        coords:       r.coords       || '—',
        estado:       r.estado,
        agente:       r.agente,
        unread:       false,
        aiConfidence: r.ai_confidence,
        preview,
        recomendacion: r.recomendacion || '',
        aiPuntos,
        evidencia,
        messages,
        createdAt:    new Date(r.created_at).getTime()
      };
    });
  } catch (err) {
    console.error('[DB] loadAllConversaciones:', err.message);
    return [];
  }
}

// Soft delete: marca la conversación y sus mensajes con deleted_at
async function deleteConversacion(folio) {
  try {
    await pool.query(`
      UPDATE mensajes SET deleted_at = NOW()
      WHERE conversacion_id = (
        SELECT id FROM conversaciones WHERE folio = ? AND deleted_at IS NULL
      ) AND deleted_at IS NULL
    `, [folio]);
    await pool.query(
      'UPDATE conversaciones SET deleted_at = NOW() WHERE folio = ? AND deleted_at IS NULL',
      [folio]
    );
  } catch (err) {
    console.error('[DB] deleteConversacion:', err.message);
    throw err;
  }
}

// Truncate completo de todas las tablas de conversaciones (para desarrollo/reset)
async function truncateAll() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE mensajes');
    await conn.query('TRUNCATE TABLE conversaciones');
    await conn.query('TRUNCATE TABLE ciudadanos');
    await conn.query('TRUNCATE TABLE wa_sesiones');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

module.exports = { saveSession, upsertCiudadano, upsertConversacion, saveMessage, updateConversacion, loadAllConversaciones, deleteConversacion, truncateAll };
