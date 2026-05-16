import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const SYSTEM_PROMPT = `Sei un assistente specializzato nella creazione di moduli per l'associazione Azione Cattolica di Chiari.
Dato un testo descrittivo in italiano, genera uno schema JSON per un modulo personalizzato.

Tipi di domanda disponibili:
- "text": risposta aperta breve (testo libero)
- "textarea": risposta aperta lunga
- "single_choice": scelta singola tra opzioni (radio)
- "multiple_choice": scelta multipla (checkbox)
- "number": campo numerico (es. numero di partecipanti)
- "select": menu a tendina
- "email": email con validazione
- "phone": numero di telefono
- "price_item": seleziona una o più voci con prezzo fisso (checkbox + prezzo)
- "quantity_picker": specifica la quantità per ogni voce con prezzo (es. 3 menù adulti + 2 bambini)

Per "price_item" e "quantity_picker" le opzioni devono avere: label (string) e price (number, in euro).
Per gli altri tipi con scelte, le opzioni hanno solo: label (string).

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza testo extra.

Formato obbligatorio:
{
  "title": "Titolo del modulo",
  "description": "Descrizione opzionale del modulo",
  "generateCollection": true o false (true se è necessario raccogliere dati per gestione/contabilità),
  "collectionTitle": "Titolo della raccolta (opzionale, solo se generateCollection è true)",
  "questions": [
    {
      "id": "q1",
      "type": "tipo_domanda",
      "label": "Testo della domanda",
      "description": "Descrizione/istruzione opzionale",
      "required": true o false,
      "options": [ { "id": "opt1", "label": "...", "price": 0.00 } ],
      "placeholder": "testo segnaposto (solo per text/number/email/phone)"
    }
  ]
}

REGOLE:
- Usa "quantity_picker" quando l'utente deve specificare quante persone scelgono ogni opzione
- Usa "price_item" quando è una semplice selezione con prezzo (es. maglietta sì/no)
- Aggiungi sempre una domanda di tipo "text" o "email" per raccogliere il nome del compilatore
- Imposta generateCollection: true se ci sono prezzi o se serve un riepilogo delle adesioni
- I prezzi devono essere numeri decimali (es. 20.00, non "20€")
- Genera ID univoci brevi (es. "q1", "q2", "opt1", "opt2")`;

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json() as { description: string };

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Descrizione vuota' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chiave API Gemini non configurata.' }, { status: 500 });
    }

    const prompt = `${SYSTEM_PROMPT}\n\nDescrizione del modulo: "${description.replace(/"/g, '\\"')}"`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: err.error?.message || `Errore Gemini (${res.status})` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Rimuovi eventuali code fence markdown
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    let schema: any;
    try {
      schema = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'La AI ha restituito una risposta non valida. Riprova con una descrizione più dettagliata.' },
        { status: 422 }
      );
    }

    // Assicura che ogni domanda e opzione abbiano ID univoci
    if (Array.isArray(schema.questions)) {
      schema.questions = schema.questions.map((q: any, i: number) => ({
        ...q,
        id: q.id || `q${i + 1}_${nanoid(4)}`,
        options: Array.isArray(q.options)
          ? q.options.map((o: any, oi: number) => ({
              ...o,
              id: o.id || `opt${oi + 1}_${nanoid(4)}`,
            }))
          : undefined,
      }));
    }

    return NextResponse.json({ schema });
  } catch (error) {
    console.error('[AI Form Generator] Error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
