const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const sharp   = require('sharp');
const { authMiddleware } = require('../middleware/auth');
const db = require('../db/conocimiento');

const KB_DIR = path.join(__dirname, '../../public/media/kb');
console.log('[KB] directorio:', KB_DIR);
try {
  fs.mkdirSync(KB_DIR, { recursive: true });
  console.log('[KB] directorio OK (creado o ya existía)');
} catch (e) {
  console.error('[KB] ERROR creando directorio:', e.message);
}

// Multer guarda en memoria — sharp convierte a WebP antes de escribir al disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/i.test(path.extname(file.originalname));
    cb(ok ? null : new Error('Solo se permiten imágenes (jpg, png, gif, webp)'), ok);
  }
});

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

// Subir imagen adjunta — convierte a WebP, no borra la imagen anterior del disco
router.post('/:id/archivo', authMiddleware, (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_conocimiento')) return res.status(403).json({ error: 'Sin permisos' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  try {
    const filename = `kb_${Date.now()}.webp`;
    const dest     = path.join(KB_DIR, filename);

    console.log('[KB] archivo recibido:', req.file.originalname, req.file.size, 'bytes');
    console.log('[KB] destino:', dest);
    console.log('[KB] directorio existe?', fs.existsSync(KB_DIR));

    // Garantizar que el directorio exista justo antes de escribir
    fs.mkdirSync(KB_DIR, { recursive: true });

    const info = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(dest);
    console.log('[KB] WebP guardado:', info);

    const archivo_url    = `/media/kb/${filename}`;
    const archivo_nombre = path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.webp';
    await db.updateArchivo(req.params.id, { archivo_url, archivo_nombre });
    res.json({ ok: true, archivo_url, archivo_nombre });
  } catch (err) {
    console.error('[KB] ERROR en upload:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quitar imagen adjunta (solo limpia la referencia en BD, no borra el archivo físico)
router.delete('/:id/archivo', authMiddleware, async (req, res) => {
  if (!req.user.permisos.includes('gestionar_conocimiento')) return res.status(403).json({ error: 'Sin permisos' });
  try {
    await db.updateArchivo(req.params.id, { archivo_url: null, archivo_nombre: null });
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
