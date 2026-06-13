// Datos de demostración para el panel (reemplazados por conversaciones reales de WhatsApp)
module.exports = [
  {
    id: 'ORU-2026-00231', phone: '59177700001', name: 'María Quispe', initials: 'MQ',
    channel: 'WhatsApp', time: '14:32',
    tipo: 'Emergencia', prioridad: 'Alta', delito: 'Violencia intrafamiliar',
    zona: 'Zona Sud', coordsLabel: 'calle Bolívar #240', coords: '-17.985, -67.118',
    estado: 'Nuevo', agente: 'Sin asignar', unread: true, aiConfidence: 96,
    preview: 'Por favor ayuda, mi esposo me está agrediendo, tengo miedo.',
    recomendacion: 'Despachar Radio Patrulla 110 y notificar a la FELCV de inmediato. Riesgo de vida.',
    aiPuntos: [
      'Agresión física en curso por parte de la pareja.',
      'Víctima encerrada en el baño — peligro inmediato.',
      'Dirección entregada: Zona Sud, calle Bolívar #240.',
      'Requiere intervención de la FELCV.'
    ],
    evidencia: ['audio.ogg', 'ubicación'],
    messages: [
      { from: 'bot', text: 'Hola, soy el asistente virtual de la Policía de Oruro. ¿En qué puedo ayudarle?', time: '14:28' },
      { from: 'ciudadano', text: 'Por favor ayuda, mi esposo me está agrediendo, tengo miedo', time: '14:29' },
      { from: 'bot', text: 'Entiendo que es una situación de emergencia. ¿Usted o alguien más está en peligro inmediato?', time: '14:29' },
      { from: 'ciudadano', text: 'Sí, estoy encerrada en el baño', time: '14:30' },
      { from: 'bot', text: 'He clasificado su caso como EMERGENCIA — Violencia intrafamiliar y notifiqué a una patrulla de la FELCV. ¿Me confirma su dirección?', time: '14:30' },
      { from: 'ciudadano', text: 'Zona Sud, calle Bolívar #240', time: '14:31' },
      { from: 'bot', text: 'Patrulla en camino. Mantenga la línea. Un oficial humano tomará su caso ahora.', time: '14:32' },
      { from: 'sistema', text: 'Caso escalado a operador humano · 14:32' }
    ],
    _offset: 1000
  },
  {
    id: 'ORU-2026-00230', phone: '59177700002', name: 'Carlos Mamani', initials: 'CM',
    channel: 'Web', time: '14:10',
    tipo: 'Denuncia', prioridad: 'Media', delito: 'Robo a vivienda',
    zona: 'Centro', coordsLabel: 'Av. 6 de Octubre #1450', coords: '-17.967, -67.114',
    estado: 'En proceso', agente: 'Sgto. Flores', unread: false, aiConfidence: 91,
    preview: 'Quiero denunciar que ingresaron a mi casa mientras no estábamos.',
    recomendacion: 'Registrar denuncia formal y derivar a FELCC. Solicitar inventario de bienes sustraídos.',
    aiPuntos: [
      'Robo a domicilio durante ausencia de los ocupantes.',
      'Sustracción de electrodomésticos y dinero en efectivo.',
      'Dirección: Centro, Av. 6 de Octubre #1450.'
    ],
    evidencia: ['foto1.jpg'],
    messages: [
      { from: 'bot', text: 'Bienvenido al canal de denuncias. ¿Qué desea reportar?', time: '14:05' },
      { from: 'ciudadano', text: 'Ingresaron a mi casa y robaron mientras no estábamos', time: '14:06' },
      { from: 'bot', text: 'Lamento lo ocurrido. ¿Qué objetos fueron sustraídos?', time: '14:06' },
      { from: 'ciudadano', text: 'Un televisor, una laptop y dinero en efectivo', time: '14:08' },
      { from: 'bot', text: 'Registré su denuncia como Robo a vivienda. Se generó el folio ORU-2026-00230 y fue derivado a la FELCC.', time: '14:09' },
      { from: 'agente', text: 'Buenas tardes, soy el Sgto. Flores. Necesito que pase mañana por la FELCC con su CI para ampliar la denuncia.', time: '14:10' }
    ],
    _offset: 2000
  },
  {
    id: 'ORU-2026-00229', phone: '59177700003', name: 'Ana Rojas', initials: 'AR',
    channel: 'WhatsApp', time: '13:48',
    tipo: 'Consulta', prioridad: 'Baja', delito: 'Requisitos de denuncia',
    zona: 'Zona Norte', coordsLabel: '—', coords: '-17.955, -67.108',
    estado: 'Nuevo', agente: 'Sin asignar', unread: true, aiConfidence: 88,
    preview: '¿Qué documentos necesito para hacer una denuncia por pérdida de documentos?',
    recomendacion: 'Consulta informativa. Puede ser resuelta automáticamente por el asistente.',
    aiPuntos: [
      'Solicita requisitos para denunciar pérdida de documentos.',
      'No constituye un hecho delictivo en curso.'
    ],
    evidencia: [],
    messages: [
      { from: 'ciudadano', text: 'Hola, ¿qué necesito para denunciar la pérdida de mi carnet?', time: '13:47' },
      { from: 'bot', text: 'Para una denuncia por pérdida de documentos necesita: su número de CI, lugar y fecha aproximada de la pérdida. Puede iniciarla aquí mismo. ¿Desea continuar?', time: '13:48' }
    ],
    _offset: 3000
  },
  {
    id: 'ORU-2026-00228', phone: '59177700004', name: 'Juan Pérez', initials: 'JP',
    channel: 'SMS', time: '13:21',
    tipo: 'Denuncia', prioridad: 'Alta', delito: 'Robo de vehículo',
    zona: 'Zona Este', coordsLabel: 'Mercado Fermín López', coords: '-17.972, -67.095',
    estado: 'En proceso', agente: 'Cabo Choque', unread: false, aiConfidence: 93,
    preview: 'Me robaron mi auto, un Toyota gris, estaba estacionado frente al mercado.',
    recomendacion: 'Emitir alerta de vehículo robado y notificar a Tránsito. Solicitar placa y características.',
    aiPuntos: [
      'Robo de vehículo Toyota color gris.',
      'Sustraído frente al Mercado Fermín López.',
      'Caso requiere alerta vehicular inmediata.'
    ],
    evidencia: ['placa.jpg'],
    messages: [
      { from: 'ciudadano', text: 'Me robaron mi auto frente al mercado', time: '13:19' },
      { from: 'bot', text: 'Lo siento. ¿Puede darme la placa y el modelo del vehículo?', time: '13:19' },
      { from: 'ciudadano', text: 'Toyota gris, placa 2345-ABC', time: '13:20' },
      { from: 'bot', text: 'Emití una alerta de vehículo robado y notifiqué a Tránsito. Folio ORU-2026-00228.', time: '13:21' }
    ],
    _offset: 4000
  },
  {
    id: 'ORU-2026-00227', phone: '59177700005', name: 'Lucía Vargas', initials: 'LV',
    channel: 'Web', time: '12:55',
    tipo: 'Emergencia', prioridad: 'Alta', delito: 'Accidente de tránsito',
    zona: 'Av. Cívica', coordsLabel: 'Av. Cívica esq. España', coords: '-17.963, -67.122',
    estado: 'Nuevo', agente: 'Sin asignar', unread: true, aiConfidence: 94,
    preview: 'Hubo un choque en la Av. Cívica, hay una persona herida en el suelo.',
    recomendacion: 'Despachar ambulancia y Tránsito. Posible lesionado, prioridad máxima.',
    aiPuntos: [
      'Accidente de tránsito con persona herida.',
      'Ubicación: Av. Cívica esquina España.',
      'Requiere ambulancia y unidad de Tránsito.'
    ],
    evidencia: ['foto.jpg'],
    messages: [
      { from: 'ciudadano', text: 'Choque en la Av. Cívica, hay un herido', time: '12:54' },
      { from: 'bot', text: 'Clasifiqué su reporte como EMERGENCIA — Accidente de tránsito. ¿La persona está consciente?', time: '12:54' },
      { from: 'ciudadano', text: 'No sé, está en el suelo', time: '12:55' },
      { from: 'bot', text: 'Despaché ambulancia y unidad de Tránsito. Un operador tomará su caso.', time: '12:55' }
    ],
    _offset: 5000
  },
  {
    id: 'ORU-2026-00226', phone: '59177700006', name: 'Pedro Condori', initials: 'PC',
    channel: 'WhatsApp', time: '11:40',
    tipo: 'Consulta', prioridad: 'Baja', delito: 'Horarios de atención',
    zona: 'Centro', coordsLabel: '—', coords: '-17.968, -67.115',
    estado: 'Cerrado', agente: 'Of. Gutiérrez (Tú)', unread: false, aiConfidence: 97,
    preview: '¿A qué hora atiende la FELCC los fines de semana?',
    recomendacion: 'Consulta resuelta automáticamente. Sin acción adicional requerida.',
    aiPuntos: [
      'Consulta sobre horario de atención de la FELCC.',
      'Resuelta por el asistente sin intervención.'
    ],
    evidencia: [],
    messages: [
      { from: 'ciudadano', text: '¿A qué hora atiende la FELCC los sábados?', time: '11:39' },
      { from: 'bot', text: 'La FELCC atiende sábados de 08:00 a 12:00. Para emergencias, marque 110 las 24 horas.', time: '11:40' },
      { from: 'sistema', text: 'Consulta resuelta automáticamente · 11:40' }
    ],
    _offset: 6000
  },
  {
    id: 'ORU-2026-00225', phone: '59177700007', name: 'Rosa Apaza', initials: 'RA',
    channel: 'WhatsApp', time: '10:18',
    tipo: 'Denuncia', prioridad: 'Media', delito: 'Estafa',
    zona: 'Zona Sud', coordsLabel: '—', coords: '-17.988, -67.120',
    estado: 'Nuevo', agente: 'Sin asignar', unread: false, aiConfidence: 85,
    preview: 'Me hicieron un depósito falso por la venta de un celular.',
    recomendacion: 'Registrar denuncia por estafa. Solicitar comprobantes y conversación con el estafador.',
    aiPuntos: [
      'Estafa mediante comprobante de depósito falso.',
      'La víctima ya entregó el producto vendido.',
      'Requiere recolección de evidencia digital.'
    ],
    evidencia: ['chat.png', 'recibo.jpg'],
    messages: [
      { from: 'ciudadano', text: 'Me estafaron con un depósito falso por un celular', time: '10:17' },
      { from: 'bot', text: 'Lamento lo ocurrido. ¿Conserva el comprobante y la conversación con la persona?', time: '10:17' },
      { from: 'ciudadano', text: 'Sí, tengo capturas de todo', time: '10:18' },
      { from: 'bot', text: 'Registré su denuncia por Estafa. Adjunte las capturas y un oficial la revisará.', time: '10:18' }
    ],
    _offset: 7000
  }
];
