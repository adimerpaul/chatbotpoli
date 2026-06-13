const { EventEmitter } = require('events');

class ConversationStore extends EventEmitter {
  constructor() {
    super();
    this.conversations = new Map(); // phone -> conv
    this.byId = new Map();          // id -> phone
    this.counter = 231;
  }

  generateFolio() {
    this.counter++;
    return `ORU-2026-${String(this.counter).padStart(5, '0')}`;
  }

  getOrCreate(phone) {
    if (!this.conversations.has(phone)) {
      const id = this.generateFolio();
      const conv = this._blank(phone, id);
      this.conversations.set(phone, conv);
      this.byId.set(id, phone);
    }
    return this.conversations.get(phone);
  }

  _blank(phone, id) {
    return {
      id,
      phone,
      name: phone,
      initials: phone.slice(-2).toUpperCase(),
      channel: 'WhatsApp',
      time: now(),
      tipo: 'Consulta',
      prioridad: 'Baja',
      delito: 'Por clasificar',
      zona: 'Por determinar',
      coordsLabel: '—',
      coords: '—',
      estado: 'Nuevo',
      agente: 'Sin asignar',
      unread: true,
      aiConfidence: 0,
      preview: '',
      recomendacion: '',
      aiPuntos: [],
      evidencia: [],
      messages: [],
      createdAt: Date.now()
    };
  }

  get(phone) {
    return this.conversations.get(phone);
  }

  getById(id) {
    const phone = this.byId.get(id);
    return phone ? this.conversations.get(phone) : null;
  }

  getAll() {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  update(phone, changes) {
    const conv = this.conversations.get(phone);
    if (!conv) return null;
    Object.assign(conv, changes);
    this.emit('updated', conv);
    return conv;
  }

  addMessage(phone, msg) {
    const conv = this.conversations.get(phone);
    if (!conv) return null;
    conv.messages.push(msg);
    conv.time = msg.time || now();
    if (msg.from === 'ciudadano') {
      conv.unread = true;
      conv.preview = msg.text.slice(0, 120);
      conv.createdAt = Date.now();
    }
    this.emit('updated', conv);
    return conv;
  }

  seed(data) {
    for (const d of data) {
      this.conversations.set(d.phone, { ...d, createdAt: Date.now() - d._offset });
      this.byId.set(d.id, d.phone);
    }
  }
}

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

module.exports = new ConversationStore();
