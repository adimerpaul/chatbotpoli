const pool = require('./connection');

async function initDB() {
  const conn = await pool.getConnection();
  try {
    // Tabla: sesiones del bot de WhatsApp
    await conn.query(`
      CREATE TABLE IF NOT EXISTS wa_sesiones (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        phone        VARCHAR(25) NOT NULL,
        connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at   DATETIME NULL DEFAULT NULL,
        INDEX idx_phone   (phone),
        INDEX idx_softdel (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla: ciudadanos que contactan por WhatsApp
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ciudadanos (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        phone           VARCHAR(25) NOT NULL,
        nombre          VARCHAR(150) NULL DEFAULT NULL,
        primer_contacto DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultimo_contacto DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at      DATETIME NULL DEFAULT NULL,
        UNIQUE KEY uq_phone (phone),
        INDEX idx_softdel (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla: conversaciones / casos
    await conn.query(`
      CREATE TABLE IF NOT EXISTS conversaciones (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        folio         VARCHAR(25) NOT NULL,
        ciudadano_id  INT NOT NULL,
        tipo          ENUM('Emergencia','Denuncia','Consulta') NOT NULL DEFAULT 'Consulta',
        prioridad     ENUM('Alta','Media','Baja') NOT NULL DEFAULT 'Baja',
        delito        VARCHAR(255) NOT NULL DEFAULT 'Por clasificar',
        zona          VARCHAR(150) NOT NULL DEFAULT 'Por determinar',
        estado        ENUM('Nuevo','En proceso','Cerrado') NOT NULL DEFAULT 'Nuevo',
        agente        VARCHAR(150) NOT NULL DEFAULT 'Sin asignar',
        ai_confidence TINYINT UNSIGNED NOT NULL DEFAULT 0,
        ai_puntos     JSON NULL DEFAULT NULL,
        recomendacion TEXT NULL DEFAULT NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at    DATETIME NULL DEFAULT NULL,
        UNIQUE KEY uq_folio (folio),
        CONSTRAINT fk_conv_ciudadano FOREIGN KEY (ciudadano_id) REFERENCES ciudadanos(id),
        INDEX idx_estado  (estado),
        INDEX idx_softdel (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla: mensajes de cada conversación
    await conn.query(`
      CREATE TABLE IF NOT EXISTS mensajes (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        conversacion_id  INT NOT NULL,
        origen           ENUM('ciudadano','bot','agente','sistema') NOT NULL,
        texto            TEXT NOT NULL,
        hora             VARCHAR(5) NOT NULL DEFAULT '',
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at       DATETIME NULL DEFAULT NULL,
        CONSTRAINT fk_msg_conv FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id),
        INDEX idx_conv    (conversacion_id),
        INDEX idx_softdel (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Columnas opcionales añadidas después del esquema original
    const alteraciones = [
      "ALTER TABLE conversaciones ADD COLUMN coords VARCHAR(100) NULL DEFAULT NULL",
      "ALTER TABLE conversaciones ADD COLUMN coords_label VARCHAR(255) NULL DEFAULT NULL"
    ];
    for (const sql of alteraciones) {
      try { await conn.query(sql); } catch {} // ignorar si ya existe
    }

    console.log('✅ Base de datos lista (tablas verificadas)');
  } finally {
    conn.release();
  }
}

module.exports = initDB;
