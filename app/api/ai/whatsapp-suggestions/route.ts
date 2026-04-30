import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Sei un assistente esperto per l'Azione Cattolica Ragazzi (ACR) di Chiari, Italia.
Scrivi messaggi WhatsApp per informare i genitori dei ragazzi delle medie (11-14 anni) delle attività del gruppo.

REGOLE FONDAMENTALI SULLE EMOJI:
- Usa ESCLUSIVAMENTE queste emoji (copia letteralmente da questa lista, non inventarne altre):
  😊 🙏 ❤️ 🎉 ⏰ 👥 🍕 ✨ 🌟 👋 📢 💪 ✅ 👍 🙌 🏃 🌈
- NON usare: 🗓️ 📅 📆 🗒️ 🗂️ né qualsiasi emoji con simboli tecnici o varianti
- NON usare emoji con variation selectors (caratteri invisibili che seguono l'emoji)
- Se non sai se un'emoji è sicura, NON usarla — preferisci il testo
- Tono caldo, amichevole, informale ma rispettoso
- Italiano corretto e colloquiale
- Breve e diretto (max 5-6 righe di testo)
- Inizia sempre con "Buongiorno" o "Buonasera"
- Termina con un invito all'azione o ringraziamento
- NON usare markdown, grassetto, corsivo o altre formattazioni — solo testo puro con emoji`;

export async function POST(request: NextRequest) {
  try {
    const { projectName, projectDescription, projectDate, projectLocation, context, previousMessages } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith('inserisci')) {
      return NextResponse.json({ error: 'Chiave API Gemini non configurata. Vai su aistudio.google.com/app/apikey per generarne una.' }, { status: 500 });
    }

    // Build context section
    const projectInfo = [
      projectName && `Nome progetto: "${projectName}"`,
      projectDescription && `Descrizione: "${projectDescription}"`,
      projectDate && `Data/periodo: ${projectDate}`,
      projectLocation && `Luogo: ${projectLocation}`,
    ].filter(Boolean).join('\n');

    // Build examples from past messages (learning)
    const pastExamples = previousMessages && previousMessages.length > 0
      ? `\n\nMESSAGGI INVIATI IN PRECEDENZA da questo progetto (impara il tono e lo stile):\n${previousMessages.map((m: string, i: number) => `--- Esempio ${i + 1} ---\n${m}`).join('\n')}`
      : '';

    const prompt = `${SYSTEM_PROMPT}

DETTAGLI DEL PROGETTO:
${projectInfo || 'Progetto ACR Chiari'}

TEMA DA COMUNICARE: "${context || 'prossimo incontro del gruppo'}"
${pastExamples}

Genera 3 bozze di messaggio WhatsApp diverse (dalla più breve alla più dettagliata).
Usale come riferimento stilistico se hai esempi passati.
Separale SOLO con "---" su una riga separata. Non aggiungere titoli o numerazione.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 1200 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      const msg = err.error?.message || `Errore Gemini API (${res.status})`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const suggestions = text.split(/\n---\n|^---\n/m).map((s: string) => s.trim()).filter((s: string) => s.length > 10);

    return NextResponse.json({ suggestions });

  } catch (err: any) {
    console.error('Error generating WhatsApp suggestions:', err);
    let message = err.message || 'Errore sconosciuto';
    if (message.includes('blocked') || message.includes('CONSUMER_INVALID') || message.includes('API_KEY_INVALID')) {
      message = 'Chiave API Gemini non valida o non abilitata. Vai su aistudio.google.com/app/apikey.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
