const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const store = require('../store/conversations');
const { analyzeConversation, generateBotResponse } = require('./claude');
const db = require('../db/service');

const authPath = path.join(__dirname, '../../.baileys_auth');
const logger = pino({ level: 'silent' });

let sock = null;
let ioRef = null;
let currentQRDataUrl = null;
let connectedPhone = '';
let waStatus = 'connecting'; // 'connecting' | 'qr' | 'ready'

function getWAInfo() {
  return { status: waStatus, qrDataUrl: currentQRDataUrl, phone: connectedPhone };
}

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function connectWhatsApp(io) {
  ioRef = io;

  if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  let version;
  try {
    const result = await fetchLatestBaileysVersion();
    version = result.version;
    console.log('📋 WA versión:', version.join('.'));
  } catch (err) {
    console.warn('⚠️  No se pudo obtener versión WA, usando la de Baileys:', err.message);
  }

  sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    logger,
    browser: ['Chrome (Linux)', '', ''],
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrTerminal.generate(qr, { small: true });
      console.log('\n📱 QR listo — ve a "Conectar celular WA" en el panel\n');
      try {
        currentQRDataUrl = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (err) {
        console.error('[QR] Error generando imagen:', err.message);
        currentQRDataUrl = null;
      }
      waStatus = 'qr';
      io.emit('whatsapp:qr', { qrDataUrl: currentQRDataUrl });
    }

    if (connection === 'open') {
      connectedPhone = sock.user?.id?.split(':')[0] || '';
      currentQRDataUrl = null;
      waStatus = 'ready';
      console.log(`✅ WhatsApp conectado: +${connectedPhone}`);
      io.emit('whatsapp:ready', { phone: connectedPhone });
      db.saveSession(connectedPhone);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      waStatus = 'connecting';
      console.log(`⚠️  Desconectado — código: ${code}`);

      if (code === DisconnectReason.loggedOut) {
        // Borrar sesión y reconectar para mostrar QR nuevo
        console.log('🔄 Sesión expirada — borrando credenciales y reconectando...');
        clearAuthFolder();
      } else {
        console.log('🔄 Reconectando en 5s...');
      }
      setTimeout(() => connectWhatsApp(io), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    console.log(`📨 messages.upsert — type: ${type}, cantidad: ${msgs.length}`);
    if (type !== 'notify') {
      console.log(`   ↳ ignorado (type !== notify)`);
      return;
    }
    for (const msg of msgs) {
      console.log(`   ↳ from: ${msg.key.remoteJid} | fromMe: ${msg.key.fromMe}`);
      if (msg.key.fromMe) continue;
      await handleIncoming(msg);
    }
  });
}

function clearAuthFolder() {
  if (fs.existsSync(authPath)) {
    for (const f of fs.readdirSync(authPath)) {
      try { fs.unlinkSync(path.join(authPath, f)); } catch {}
    }
  }
}

async function handleIncoming(msg) {
  const jid = msg.key.remoteJid;
  console.log(`\n[MSG] jid: ${jid}`);

  if (!jid || jid.endsWith('@g.us')) {
    console.log(`[MSG] ignorado — es grupo o jid vacío`);
    return;
  }

  const phone = jid.replace('@s.whatsapp.net', '');
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    '';

  console.log(`[MSG] teléfono: ${phone}`);
  console.log(`[MSG] texto: "${text}"`);
  console.log(`[MSG] tipo de mensaje:`, Object.keys(msg.message || {}));

  if (!text) {
    console.log(`[MSG] ignorado — sin texto (puede ser imagen, audio, sticker, etc.)`);
    return;
  }

  store.getOrCreate(phone);
  const t = now();
  store.addMessage(phone, { from: 'ciudadano', text, time: t });
  if (ioRef) ioRef.emit('conversation:updated', store.get(phone));
  console.log(`[MSG] guardado en store y emitido al panel ✓`);

  // Persistir en MySQL: ciudadano → conversación → mensaje
  const conv = store.get(phone);
  const ciudadanoId = await db.upsertCiudadano(phone);
  if (ciudadanoId) {
    await db.upsertConversacion(conv.id, ciudadanoId);
    await db.saveMessage(conv.id, { origen: 'ciudadano', texto: text, hora: t });
    console.log(`[DB] mensaje ciudadano guardado ✓`);
  }

  const convCheck = store.get(phone);
  console.log(`[MSG] agente asignado: "${convCheck.agente}"`);
  if (convCheck.agente !== 'Sin asignar') {
    console.log(`[MSG] bot no responde — hay un agente tomando el caso`);
    return;
  }

  console.log(`[MSG] generando respuesta con Claude...`);
  const botText = await generateBotResponse(convCheck.messages);
  if (!botText) {
    console.log(`[MSG] Claude no devolvió respuesta`);
    return;
  }
  console.log(`[MSG] respuesta Claude: "${botText.slice(0, 80)}..."`);

  const tBot = now();
  try {
    await sock.sendMessage(jid, { text: botText });
    console.log(`[MSG] mensaje enviado por WhatsApp ✓`);
  } catch (err) {
    console.error(`[MSG] ERROR enviando WhatsApp:`, err.message);
  }

  store.addMessage(phone, { from: 'bot', text: botText, time: tBot });
  await db.saveMessage(convCheck.id, { origen: 'bot', texto: botText, hora: tBot });

  console.log(`[MSG] analizando conversación con Claude...`);
  const analysis = await analyzeConversation(store.get(phone).messages);
  if (analysis) {
    store.update(phone, analysis);
    await db.updateConversacion(convCheck.id, analysis);
    console.log(`[MSG] análisis guardado — tipo: ${analysis.tipo}, prioridad: ${analysis.prioridad}`);
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

async function resetSession(io) {
  if (sock) {
    try { sock.end(undefined, true); } catch {}
    sock = null;
  }
  clearAuthFolder();
  waStatus = 'connecting';
  currentQRDataUrl = null;
  connectedPhone = '';
  console.log('🗑️  Sesión borrada. Iniciando nueva conexión...');
  await connectWhatsApp(io || ioRef);
}

module.exports = { connectWhatsApp, sendMessage, isConnected, getWAInfo, resetSession };
