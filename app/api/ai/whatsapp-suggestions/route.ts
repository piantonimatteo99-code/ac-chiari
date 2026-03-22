import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Sei un assistente per un'associazione cattolica di Azione Cattolica Ragazzi (ACR) in Italia.
Scrivi messaggi WhatsApp per il gruppo genitori di ragazzi delle medie.
Lo stile deve essere:
- Caldo, amichevole e informale ma rispettoso
- Includi emoji/faccine come 🥰😊🙏🏻✨🎉📍⏰
- Italiano corretto ma colloquiale
- Breve e diretto (max 4-5 righe)
- Inizia con saluto (Buongiorno/Buonasera)
- Termina con un invito o ringraziamento

Esempi di stile:
"Buonasera! Venerdì sera ci sarà incontro come da calendario. Abbiamo pensato di proporre ai ragazzi una serata pizza tra noi medie ACR dalle 19:30 alle 22:30.🥰 Vi chiediamo un contributo di 5€ per la cena che ritireremo la sera stessa."

"Buongiorno a tutti! Come anticipato nelle scorse settimane, questo venerdì parteciperemo come gruppo ACR alla via Crucis organizzata da noi🥰 Il ritrovo è a Samber alle 20:30. Vi aspettiamo numerosi🙏🏻"`;

export async function POST(request: NextRequest) {
  try {
    const { projectName, context } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith('inserisci')) {
      return NextResponse.json({ error: 'Chiave API Gemini non configurata. Vai su aistudio.google.com/app/apikey per generarne una.' }, { status: 500 });
    }

    const prompt = `${SYSTEM_PROMPT}

Progetto: "${projectName || 'Incontro ACR'}"
Tema/contenuto da comunicare: "${context || 'prossimo incontro del gruppo'}"

Genera 3 bozze di messaggio WhatsApp diverse (dalla più formale alla più creativa), sempre con emoji appropriate. 
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
    console.error('Error generating WhatsApp suggestions:', err);
    let message = err.message || 'Errore sconosciuto';
    if (message.includes('blocked') || message.includes('CONSUMER_INVALID') || message.includes('API_KEY_INVALID')) {
      message = 'Chiave API Gemini non valida o non abilitata. Vai su aistudio.google.com/app/apikey → genera una chiave → aggiungila come GEMINI_API_KEY nel file .env.local, poi riavvia il server.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
