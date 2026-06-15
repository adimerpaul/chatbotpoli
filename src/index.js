require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const store = require('./store/conversations');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');
const { connectWhatsApp, getWAInfo } = require('./bot/whatsapp');
const initDB = require('./db/init');
const db = require('./db/service');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Propagar eventos del store a todos los clientes del panel
store.on('updated', (conv) => {
  io.emit('conversation:updated', conv);
});
store.on('demo-cleared', (ids) => {
  io.emit('conversations:demo-cleared', { ids });
});

app.set('io', io);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Auth routes (sin protección — login público)
app.use('/api/auth', authRoutes);

// Todas las demás rutas API requieren token JWT válido
app.use('/api', authMiddleware, apiRoutes);

// Página de login
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// History mode: devolver index.html para cualquier ruta que no sea API ni assets
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/media')) return next();
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

io.on('connection', (socket) => {
  console.log(`🖥️  Panel conectado: ${socket.id}`);

  // Enviar estado actual de WhatsApp al cliente recién conectado
  const wa = getWAInfo();
  if (wa.status === 'qr' && wa.qrDataUrl) {
    socket.emit('whatsapp:qr', { qrDataUrl: wa.qrDataUrl });
  } else if (wa.status === 'ready') {
    socket.emit('whatsapp:ready', { phone: wa.phone });
  }

  socket.on('disconnect', () => {
    console.log(`🖥️  Panel desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`\n🚀 Panel CAC corriendo en http://localhost:${PORT}`);

  try {
    await initDB();
    const saved = await db.loadAllConversaciones();
    if (saved.length > 0) {
      store.load(saved);
      console.log(`📂 ${saved.length} conversaciones restauradas desde la BD`);
    } else {
      console.log('📂 BD vacía — panel listo para recibir conversaciones');
    }
  } catch (err) {
    console.error('❌ Error iniciando base de datos:', err.message);
    console.error('   Verifica las variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME en .env');
  }

  console.log('📡 Iniciando conexión WhatsApp...\n');
  connectWhatsApp(io).catch((err) => {
    console.error('❌ Error iniciando WhatsApp:', err.message);
  });
});
