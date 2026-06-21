const pool = require('./connection');
const bcrypt = require('bcryptjs');

const ALL_PERMS = ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado','eliminar_conversaciones','gestionar_usuarios','gestionar_bot','gestionar_conocimiento'];

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

    // Tabla: usuarios del panel
    await conn.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        username   VARCHAR(50) NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        nombre     VARCHAR(150) NOT NULL DEFAULT '',
        email      VARCHAR(150) NULL DEFAULT NULL,
        celular    VARCHAR(20)  NULL DEFAULT NULL,
        activo     TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla: permisos por usuario
    await conn.query(`
      CREATE TABLE IF NOT EXISTS permisos (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        permiso    VARCHAR(50) NOT NULL,
        CONSTRAINT fk_perm_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_perm (usuario_id, permiso)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla: base de conocimiento para el asistente IA
    await conn.query(`
      CREATE TABLE IF NOT EXISTS base_conocimiento (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        pregunta   VARCHAR(500) NOT NULL,
        respuesta  TEXT NOT NULL,
        activo     TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_activo (activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Datos por defecto en base de conocimiento
    const [[{ bcTotal }]] = await conn.query('SELECT COUNT(*) as bcTotal FROM base_conocimiento');
    if (bcTotal === 0) {
      const defaults = [
        ['¿Cuál es el número de ENDE (empresa de electricidad de Oruro)?',
         'El número de ENDE Oruro es 02-5250000. Para emergencias eléctricas también puede llamar al 800-10-3000 (línea gratuita nacional).'],
        ['¿Cuál es el número de EMAO (agua potable de Oruro)?',
         'El número de la Empresa Municipal de Agua Oruro (EMAO) es 02-5270000. Para reportar cortes de agua o fugas llame al mismo número en horario de oficina.'],
        ['¿Cuál es el número de emergencias de bomberos en Oruro?',
         'El número de Bomberos en Oruro es el 119. Para emergencias policiales llame al 110, para ambulancias al 118 y para defensoría de la niñez al 800-10-0900.'],
        ['¿Dónde queda la Comandancia de la Policía Boliviana en Oruro?',
         'La Comandancia Departamental de la Policía Boliviana en Oruro se encuentra en la Avenida Cívica esquina Bolívar, a media cuadra de la Plaza 10 de Febrero. Horario de atención: lunes a viernes de 08:00 a 16:00.'],
        ['¿Cuántas cuotas de aportación necesito para acceder a un préstamo en la Caja Nacional de Salud (CNS)?',
         'Para acceder a préstamos de la CNS generalmente se requiere un mínimo de 12 cuotas de aportación continuas como asegurado activo. Los montos y condiciones pueden variar; consulte directamente en oficinas CNS Oruro al 02-5275050.']
      ];
      for (const [pregunta, respuesta] of defaults) {
        await conn.query('INSERT INTO base_conocimiento (pregunta, respuesta) VALUES (?, ?)', [pregunta, respuesta]);
      }
      console.log('📚 Base de conocimiento inicializada con 5 entradas por defecto');
    }

    // Columna celular en usuarios (puede no existir en DBs antiguas)
    try { await conn.query("ALTER TABLE usuarios ADD COLUMN celular VARCHAR(20) NULL DEFAULT NULL"); } catch {}

    // Crear usuario admin por defecto si no existe
    const [[adminRow]] = await conn.query('SELECT id FROM usuarios WHERE username = ?', ['admin']);
    if (!adminRow) {
      const hash = await bcrypt.hash('admin1234', 10);
      await conn.query(
        'INSERT INTO usuarios (username, password, nombre) VALUES (?, ?, ?)',
        ['admin', hash, 'Administrador']
      );
      console.log('👤 Usuario admin creado  →  usuario: admin  /  contraseña: admin1234');
    }
    // Garantizar que admin siempre tenga todos los permisos (incluye permisos nuevos)
    const [[adminUser]] = await conn.query('SELECT id FROM usuarios WHERE username = ?', ['admin']);
    if (adminUser) {
      for (const perm of ALL_PERMS) {
        await conn.query('INSERT IGNORE INTO permisos (usuario_id, permiso) VALUES (?, ?)', [adminUser.id, perm]);
      }
    }

    // Seeder: 5 operadores de ejemplo
    const seedUsers = [
      { username: 'sgto.flores',    password: 'flores1234',    nombre: 'Sgto. Juan Flores',      celular: '72345678', permisos: ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado'] },
      { username: 'cabo.choque',    password: 'choque1234',    nombre: 'Cabo María Choque',       celular: '71234567', permisos: ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado'] },
      { username: 'sgto.mamani',    password: 'mamani1234',    nombre: 'Sgto. Pedro Mamani',      celular: '78901234', permisos: ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado'] },
      { username: 'of.gutierrez',   password: 'gutierrez1234', nombre: 'Of. Ana Gutiérrez',       celular: '69876543', permisos: ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado','eliminar_conversaciones'] },
      { username: 'insp.quispe',    password: 'quispe1234',    nombre: 'Insp. Carlos Quispe',     celular: '72109876', permisos: ['ver_conversaciones','enviar_mensajes','tomar_casos','cambiar_estado','gestionar_bot'] },
    ];
    for (const u of seedUsers) {
      const [[exists]] = await conn.query('SELECT id FROM usuarios WHERE username = ?', [u.username]);
      if (!exists) {
        const hash = await bcrypt.hash(u.password, 10);
        await conn.query(
          'INSERT INTO usuarios (username, password, nombre, celular) VALUES (?, ?, ?, ?)',
          [u.username, hash, u.nombre, u.celular]
        );
        const [[newUser]] = await conn.query('SELECT id FROM usuarios WHERE username = ?', [u.username]);
        for (const perm of u.permisos) {
          await conn.query('INSERT IGNORE INTO permisos (usuario_id, permiso) VALUES (?, ?)', [newUser.id, perm]);
        }
        console.log(`👤 Operador creado: ${u.nombre} (@${u.username} / ${u.password})`);
      }
    }

    // Tabla: auditoría de cambios (estilo laravel-auditing)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audits (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        evento          ENUM('created','updated','deleted','restored','system') NOT NULL,
        tabla           VARCHAR(50) NOT NULL,
        registro_id     VARCHAR(50) NOT NULL,
        usuario_id      INT NULL,
        usuario_nombre  VARCHAR(150) NULL,
        valores_antes   JSON NULL,
        valores_despues JSON NULL,
        ip              VARCHAR(45) NULL,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tabla_reg  (tabla, registro_id),
        INDEX idx_usuario    (usuario_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Columnas opcionales añadidas después del esquema original
    const alteraciones = [
      "ALTER TABLE conversaciones ADD COLUMN coords VARCHAR(100) NULL DEFAULT NULL",
      "ALTER TABLE conversaciones ADD COLUMN coords_label VARCHAR(255) NULL DEFAULT NULL",
      "ALTER TABLE base_conocimiento ADD COLUMN archivo_url VARCHAR(255) NULL DEFAULT NULL",
      "ALTER TABLE base_conocimiento ADD COLUMN archivo_nombre VARCHAR(255) NULL DEFAULT NULL"
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
