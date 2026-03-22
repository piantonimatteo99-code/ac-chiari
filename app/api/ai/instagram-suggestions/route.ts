import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Sei un social media manager per un'associazione cattolica di Azione Cattolica Ragazzi (ACR) in Italia.
Scrivi caption per post Instagram che raccontino le attività dei ragazzi delle medie (11-14 anni).
Lo stile deve essere:
- Entusiasta, positivo e coinvolgente
- Usa emoji rilevanti in modo naturale 📸🌟🙏🏻❤️✨🎉💫👫🌈
- Italiano vivace e moderno
- Max 5-6 righe + hashtag
- Racconta una storia o emozione, non solo descrivere
- Includi sempre alcuni hashtag ACR: #ACR #AzioneeCattolica #ACChiari e hashtag tematici

Esempi di tono:
"Una serata indimenticabile tra amici, pizza e tante risate! 🍕🥰 I ragazzi delle medie ACR sanno come stare insieme e creare momenti speciali. Grazie a tutti per la vostra partecipazione e il vostro entusiasmo✨\n#ACR #AzioneeCattolica #ACChiari #Comunità #Ragazzi"`;

export async function POST(request: NextRequest) {
  try {
    const { projectName, context } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith('inserisci')) {
      return NextResponse.json({ error: 'Chiave API Gemini non configurata. Vai su aistudio.google.com/app/apikey per generarne una.' }, { status: 500 });
    }

    const prompt = `${SYSTEM_PROMPT}

Progetto: "${projectName || 'Attività ACR'}"
Descrizione del momento/evento da raccontare: "${context || 'momento speciale con il gruppo'}"

Genera 3 caption Instagram diverse (dalla più breve alla più narrativa/emotiva), sempre con emoji e hashtag appropriati.
Separale con "---". Non aggiungere titoli o numerazione.`;

    // Use v1 stable API (compatible with Firebase auto-generated Gemini keys)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
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
    const suggestions = text.split('---').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

    return NextResponse.json({ suggestions });

  } catch (err: any) {
    console.error('Error generating Instagram suggestions:', err);
    let message = err.message || 'Errore sconosciuto';
    if (message.includes('blocked') || message.includes('CONSUMER_INVALID') || message.includes('API_KEY_INVALID')) {
      message = 'Chiave API Gemini non valida o non abilitata. Vai su aistudio.google.com/app/apikey → genera una chiave → aggiungila come GEMINI_API_KEY nel file .env.local, poi riavvia il server.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
