// api/gemini-chat.js
// Endpoint sécurisé pour l'assistant technique IRATA d'EASTAV
// Utilise Gemini 2.5 Flash avec les documents TACS, ICOP et Annexes en contexte

import fs from 'fs';
import path from 'path';

// Chargement du contexte documentaire au démarrage (mis en cache)
let DOCS_CONTEXT = null;

function loadDocsContext() {
  if (DOCS_CONTEXT) return DOCS_CONTEXT;
  
  const docsDir = path.join(process.cwd(), 'api', 'irata-docs');
  const files = {
    TACS: 'TACS.txt',
    ICOP: 'ICOP.txt',
    ANNEX_R: 'ANNEX_R.txt',
    ANNEX_S: 'ANNEX_S.txt',
    ANNEX_T: 'ANNEX_T.txt',
  };

  const labels = {
    TACS: 'TACS — Training, Assessment and Certification Scheme (IRATA International)',
    ICOP: 'ICOP — International Code of Practice (IRATA International)',
    ANNEX_R: 'ICOP Annex R (IRATA International)',
    ANNEX_S: 'ICOP Annex S (IRATA International)',
    ANNEX_T: 'ICOP Annex T (IRATA International)',
  };

  let combined = '';
  for (const [key, filename] of Object.entries(files)) {
    const filePath = path.join(docsDir, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      combined += `\n\n===== ${labels[key]} =====\n\n${content}`;
    }
  }

  DOCS_CONTEXT = combined;
  return DOCS_CONTEXT;
}

const SYSTEM_PROMPT = `Eres el Consultor Técnico IRATA de EASTAV, un asistente experto, riguroso y con tono profesional y servicial.

Tu única fuente de verdad para responder consultas de certificación son los documentos oficiales de IRATA Internacional proporcionados: TACS, ICOP y sus Anexos R, S y T.

REGLAS FUNDAMENTALES:
1. PRECISIÓN EXTREMA: Si un dato no está explícitamente en los documentos oficiales, di claramente: "No dispongo de esa información exacta en el documento oficial, pero puedes validarlo directamente con nuestro equipo de jefes de formación en EASTAV."
2. CITA LA CLÁUSULA: Cuando respondas una norma estricta, añade al final la referencia exacta del documento (ej. "Ver apartado 4.3 del TACS" o "Según sección 5.2 del ICOP").
3. NUNCA INVENTES: Antes de responder, busca la información dentro de los documentos. Si no encuentras una referencia clara, indícalo.
4. DIFERENCIA claramente entre: Obligación, Recomendación, Buena práctica, Explicación técnica.

FLUJOS COMERCIALES:
- Si el usuario pregunta por REVALIDAR: explica el procedimiento y añade: "En EASTAV realizamos cursos de revalidación mensualmente en nuestras instalaciones de Sevilla. Consulta el calendario: https://www.eastav.com/categorias-de-formaciones/irata"
- Si el usuario pregunta por SUBIR DE NIVEL: recuérdale los requisitos de horas y añade: "Si ya cumples tus horas en el Logbook, EASTAV ofrece los niveles L2 y L3 con tasas de aprobado excelentes: https://www.eastav.com/categorias-de-formaciones/irata"
- Si el usuario es PRINCIPIANTE: explica el Nivel 1 y añade: "No necesitas experiencia previa para empezar. EASTAV te proporciona todo el EPI durante el curso: https://www.eastav.com/categorias-de-formaciones/irata"

CONTACTO EASTAV: formacion@eastav.com | Tel: +34 955083858 | WhatsApp: +34 625241994

IDIOMA: Responde en el mismo idioma en que te escriban. Si te escriben en inglés, responde en inglés. Si en español, en español.

TONO: Profesional, conciso, de colega técnico a colega técnico.`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://www.eastav.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message requis' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message trop long (max 2000 caractères)' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Configuration API manquante' });
  }

  try {
    const docsContext = loadDocsContext();

    // Construction de l'historique pour Gemini
    const contents = [];

    // Premier message : contexte documentaire complet
    if (history.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `Aquí están los documentos oficiales de IRATA Internacional que debes usar como única fuente de información:\n\n${docsContext}\n\n---\n\nPrimer mensaje del usuario: ${message}` }]
      });
    } else {
      // Conversations suivantes : historique + question
      for (const turn of history) {
        contents.push({
          role: turn.role,
          parts: [{ text: turn.content }]
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const err = await geminiResponse.text();
      console.error('Gemini API error:', err);
      return res.status(502).json({ error: 'Error en la API de Gemini' });
    }

    const data = await geminiResponse.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(502).json({ error: 'Respuesta vacía de Gemini' });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
