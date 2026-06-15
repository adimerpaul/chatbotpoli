const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const store = require('../store/conversations');
const { analyzeConversation, generateBotResponse } = require('./claude');
const db = require('../db/service');

const authPath  = path.join(__dirname, '../../.baileys_auth');
const mediaDir  = path.join(__dirname, '../../public/media');
const logger    = pino({ level: 'silent' });

if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

let sock = null;
let ioRef = null;
let currentQRDataUrl = null;
let connectedPhone = '';
let waStatus = 'connecting'; // 'connecting' | 'qr' | 'ready'
let botEnabled = true;

function getWAInfo() {
  return { status: waStatus, qrDataUrl: currentQRDataUrl, phone: connectedPhone };
}

function getBotEnabled() { return botEnabled; }
function setBotEnabled(val) { botEnabled = !!val; }

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

// Descarga un buffer de media y lo guarda en public/media/
async function saveMedia(msg, ext) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(mediaDir, filename), buffer);
    return `/media/${filename}`;
  } catch (err) {
    console.error('[MEDIA] Error descargando:', err.message);
    return null;
  }
}

// Extrae el contenido de cualquier tipo de mensaje WA
async function extractContent(msg) {
  const m = msg.message || {};

  // Texto plano
  if (m.conversation)
    return { type: 'text', text: m.conversation };

  // Texto extendido (links, respuestas, etc.)
  if (m.extendedTextMessage?.text)
    return { type: 'text', text: m.extendedTextMessage.text };

  // Imagen
  if (m.imageMessage) {
    const mediaUrl = await saveMedia(msg, 'jpg');
    return { type: 'image', text: m.imageMessage.caption || '', mediaUrl };
  }

  // Video
  if (m.videoMessage) {
    const mediaUrl = await saveMedia(msg, 'mp4');
    return { type: 'video', text: m.videoMessage.caption || '', mediaUrl };
  }

  // Audio / voz
  if (m.audioMessage) {
    const isPtt = m.audioMessage.ptt;
    const mediaUrl = await saveMedia(msg, 'ogg');
    return { type: 'audio', text: isPtt ? '🎤 Nota de voz' : '🎵 Audio', mediaUrl };
  }

  // Documento
  if (m.documentMessage) {
    const ext = m.documentMessage.fileName?.split('.').pop() || 'bin';
    const mediaUrl = await saveMedia(msg, ext);
    return { type: 'document', text: m.documentMessage.fileName || 'Archivo', mediaUrl };
  }

  // Ubicación
  if (m.locationMessage) {
    const { degreesLatitude: lat, degreesLongitude: lng } = m.locationMessage;
    return { type: 'location', text: '📍 Ubicación compartida', lat, lng };
  }

  // Ubicación en vivo
  if (m.liveLocationMessage) {
    const { degreesLatitude: lat, degreesLongitude: lng } = m.liveLocationMessage;
    return { type: 'location', text: '📍 Ubicación en vivo', lat, lng };
  }

  // Sticker — ignorar silenciosamente
  if (m.stickerMessage) return null;

  // Tipo desconocido — registrar para debug
  const tipos = Object.keys(m);
  console.log(`[MSG] tipo no soportado:`, tipos);
  return null;
}

async function handleIncoming(msg) {
  const jid = msg.key.remoteJid;
  if (!jid || jid.endsWith('@g.us')) return;

  // WhatsApp LID (@lid): ID de privacidad — el número real está en senderPn
  const phone = jid.endsWith('@lid')
    ? (msg.key.senderPn || '').split('@')[0]
    : jid.split('@')[0].split(':')[0];

  if (!phone) {
    console.log('[MSG] ignorado — no se pudo extraer número de teléfono', jid);
    return;
  }
  console.log(`\n[MSG] de: ${phone} | tipos:`, Object.keys(msg.message || {}));

  const content = await extractContent(msg);
  if (!content) {
    console.log(`[MSG] ignorado — tipo sin soporte`);
    return;
  }
  console.log(`[MSG] tipo: ${content.type} | texto: "${content.text?.slice(0, 60)}"`);

  const t = now();

  // Limpiar conversaciones demo al llegar el primer mensaje real
  store.clearDemo();

  // Si la conversación anterior está cerrada, retirarla del store para que getOrCreate abra una nueva
  const prevConv = store.get(phone);
  if (prevConv && prevConv.estado === 'Cerrado') {
    console.log(`[MSG] conversación cerrada detectada — iniciando nueva para ${phone}`);
    store.remove(phone);
  }

  store.getOrCreate(phone);

  // Actualizar nombre con el del contacto de WhatsApp si está disponible
  const waName = msg.pushName || '';
  if (waName) {
    store.update(phone, {
      name: waName,
      initials: waName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    });
  }

  // Armar el objeto de mensaje para el store
  const storeMsg = { from: 'ciudadano', type: content.type, text: content.text, time: t };
  if (content.mediaUrl) storeMsg.mediaUrl = content.mediaUrl;
  if (content.lat !== undefined) { storeMsg.lat = content.lat; storeMsg.lng = content.lng; }

  store.addMessage(phone, storeMsg);

  // Actualizar evidencia y coordenadas en la conversación
  if (content.mediaUrl) {
    const conv = store.get(phone);
    store.update(phone, { evidencia: [...(conv.evidencia || []), content.mediaUrl] });
  }
  if (content.type === 'location' && content.lat !== undefined) {
    store.update(phone, {
      coords: `${content.lat.toFixed(5)}, ${content.lng.toFixed(5)}`,
      coordsLabel: '📍 Enviada por ciudadano'
    });
  }

  if (ioRef) ioRef.emit('conversation:updated', store.get(phone));

  // Persistir en BD
  const conv = store.get(phone);
  const ciudadanoId = await db.upsertCiudadano(phone, waName || null);
  // console.log('ciudadanoId:', ciudadanoId);
  if (ciudadanoId) {
    await db.upsertConversacion(conv.id, ciudadanoId);
    const dbTexto = content.type === 'location'
      ? `${content.text} [${content.lat},${content.lng}]`
      : content.mediaUrl ? `${content.text} [${content.mediaUrl}]` : content.text;
    await db.saveMessage(conv.id, { origen: 'ciudadano', texto: dbTexto || content.type, hora: t });
    if (content.type === 'location' && content.lat !== undefined) {
      await db.updateConversacion(conv.id, {
        coords:      `${content.lat.toFixed(5)}, ${content.lng.toFixed(5)}`,
        coordsLabel: '📍 Enviada por ciudadano'
      });
    }
  }

  // El bot solo responde a mensajes de texto; para media avisa que lo revisarán
  const convCheck = store.get(phone);
  if (convCheck.agente !== 'Sin asignar') {
    console.log(`[MSG] caso asignado a "${convCheck.agente}" — bot no responde`);
    return;
  }

  if (!botEnabled) {
    console.log(`[MSG] bot desactivado — sin respuesta automática`);
    if (ioRef) ioRef.emit('conversation:updated', store.get(phone));
    return;
  }

  let botText;
  if (content.type === 'text') {
    console.log(`[MSG] generando respuesta con Claude...`);
    botText = await generateBotResponse(convCheck.messages);
  } else {
    const acks = {
      image:    'Recibimos tu foto. Un agente la revisará pronto.',
      video:    'Recibimos tu video. Un agente lo revisará pronto.',
      audio:    'Recibimos tu nota de voz. Un agente la escuchará pronto.',
      document: 'Recibimos tu archivo. Un agente lo revisará pronto.',
      location: 'Recibimos tu ubicación. Un agente coordinará el apoyo.'
    };
    botText = acks[content.type] || 'Recibimos tu mensaje. Un agente lo atenderá pronto.';
  }

  if (botText) {
    const tBot = now();
    try {
      await sock.sendMessage(jid, { text: botText });
      console.log(`[MSG] respuesta enviada ✓`);
    } catch (err) {
      console.error(`[MSG] ERROR enviando:`, err.message);
    }
    store.addMessage(phone, { from: 'bot', type: 'text', text: botText, time: tBot });
    await db.saveMessage(convCheck.id, { origen: 'bot', texto: botText, hora: tBot });
  }

  // El análisis corre SIEMPRE en mensajes de texto, independientemente de si el bot respondió.
  // Es lo que actualiza tipo, prioridad y delito en tiempo real.
  if (content.type === 'text') {
    const analysis = await analyzeConversation(store.get(phone).messages);
    if (analysis) {
      store.update(phone, analysis);
      await db.updateConversacion(convCheck.id, analysis);
      console.log(`[MSG] tipo actualizado → ${analysis.tipo} (${analysis.prioridad})`);
    }
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

module.exports = { connectWhatsApp, sendMessage, isConnected, getWAInfo, resetSession, getBotEnabled, setBotEnabled };
