const Anthropic = require('@anthropic-ai/sdk');
const dbConocimiento = require('../db/conocimiento');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_BASE = `Eres el asistente virtual de la Policía Boliviana, División Oruro.
Tu función es atender al ciudadano de forma empática, clasificar su caso y recopilar información clave.

TIPOS DE CASO:
- Emergencia: Peligro inmediato (violencia activa, accidente con heridos, incendio)
- Denuncia: Reporte de delito ocurrido (robo, estafa, violencia doméstica)
- Consulta: Preguntas informativas sin delito activo

PRIORIDADES:
- Alta: Peligro de vida, delito en curso con víctima activa
- Media: Delito reciente con evidencia disponible, menor afectado
- Baja: Consulta informativa, situación resuelta

Responde siempre en español boliviano formal, de forma breve y clara.
Haz una sola pregunta por mensaje para recopilar: tipo de incidente, ubicación exacta, datos del denunciante.
Si detectas EMERGENCIA, notifica inmediatamente que se está enviando una unidad y pide confirmación de ubicación.
Nunca hagas más de 3 preguntas seguidas — escala al operador humano cuando tengas info suficiente.`;

async function buildSystemPrompt() {
  try {
    const entradas = await dbConocimiento.getActivos();
    if (entradas.length === 0) return SYSTEM_BASE;
    const kb = entradas.map((e, i) => `${i + 1}. Pregunta: ${e.pregunta}\n   Respuesta: ${e.respuesta}`).join('\n\n');
    return `${SYSTEM_BASE}\n\nBASE DE CONOCIMIENTO INSTITUCIONAL (usa esta información exacta cuando el ciudadano pregunte sobre estos temas):\n${kb}`;
  } catch {
    return SYSTEM_BASE;
  }
}

// Busca si el mensaje del ciudadano coincide con alguna entrada KB que tenga imagen adjunta.
// Devuelve { archivo_url, archivo_nombre } o null.
async function findKBFile(userMessage) {
  try {
    const entradas = await dbConocimiento.getActivos();
    const msg = normalize(userMessage);
    const stopWords = new Set(['que','con','los','las','del','una','para','por','como','cual','son','hay','esta','este','sus','nos','mas','pero','sido']);

    for (const e of entradas) {
      if (!e.archivo_url) continue;
      const words = normalize(e.pregunta)
        .split(/[\s,?¿!¡.;:()\-]+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
      const hits = words.filter(w => msg.includes(w));
      console.log(`[KB-file] entrada #${e.id} → palabras: [${words.join(',')}] | hits: [${hits.join(',')}]`);
      if (hits.length >= 1) {
        console.log(`[KB-file] MATCH entrada #${e.id} → ${e.archivo_url}`);
        return { archivo_url: e.archivo_url, archivo_nombre: e.archivo_nombre };
      }
    }
    console.log('[KB-file] sin match para:', msg);
    return null;
  } catch (err) {
    console.error('[KB-file] error:', err.message);
    return null;
  }
}

function normalize(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/[^\w\s]/g, ' ');
}

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

    const raw = response.content[0].text.trim();
    // El modelo a veces envuelve el JSON en ```json ... ``` — los limpiamos antes de parsear
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(clean);
    console.log(`[Claude] Análisis OK — tipo: ${result.tipo}, prioridad: ${result.prioridad}, conf: ${result.aiConfidence}%`);
    return result;
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
    const systemPrompt = await buildSystemPrompt();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages: history
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error('[Claude] Error generando respuesta:', err.message);
    return 'Gracias por contactarnos. Un operador revisará su caso en breve.';
  }
}

module.exports = { analyzeConversation, generateBotResponse, findKBFile };
