const { EventEmitter } = require('events');

class ConversationStore extends EventEmitter {
  constructor() {
    super();
    this.conversations = new Map(); // folio  → conv  (antes era phone → conv)
    this.byPhone       = new Map(); // phone  → folio (el folio activo por teléfono para el bot WA)
    this.counter = 231;
  }

  generateFolio() {
    this.counter++;
    return `ORU-2026-${String(this.counter).padStart(5, '0')}`;
  }

  // El bot llama esto cuando llega un mensaje; devuelve la conversación activa del teléfono
  getOrCreate(phone) {
    const folio = this.byPhone.get(phone);
    if (!folio) {
      const id = this._newFolio(phone);
      return this.conversations.get(id);
    }
    return this.conversations.get(folio);
  }

  _newFolio(phone) {
    const id  = this.generateFolio();
    const conv = this._blank(phone, id);
    this.conversations.set(id, conv);
    this.byPhone.set(phone, id);
    return id;
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

  // Obtiene la conversación activa de un teléfono (para el bot WA)
  get(phone) {
    const folio = this.byPhone.get(phone);
    return folio ? this.conversations.get(folio) : null;
  }

  // Obtiene por folio (para las rutas API)
  getById(id) {
    return this.conversations.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Actualiza por teléfono (el bot / rutas que conocen el phone)
  update(phone, changes) {
    const folio = this.byPhone.get(phone);
    if (!folio) return null;
    const conv = this.conversations.get(folio);
    if (!conv) return null;
    Object.assign(conv, changes);
    this.emit('updated', conv);
    return conv;
  }

  // Actualiza por folio (rutas PATCH que reciben el id directamente)
  updateById(id, changes) {
    const conv = this.conversations.get(id);
    if (!conv) return null;
    Object.assign(conv, changes);
    this.emit('updated', conv);
    return conv;
  }

  addMessage(phone, msg) {
    const conv = this.get(phone);
    if (!conv) return null;
    conv.messages.push(msg);
    conv.time = msg.time || now();
    if (msg.from === 'ciudadano') {
      conv.unread = true;
      const previewMap = { image: '📷 Foto', video: '🎥 Video', audio: '🎤 Audio', document: '📄 Archivo', location: '📍 Ubicación' };
      conv.preview = (msg.type && previewMap[msg.type])
        ? previewMap[msg.type] + (msg.text ? ' · ' + msg.text.slice(0, 80) : '')
        : (msg.text || '').slice(0, 120);
      conv.createdAt = Date.now();
    }
    this.emit('updated', conv);
    return conv;
  }

  seed(data) {
    for (const d of data) {
      const conv = { ...d, _demo: true, createdAt: Date.now() - d._offset };
      this.conversations.set(d.id, conv);
      this.byPhone.set(d.phone, d.id);
    }
  }

  clearDemo() {
    const removed = [];
    for (const [id, conv] of this.conversations) {
      if (conv._demo) {
        removed.push(conv.id);
        if (this.byPhone.get(conv.phone) === id) this.byPhone.delete(conv.phone);
        this.conversations.delete(id);
      }
    }
    if (removed.length) this.emit('demo-cleared', removed);
  }

  // Elimina por teléfono (elimina la conversación activa de ese teléfono)
  remove(phone) {
    const folio = this.byPhone.get(phone);
    if (!folio) return;
    this.conversations.delete(folio);
    this.byPhone.delete(phone);
  }

  // Elimina por folio (usado por la ruta DELETE /conversations/:id)
  removeById(id) {
    const conv = this.conversations.get(id);
    if (!conv) return;
    // Si este folio es el activo para ese teléfono, limpiar el índice
    if (this.byPhone.get(conv.phone) === id) this.byPhone.delete(conv.phone);
    this.conversations.delete(id);
  }

  clear() {
    this.conversations.clear();
    this.byPhone.clear();
  }

  // Hidrata el store desde la BD; todas las conversaciones, cada una con su folio propio
  load(data) {
    for (const d of data) {
      this.conversations.set(d.id, { ...d });
      // byPhone apunta siempre al folio más reciente (datos vienen ordenados ASC por created_at)
      this.byPhone.set(d.phone, d.id);
      const match = d.id.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > this.counter) this.counter = num;
      }
    }
  }
}

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

module.exports = new ConversationStore();
