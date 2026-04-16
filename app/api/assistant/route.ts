import { NextRequest, NextResponse } from 'next/server';
import { KNOWLEDGE_MAP } from '@/lib/assistant-knowledge-map';

// Build a compact representation of the knowledge map for the AI prompt
const knowledgeMapSummary = KNOWLEDGE_MAP.map(a =>
  `- id: "${a.id}" | keywords: ${a.keywords.join(', ')}`
).join('\n');

export async function POST(req: NextRequest) {
  try {
    const { message, currentRoute } = await req.json() as { message: string; currentRoute: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Messaggio vuoto' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chiave API Gemini non configurata.' }, { status: 500 });
    }

    const prompt = `Sei un assistente integrato nell'applicazione gestionale "AC Chiari" (Azione Cattolica).
Il tuo compito è:
1. Rispondere in italiano in modo conciso e amichevole alla domanda dell'utente.
2. Identificare l'azione UI più appropriata dalla mappa seguente per guidare l'utente.

MAPPA AZIONI UI DISPONIBILI:
${knowledgeMapSummary}

PAGINA CORRENTE DELL'UTENTE: ${currentRoute}

ISTRUZIONI:
- Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza testo extra prima o dopo.
- Il JSON deve avere ESATTAMENTE questi due campi:
  {"reply": "Risposta testuale (max 3 frasi, italiano, tono amichevole)", "actionId": "id dalla mappa sopra oppure null"}
- Se la domanda è generica (es. "come stai?") o non riguarda la navigazione, usa actionId: null.
- Se non sai, usa actionId: null e spiega nel reply.

DOMANDA UTENTE: "${message.replace(/"/g, '\\"')}"`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      const msg = err.error?.message || `Errore Gemini API (${res.status})`;
      console.error('[Assistant API] Gemini error:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const data = await res.json();
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Parse JSON response — strip markdown code fences if present
    let parsed: { reply: string; actionId: string | null };
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback if JSON parsing fails
      return NextResponse.json({
        reply: raw.length > 20 ? raw.slice(0, 300) : 'Scusa, non sono riuscito a elaborare la risposta. Prova a riformulare la domanda.',
        action: null,
      });
    }

    // Resolve the action from the knowledge map
    const action = parsed.actionId
      ? KNOWLEDGE_MAP.find(a => a.id === parsed.actionId) ?? null
      : null;

    return NextResponse.json({
      reply: parsed.reply,
      action: action ? {
        id: action.id,
        route: action.route,
        selector: action.selector,
        sidebarAccordion: action.sidebarAccordion,
      } : null,
    });
  } catch (error) {
    console.error('[Assistant API] Error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
