const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const store = require('../store/conversations');
const { analyzeConversation, generateBotResponse } = require('./claude');

let sock = null;
let ioRef = null;

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function connectWhatsApp(io) {
  ioRef = io;

  const authPath = path.join(__dirname, '../../.baileys_auth');
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Policia Oruro CAC', 'Chrome', '1.0.0'],
    getMessage: async () => ({ conversation: '' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('\n📱 Escanea el QR con WhatsApp para conectar\n');
      io.emit('whatsapp:qr', { qr });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado correctamente');
      io.emit('whatsapp:ready');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`⚠️  WhatsApp desconectado (código ${code})`);
      if (shouldReconnect) {
        console.log('🔄 Reconectando en 5s...');
        setTimeout(() => connectWhatsApp(io), 5000);
      } else {
        console.log('🚫 Sesión cerrada. Elimina .baileys_auth y reinicia para reconectar.');
        io.emit('whatsapp:logout');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return;
    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      await handleIncoming(msg);
    }
  });
}

async function handleIncoming(msg) {
  const jid = msg.key.remoteJid;
  if (!jid || jid.endsWith('@g.us')) return; // ignorar grupos

  const phone = jid.replace('@s.whatsapp.net', '');
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    '';

  if (!text) return;

  // Registrar conversación y mensaje del ciudadano
  store.getOrCreate(phone);
  store.addMessage(phone, { from: 'ciudadano', text, time: now() });

  // Emitir al panel inmediatamente
  if (ioRef) ioRef.emit('conversation:updated', store.get(phone));

  const conv = store.get(phone);

  // Solo el bot responde si el caso no fue tomado por un agente
  if (conv.agente !== 'Sin asignar') return;

  // Generar respuesta con Claude
  const botText = await generateBotResponse(conv.messages);
  if (!botText) return;

  // Enviar respuesta por WhatsApp
  try {
    await sock.sendMessage(jid, { text: botText });
  } catch (err) {
    console.error('[WhatsApp] Error enviando mensaje:', err.message);
  }

  // Guardar respuesta del bot en el store
  store.addMessage(phone, { from: 'bot', text: botText, time: now() });

  // Analizar la conversación actualizada
  const updated = store.get(phone);
  const analysis = await analyzeConversation(updated.messages);
  if (analysis) {
    store.update(phone, analysis);
  }

  if (ioRef) ioRef.emit('conversation:updated', store.get(phone));
}

async function sendMessage(phone, text) {
  if (!sock) throw new Error('WhatsApp no está conectado');
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

function isConnected() {
  return sock?.user != null;
}

module.exports = { connectWhatsApp, sendMessage, isConnected };
