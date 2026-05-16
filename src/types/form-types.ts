// ─── Form Builder Types ─────────────────────────────────────────────────────

export type QuestionType =
  | 'text'           // risposta aperta breve
  | 'textarea'       // risposta aperta lunga
  | 'single_choice'  // risposta singola (radio)
  | 'multiple_choice'// risposta multipla (checkbox)
  | 'number'         // numero (es. quanti partecipanti)
  | 'select'         // menu a tendina
  | 'email'          // email con validazione
  | 'phone'          // telefono
  | 'price_item';    // voce con prezzo selezionabile (calcola totale)

export interface QuestionOption {
  id: string;
  label: string;
  price?: number; // solo per price_item
}

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;          // testo della domanda
  description?: string;   // descrizione/aiuto opzionale
  required: boolean;
  options?: QuestionOption[]; // per single_choice, multiple_choice, select, price_item
  placeholder?: string;   // per text, textarea, number, email, phone
  minValue?: number;      // per number
  maxValue?: number;      // per number
}

export interface FormSchema {
  id: string;
  projectId: string;
  createdBy: string;        // uid del creatore
  title: string;
  description?: string;
  questions: FormQuestion[];
  isPublic: boolean;        // se accessibile via link senza auth
  allowAnonymous: boolean;  // se si può compilare senza account
  generateCollection: boolean; // "Genera raccolta automatica"
  collectionTitle?: string; // titolo della raccolta generata
  status: 'draft' | 'active' | 'closed';
  createdAt: any;
  updatedAt: any;
}

// ─── Form Response Types ────────────────────────────────────────────────────

export type AnswerValue = string | string[] | number | null;

export interface FormResponse {
  id: string;
  formId: string;
  projectId: string;
  // Identità del compilatore
  userId?: string;          // se autenticato
  displayName?: string;     // nome fornito (account o esterno)
  email?: string;           // email fornita
  phone?: string;           // telefono fornito (utente esterno)
  isAnonymous: boolean;     // true solo se NON ha fornito alcun dato identificativo
  // Risposte
  answers: Record<string, AnswerValue>; // questionId -> valore
  total?: number;           // somma prezzi (price_item)
  // Riepilogo per raccolta automatica
  summaryText?: string;     // testo riepilogativo auto-generato
  submittedAt: any;
}

// ─── Auto-collection row ────────────────────────────────────────────────────
export interface FormCollectionRow {
  id: string;
  formId: string;
  responseId: string;
  userId?: string;
  displayName: string;
  email?: string;
  summaryLines: { label: string; value: string }[];
  total?: number;
  createdAt: any;
}
