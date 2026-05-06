'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ShelfPosition { ripiano: number; colonna: number; }
interface ShelfSelectorProps { value?: ShelfPosition | null; onChange: (pos: ShelfPosition) => void; disabled?: boolean; }

// ─── Costanti layout realistico ───────────────────────────────────────────────
export const RIPIANI = 5;
export const COLONNE = 3;

export type CellDef = { colonna: number; ripiano: number; isLast: boolean };
export const CELL_DEFS: CellDef[] = [];
for (let c = 1; c <= 2; c++) {
  for (let r = 1; r <= 5; r++) {
    CELL_DEFS.push({ colonna: c, ripiano: r, isLast: r === 5 });
  }
}
// Colonna 3
CELL_DEFS.push({ colonna: 3, ripiano: 1, isLast: false });
CELL_DEFS.push({ colonna: 3, ripiano: 2, isLast: false });
CELL_DEFS.push({ colonna: 3, ripiano: 3, isLast: true });

export const LABELS = [1, 2, 3, 4, 5];

// ─── Configurazione Geometrica Esatta (Ogni cella è indipendente) ────────────
type CellGeometry = { top: string, left: string, width: string, height: string };

export const EXACT_CELLS: Record<string, CellGeometry> = {
  // Modulo Sinistro (Colonna 1) - 5 ripiani
  "1-1": { top: "0%", left: "2.3%", width: "29.6%", height: "18.9%" },
  "2-1": { top: "18.9%", left: "2.3%", width: "29.6%", height: "18.4%" },
  "3-1": { top: "37.3%", left: "2.3%", width: "29.6%", height: "18.5%" },
  "4-1": { top: "55.8%", left: "2.3%", width: "29.6%", height: "18.4%" },
  "5-1": { top: "74.2%", left: "2.3%", width: "29.6%", height: "25.8%" },

  // Modulo Centrale (Colonna 2) - 5 ripiani
  "1-2": { top: "0%", left: "31.9%", width: "29.6%", height: "18.9%" },
  "2-2": { top: "18.9%", left: "31.9%", width: "29.6%", height: "18.4%" },
  "3-2": { top: "37.3%", left: "31.9%", width: "29.6%", height: "18.5%" },
  "4-2": { top: "55.8%", left: "31.9%", width: "29.6%", height: "18.4%" },
  "5-2": { top: "74.2%", left: "31.9%", width: "29.6%", height: "25.8%" },

  // Modulo Destro (Colonna 3) - 3 ripiani
  "1-3": { top: "0%", left: "61.5%", width: "29.7%", height: "31.8%" },
  "2-3": { top: "31.8%", left: "61.5%", width: "29.7%", height: "31.8%" },
  "3-3": { top: "63.6%", left: "61.5%", width: "29.7%", height: "36.4%" },
};

function getExactGeometry(ripiano: number, colonna: number): CellGeometry {
  const key = `${ripiano}-${colonna}`;
  return EXACT_CELLS[key] || { top: "0%", left: "0%", width: "10%", height: "10%" };
}

// Sfondo scaffale (immagine) con filtro per sfondo bianco
function ShelfBg() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: 'url(/scaffale-bg.png)',
        backgroundSize: '100% 100%',
        // Desatura e schiarisce il colore panna → bianco, senza toccare i div figli
        filter: 'saturate(0.05) brightness(1.18)',
      }}
    />
  );
}

// ─── ShelfSelector (form interattivo) ────────────────────────────────────────
export function ShelfSelector({ value, onChange, disabled }: ShelfSelectorProps) {
  const isSelected = (r: number, c: number) => value?.ripiano === r && value?.colonna === c;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Clicca sulla cella dello scaffale per indicare la posizione del prodotto</p>
      <div className="w-full select-none overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Labels sezioni */}
          <div className="relative mb-1" style={{ paddingLeft: 32 }}>
            <div className="flex">
              {Array.from({ length: COLONNE }, (_, ci) => (
                <div key={ci} className="flex-1 text-center text-[11px] text-muted-foreground font-medium">Sez. {ci + 1}</div>
              ))}
            </div>
          </div>
          {/* Scaffale */}
          <div className="flex gap-1">
            {/* Label ripiani */}
            <div className="flex flex-col relative" style={{ width: 28 }}>
              {LABELS.map(r => {
                const { top, height } = getExactGeometry(r, 1);
                return (
                  <div key={r} className="absolute w-full flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                    style={{ top, height }}>R{r}</div>
                );
              })}
            </div>
            {/* Frame scaffale (immagine) */}
            <div className="relative flex-1 rounded-sm overflow-hidden" 
                 style={{ height: '400px' }}>
              <ShelfBg />
              {/* Celle cliccabili */}
              {CELL_DEFS.map(def => {
                const selected = isSelected(def.ripiano, def.colonna);
                const { top, left, width, height } = getExactGeometry(def.ripiano, def.colonna);
                return (
                  <button
                    key={`${def.ripiano}-${def.colonna}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ripiano: def.ripiano, colonna: def.colonna })}
                    className={cn(
                      'absolute z-30 flex flex-col items-center justify-center gap-0.5 transition-all duration-150',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset border-2 border-dashed border-transparent',
                      selected ? 'bg-primary/25 border-primary/50' : 'bg-transparent hover:bg-black/10',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    style={{ top, height, left, width }}
                  >
                    {selected && (
                      <span className="text-xl leading-none drop-shadow">📦</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {value && (
        <p className="text-sm font-medium text-primary">✓ Ripiano {value.ripiano}, Sezione {value.colonna}</p>
      )}
    </div>
  );
}

// ─── MiniShelf (thumbnail) ────────────────────────────────────────────────────
// Rappresentazione minimal: griglia di celle con un pallino colorato nella cella selezionata.
interface MiniShelfProps { posizione: ShelfPosition | null | undefined; dotColor?: string; }
export function MiniShelf({ posizione, dotColor = 'bg-primary' }: MiniShelfProps) {
  if (!posizione) return null;
  const { ripiano: targetR, colonna: targetC } = posizione;

  // Griglia semplificata: RIPIANI righe × COLONNE colonne
  // Colonna 3 ha solo 3 ripiani, per il mini la trattiamo uguale alle altre
  const rows = Array.from({ length: RIPIANI }, (_, ri) => ri + 1);
  const cols = Array.from({ length: COLONNE }, (_, ci) => ci + 1);

  return (
    <div
      className="inline-flex flex-col gap-[2px] flex-shrink-0 p-[3px] rounded border border-border bg-muted/40"
      title={`Ripiano ${targetR}, Sez. ${targetC}`}
      style={{ width: 44 }}
    >
      {rows.map(r => (
        <div key={r} className="flex gap-[2px]">
          {cols.map(c => {
            const isTarget = r === targetR && c === targetC;
            return (
              <div
                key={c}
                className={cn(
                  'rounded-[2px] flex-1 flex items-center justify-center',
                  'border border-border/50',
                )}
                style={{ height: 7 }}
              >
                {isTarget && (
                  <span className={cn('w-[5px] h-[5px] rounded-full', dotColor)} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ShelfMap ─────────────────────────────────────────────────────────
export interface ShelfItem { id: string; nome: string; categoria: string; quantita: number; dataScadenza?: string; posizione: ShelfPosition; }
interface ShelfMapProps { items: ShelfItem[]; giorniAllerta?: number; onCellClick?: (items: ShelfItem[], ripiano: number, colonna: number) => void; }

function daysUntil(isoDate?: string): number {
  if (!isoDate) return Infinity;
  try { return Math.ceil((new Date(isoDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000); } catch { return Infinity; }
}
function cellStatus(cellItems: ShelfItem[], giorniAllerta: number) {
  if (cellItems.length === 0) return 'empty';
  if (cellItems.some(i => daysUntil(i.dataScadenza) < 0)) return 'expired';
  if (cellItems.some(i => { const d = daysUntil(i.dataScadenza); return d >= 0 && d <= giorniAllerta; })) return 'warning';
  return 'ok';
}
const DOT_CLASSES: Record<string, string> = { empty: '', ok: 'bg-emerald-500', warning: 'bg-amber-500', expired: 'bg-red-500' };

// ─── ShelfMap (visualizzazione inventario) ───────────────────────────────────
export function ShelfMap({ items, giorniAllerta = 7, onCellClick }: ShelfMapProps) {
  // Costruisce mappa per cella
  const gridMap: Record<string, ShelfItem[]> = {};
  for (const item of items) {
    let { ripiano, colonna } = item.posizione;
    if (colonna > 3) colonna = 3;
    if (colonna === 3 && ripiano > 3) ripiano = 3;
    const k = `${ripiano}-${colonna}`;
    if (!gridMap[k]) gridMap[k] = [];
    gridMap[k].push(item);
  }

  // Raggruppa per ripiano: righe R1..R5, colonne 1..3
  // Per colonna 3, ripiani validi sono 1..3, per le altre 1..5
  const allRipiani = [1, 2, 3, 4, 5];
  const allColonne = [1, 2, 3];

  return (
    <div className="space-y-2">
      {/* Header colonne */}
      <div className="flex items-center gap-2">
        <div className="w-10 flex-shrink-0" />
        {allColonne.map(c => (
          <div key={c} className="flex-1 text-center text-xs font-semibold text-muted-foreground tracking-wide py-1">
            Sez. {c}
          </div>
        ))}
      </div>

      {/* Righe ripiani */}
      {allRipiani.map(r => {
        // Verifica se ci sono prodotti in scadenza/scaduti in questo ripiano
        const ripianoItems = allColonne
          .map(c => gridMap[`${r}-${c}`] ?? [])
          .flat();
        const ripianoStatus = cellStatus(ripianoItems, giorniAllerta);
        const hasAlert = ripianoStatus === 'expired' || ripianoStatus === 'warning';

        return (
          <div
            key={r}
            className={cn(
              'flex items-stretch gap-2 rounded-lg border p-1.5 transition-colors',
              ripianoStatus === 'expired' && 'border-red-300 bg-red-50 dark:bg-red-950/20',
              ripianoStatus === 'warning' && 'border-amber-300 bg-amber-50 dark:bg-amber-950/20',
              ripianoStatus === 'ok' && 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10',
              ripianoStatus === 'empty' && 'border-border bg-muted/20',
            )}
          >
            {/* Label ripiano + alert badge */}
            <div className="w-10 flex-shrink-0 flex flex-col items-center justify-center gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">R{r}</span>
              {hasAlert && (
                <span
                  className={cn(
                    'text-[9px] font-bold px-1 py-0.5 rounded-full leading-none',
                    ripianoStatus === 'expired'
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-white'
                  )}
                >
                  {ripianoStatus === 'expired' ? 'Sc.' : '⚠'}
                </span>
              )}
            </div>

            {/* Celle per ogni sezione */}
            {allColonne.map(c => {
              // Colonna 3 ha solo 3 ripiani
              const isDisabled = c === 3 && r > 3;
              const cellKey = `${r}-${c}`;
              const cellItems = isDisabled ? [] : (gridMap[cellKey] ?? []);
              const status = isDisabled ? 'disabled' : cellStatus(cellItems, giorniAllerta);
              const isEmpty = status === 'empty' || status === 'disabled';
              const sorted = [...cellItems].sort((a, b) => daysUntil(a.dataScadenza) - daysUntil(b.dataScadenza));
              const first = sorted[0];
              const days = first ? daysUntil(first.dataScadenza) : Infinity;

              return (
                <div
                  key={c}
                  role={isEmpty ? undefined : 'button'}
                  tabIndex={isEmpty ? undefined : 0}
                  onClick={() => !isEmpty && onCellClick?.(cellItems, r, c)}
                  onKeyDown={e => { if (!isEmpty && (e.key === 'Enter' || e.key === ' ')) onCellClick?.(cellItems, r, c); }}
                  title={isEmpty ? undefined : cellItems.map(i => i.nome).join(', ')}
                  className={cn(
                    'flex-1 rounded-md border min-h-[52px] px-2 py-1.5 flex flex-col justify-center gap-1 transition-colors',
                    status === 'disabled' && 'bg-muted/30 border-dashed border-border/40 opacity-40',
                    status === 'empty' && 'bg-transparent border-dashed border-border/60',
                    status === 'ok' && 'bg-emerald-500/10 border-emerald-300/50 hover:bg-emerald-500/20 cursor-pointer',
                    status === 'warning' && 'bg-amber-500/10 border-amber-300/50 hover:bg-amber-500/20 cursor-pointer',
                    status === 'expired' && 'bg-red-500/10 border-red-300/50 hover:bg-red-500/20 cursor-pointer',
                  )}
                >
                  {status === 'disabled' ? (
                    <span className="text-[10px] text-muted-foreground/40 text-center select-none">—</span>
                  ) : isEmpty ? (
                    <span className="text-[10px] text-muted-foreground/50 text-center select-none">vuoto</span>
                  ) : (
                    <>
                      {/* Riga nome + dot + conteggio */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_CLASSES[status])} />
                        <span className="text-[11px] font-semibold truncate text-foreground leading-tight flex-1">
                          {first?.nome}{cellItems.length > 1 ? ` +${cellItems.length - 1}` : ''}
                        </span>
                        {cellItems.length > 1 && (
                          <span className="text-[9px] font-medium text-muted-foreground flex-shrink-0">×{cellItems.length}</span>
                        )}
                      </div>
                      {/* Scadenza */}
                      {first && days !== Infinity && (
                        <span
                          className={cn(
                            'self-start text-[9px] font-mono px-1.5 py-0.5 rounded-full leading-none',
                            days < 0 ? 'bg-red-500 text-white' : days <= giorniAllerta ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-600'
                          )}
                        >
                          {days < 0 ? `Sc. ${Math.abs(days)}g fa` : `${days}g`}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
