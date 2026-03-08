# 📋 Regole di Sviluppo — AC Chiari App

> Documento di riferimento per lo sviluppo dell'applicazione gestionale dell'Associazione Azione Cattolica Chiari.

---

## 🏗️ Architettura Generale

**Framework**: Next.js 14 con App Router  
**Linguaggio**: TypeScript (strict)  
**Stile**: Tailwind CSS + ShadCN UI (Radix primitives)  
**Backend**: Firebase (Auth, Firestore, Storage, Functions)  
**Deploy**: Firebase App Hosting (`apphosting.yaml`)

### Struttura cartelle
```
app/
  (app)/          ← Rotte protette (require auth + email verificata)
    layout.tsx    ← Guard di autenticazione + Sidebar + Header
    dashboard/
    contabilita/
    ...
  login/          ← Pubblica
  password-dimenticata/ ← Pubblica
  signup/         ← Pubblica
  layout.tsx      ← Root layout (FirebaseClientProvider + Toaster)
  globals.css     ← Variabili HSL del design system

components/       ← Componenti UI riutilizzabili
  ui/             ← Componenti ShadCN (NON modificare internamente)
  sidebar.tsx     ← Nav desktop (fixed, 256px)
  sidebar-links.tsx ← Logica di visibilità dinamica dei link
  header.tsx      ← Header mobile (Sheet) + menu utente

src/
  firebase/       ← SDK, Provider, hooks Firestore
    index.ts      ← Barrel export di tutto
    provider.tsx  ← FirebaseProvider + useUser/useAuth/useFirestore...
    firestore/    ← useCollection, useDoc
  hooks/
    use-user-data.tsx ← Dati utente da Firestore (ruoli, profilo)

lib/
  utils.ts        ← cn(), slugify() e altre utility
```

---

## ✅ Regole Firebase

### Hook Firestore
- Usa sempre `useCollection<T>(query)` e `useDoc<T>(ref)` da `@/src/firebase`
- Memoizza **sempre** le query con `useMemoFirebase()` per evitare loop di re-render:
  ```tsx
  // ✅ CORRETTO
  const q = useMemoFirebase(() => collection(firestore, 'items'), [firestore]);
  const { data, isLoading } = useCollection<Item>(q);

  // ❌ SBAGLIATO — causa loop infinito
  const { data } = useCollection<Item>(collection(firestore, 'items'));
  ```

### Auth
- L'auth guard si trova in `app/(app)/layout.tsx` — non duplicarlo nelle singole pagine
- Usa `useUser()` per accedere allo stato utente: `{ user, isUserLoading, userError }`
- Usa `useAuth()` per ottenere l'istanza Auth di Firebase
- Usa `useUserData()` da `@/src/hooks/use-user-data` per i dati Firestore dell'utente (ruoli, profilo)

### Ruoli utente
I ruoli sono definiti in `userData.roles` (array di stringhe):
- `'admin'` — accesso completo
- `'educatore'` — accesso alle sezioni educatori 
- `'genitore'` — accesso alle sezioni famiglia

---

## 🎨 Regole di Stile

### Colori — Palette AC Chiari
Il design system usa variabili HSL definite in `app/globals.css`. **Non usare mai colori hardcoded** (es. `text-blue-500`). Usa le classi semantiche:

| Classe semantica | Uso |
|---|---|
| `text-primary` / `bg-primary` | Blu AC Chiari (colore principale) |
| `text-primary-foreground` | Testo su sfondo primary (bianco/chiaro) |
| `bg-accent` / `text-accent-foreground` | Elementi attivi nella nav |
| `text-muted-foreground` | Testo secondario/disabilitato |
| `text-destructive` | Errori e azioni distruttive |
| `bg-background` | Sfondo pagina principale |
| `bg-card` | Sfondo card/pannelli |
| `border-border` | Tutti i bordi |

### Icone
- Usa **esclusivamente** `lucide-react`
- Dimensioni standard: `h-5 w-5` (inline), `h-8 w-8` (logo/grande)

### Font
- Font principale: `Inter` (caricato da Google Fonts in `layout.tsx`)
- Nessun font hardcoded inline

### Responsive
- **Mobile-first**: l'app usa una sidebar fissa su desktop e un `Sheet` slide-in su mobile
- Il layout protetto è: `sm:pl-64` (padding-left 256px su desktop per la sidebar)
- Usa i breakpoint Tailwind: `sm:` (640px+), `md:` (768px+), `lg:` (1024px+)

---

## ⚙️ Regole sui Componenti

### Server vs Client Components
- Di default usa **Server Components** (senza `'use client'`)
- Aggiungi `'use client'` solo se il componente:
  - Usa hook React (`useState`, `useEffect`, ecc.)
  - Usa hooks Firebase (`useAuth`, `useFirestore`, `useCollection`, `useUser`, ecc.)
  - Gestisce eventi (onClick, onChange, ecc.)
  - Usa `useRouter`, `usePathname`, `useSearchParams`

### ShadCN UI
- I componenti in `components/ui/` sono auto-generati da ShadCN — **non modificarli direttamente**
- Per personalizzare un componente ShadCN, crea un wrapper in `components/`
- Aggiungi nuovi componenti ShadCN con: `npx shadcn-ui@latest add <component>`

### Dialogs
- I dialog complessi risiedono in `components/` (es. `add-event-dialog.tsx`)
- Usa sempre `confirmation-dialog.tsx` per azioni distruttive (eliminazione, ecc.)

---

## 🚫 Limitazioni Note

| Funzione | Stato | Motivo |
|---|---|---|
| `pdfjs-dist` | ❌ Rimosso | Errore `Cannot find module './6479.js'` in build Next.js |
| Upload ricevute | ⚠️ Solo immagini | JPG e PNG supportati, PDF no |
| Google Drive API | ❌ Sospesa | Rimossa da `functions/package.json` per isolare errore deploy |
| Cloud Functions | ✅ Solo `helloWorld` | Funzione di test attiva |

---

## 🔄 Flusso di Autenticazione

```
Utente visita /dashboard
  ↓
app/(app)/layout.tsx → verifica useUser()
  ├─ isUserLoading: true → mostra "Caricamento..."
  ├─ user = null → redirect a /login
  ├─ user.emailVerified = false → signOut + redirect /login?error=email_not_verified
  └─ user.emailVerified = true → mostra layout con Sidebar + Header
```

### Flusso Registrazione
```
/signup → crea account Firebase → invia email verifica → redirect /login?signup_success=true
```

### Flusso Reset Password
```
/password-dimenticata → chiama sendPasswordResetEmail(auth, email) → Firebase invia email → utente clicca link → redirect a /login
```

---

## 📦 Dipendenze Principali

| Pacchetto | Uso |
|---|---|
| `firebase` v10 | Auth, Firestore, Storage, Functions |
| `next` v14 | Framework (App Router) |
| `tailwindcss` | Stile utility-first |
| `@radix-ui/*` | Primitivi UI accessibili (via ShadCN) |
| `lucide-react` | Icone |
| `date-fns` | Formattazione date (it-IT) |
| `papaparse` | Export CSV |
| `react-dropzone` | Upload file (solo immagini) |
| `use-debounce` | Ottimizzazione ricerche |
| `deep-object-diff` | Diff per audit transazioni |
| `cmdk` | Command palette (ShadCN Command) |
| `zod` | Validazione schema form |

---

## 🚀 Comandi Utili

```bash
# Sviluppo locale
npm run dev

# TypeScript check
npx tsc --noEmit

# Aggiungere componente ShadCN
npx shadcn-ui@latest add <nome-componente>

# Git: salva modifiche
git add .
git commit -m "descrizione"
git push
```
