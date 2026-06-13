const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `Eres el asistente virtual de la Policía Boliviana, División Oruro.
Tu función es atender al ciudadano de forma empática, clasificar su caso y recopilar información clave.

TIPOS DE CASO:
- Emergencia: Peligro inmediato (violencia activa, accidente con heridos, incendio)
- Denuncia: Reporte de delito ocurrido (robo, estafa, violencia doméstica)
- Consulta: Preguntas informativas sin delito activo

PRIORIDADES:
- Alta: Peligro de vida, delito en curso con víctima activa
- Media: Delito reciente con evidencia disponible, menor afectado
- Baja: Consulta informativa, situación resuelta

Responde siempre en español boliviano, de forma breve y clara.
Haz una sola pregunta por mensaje para recopilar: tipo de incidente, ubicación exacta, datos del denunciante.
Si detectas EMERGENCIA, notifica inmediatamente que se está enviando una unidad y pide confirmación de ubicación.
Nunca hagas más de 3 preguntas seguidas — escala al operador humano cuando tengas info suficiente.`;

async function analyzeConversation(messages) {
  const relevant = messages.filter(m => m.from !== 'sistema');
  if (relevant.length < 2) return null;

  const transcript = relevant
    .map(m => {
      const label = m.from === 'ciudadano' ? 'Ciudadano' : m.from === 'bot' ? 'Asistente' : 'Agente';
      return `${label}: ${m.text}`;
    })
    .join('\n');

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analiza esta conversación de la línea de atención policial y devuelve SOLO un JSON válido:
{
  "tipo": "Emergencia|Denuncia|Consulta",
  "prioridad": "Alta|Media|Baja",
  "delito": "descripción breve del tipo de caso",
  "zona": "zona o dirección mencionada, o 'Por determinar'",
  "aiConfidence": 0-100,
  "aiPuntos": ["punto clave 1", "punto clave 2"],
  "recomendacion": "acción concreta para el operador policial"
}

Conversación:
${transcript}`
      }]
    });

    return JSON.parse(response.content[0].text.trim());
  } catch (err) {
    console.error('[Claude] Error en análisis:', err.message);
    return null;
  }
}

async function generateBotResponse(messages) {
  const history = messages
    .filter(m => m.from !== 'sistema')
    .map(m => ({
      role: m.from === 'ciudadano' ? 'user' : 'assistant',
      content: m.text
    }));

  if (history.length === 0) return null;

  // Anthropic requiere que el último mensaje sea del user
  if (history[history.length - 1].role !== 'user') return null;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: history
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error('[Claude] Error generando respuesta:', err.message);
    return 'Gracias por contactarnos. Un operador revisará su caso en breve.';
  }
}

module.exports = { analyzeConversation, generateBotResponse };
