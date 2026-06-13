require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const store = require('./store/conversations');
const seedData = require('./store/seed');
const apiRoutes = require('./routes/api');
const { connectWhatsApp, getWAInfo } = require('./bot/whatsapp');
const initDB = require('./db/init');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Cargar datos de demostración
store.seed(seedData);

// Propagar eventos del store a todos los clientes del panel
store.on('updated', (conv) => {
  io.emit('conversation:updated', conv);
});

app.set('io', io);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', apiRoutes);

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
  } catch (err) {
    console.error('❌ Error iniciando base de datos:', err.message);
    console.error('   Verifica las variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME en .env');
  }

  console.log('📡 Iniciando conexión WhatsApp...\n');
  connectWhatsApp(io).catch((err) => {
    console.error('❌ Error iniciando WhatsApp:', err.message);
  });
});
