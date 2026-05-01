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

// ─── Helper: dato colonna (1-based) e NUM_COLS=3, ritorna left% e width%
// Aggiungiamo un margine finto ai lati per non far incollare le celle ai bordi dell'immagine
function colGeometry(numCols: number, colIdx: number) {
  const pad = 4; // 4% padding
  const width = (100 - pad * 2) / numCols;
  const left = pad + colIdx * width;
  return { left: `${left}%`, width: `${width}%` };
}

// ─── Helper: dato ripiano (1-based) e colonna, ritorna top e height in %
function cellGeometry(ripiano: number, colonna: number) {
  const padTop = 6; // padding per il tetto e la base
  const unitH = (100 - padTop * 2) / 6; 
  if (colonna <= 2) {
    if (ripiano <= 4) {
      return { top: `${padTop + (ripiano - 1) * unitH}%`, height: `${unitH}%` };
    } else {
      // Ripiano 5 (ultimo) è doppio
      return { top: `${padTop + 4 * unitH}%`, height: `${2 * unitH}%` };
    }
  } else {
    // Colonna 3: 3 ripiani, tutti di altezza doppia per allinearsi
    return { top: `${padTop + (ripiano - 1) * 2 * unitH}%`, height: `${2 * unitH}%` };
  }
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
                const isDouble = r === 5;
                const { top, height } = cellGeometry(r, 1);
                return (
                  <div key={r} className="absolute w-full flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                    style={{ top, height }}>R{r}</div>
                );
              })}
            </div>
            {/* Frame scaffale (immagine generata) */}
            <div className="relative flex-1 rounded-sm overflow-hidden" 
                 style={{ height: '480px', backgroundImage: 'url(/scaffale-bg.png)', backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
              {/* Celle cliccabili (invisibili ma interattive) */}
              {CELL_DEFS.map(def => {
                const selected = isSelected(def.ripiano, def.colonna);
                const { top, height } = cellGeometry(def.ripiano, def.colonna);
                const { left, width } = colGeometry(COLONNE, def.colonna - 1);
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
interface MiniShelfProps { posizione: ShelfPosition | null | undefined; }
export function MiniShelf({ posizione }: MiniShelfProps) {
  if (!posizione) return null;
  const { ripiano: targetR, colonna: targetC } = posizione;
  
  return (
    <div className="relative inline-block flex-shrink-0 rounded overflow-hidden" title={`Ripiano ${targetR}, Sez. ${targetC}`}
      style={{ height: '50px', width: '80px', backgroundImage: 'url(/scaffale-bg.png)', backgroundSize: '100% 100%' }}>
      {/* cella evidenziata */}
      {CELL_DEFS.map(def => {
        const sel = def.ripiano === targetR && def.colonna === targetC;
        if (!sel) return null;
        
        const { top, height } = cellGeometry(def.ripiano, def.colonna);
        const { left, width } = colGeometry(3, def.colonna - 1);
        
        return (
          <div key={`${def.ripiano}-${def.colonna}`} className="absolute bg-primary/60 border border-primary/50"
            style={{ top, height, left, width }} />
        );
      })}
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
const STATUS_BG: Record<string, string> = {
  empty: 'bg-transparent',
  ok: 'bg-emerald-500/15 hover:bg-emerald-500/25 cursor-pointer',
  warning: 'bg-amber-500/15 hover:bg-amber-500/25 cursor-pointer',
  expired: 'bg-red-500/20 hover:bg-red-500/30 cursor-pointer',
};
const DOT_CLASSES = { empty: '', ok: 'bg-emerald-500', warning: 'bg-amber-500', expired: 'bg-red-500' };

// ─── ShelfMap (visualizzazione inventario) ───────────────────────────────────
export function ShelfMap({ items, giorniAllerta = 7, onCellClick }: ShelfMapProps) {
  const gridMap: Record<string, ShelfItem[]> = {};
  for (const item of items) {
    let { ripiano, colonna } = item.posizione;
    if (colonna > 3) colonna = 3;
    if (colonna === 3 && ripiano > 3) ripiano = 3;
    const k = `${ripiano}-${colonna}`;
    if (!gridMap[k]) gridMap[k] = [];
    gridMap[k].push(item);
  }
  const occupiedCells = Object.values(gridMap).filter(c => c.length > 0).length;
  const totalCells = CELL_DEFS.length;

  return (
    <div className="space-y-4">
      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {[{ color: 'bg-emerald-400', label: 'Presente' }, { color: 'bg-amber-400', label: 'In scadenza' }, { color: 'bg-red-400', label: 'Scaduto' }, { color: 'bg-zinc-300', label: 'Vuoto' }].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5"><span className={cn('w-3 h-3 rounded-sm inline-block', color)} />{label}</span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{occupiedCells}/{totalCells} celle · {items.length} prodotti</span>
      </div>

      {/* Scaffale */}
      <div className="w-full select-none overflow-x-auto pb-2">
        <div className="min-w-[520px]">
          {/* Etichette sezioni */}
          <div className="flex mb-1" style={{ paddingLeft: 36 }}>
            {Array.from({ length: COLONNE }, (_, ci) => (
              <div key={ci} className="flex-1 text-center text-xs font-semibold text-muted-foreground tracking-wide">Sez. {ci + 1}</div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {/* Label ripiani */}
            <div className="flex flex-col flex-shrink-0 relative" style={{ width: 28 }}>
              {LABELS.map(r => {
                const { top, height } = cellGeometry(r, 1);
                return (
                  <div key={r} className="absolute w-full flex items-center justify-center"
                    style={{ top, height }}>
                    <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1 py-0.5 shadow-sm">R{r}</span>
                  </div>
                );
              })}
            </div>
            {/* Frame scaffale grande (immagine) */}
            <div
              className="relative flex-1 rounded overflow-hidden shadow-lg border border-black/10"
              style={{ height: '600px', backgroundImage: 'url(/scaffale-bg.png)', backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
            >
              {/* Celle interattive sovrapposte */}
              {CELL_DEFS.map(def => {
                const cellItems = gridMap[`${def.ripiano}-${def.colonna}`] ?? [];
                const status = cellStatus(cellItems, giorniAllerta);
                const isEmpty = status === 'empty';
                const sorted = [...cellItems].sort((a, b) => daysUntil(a.dataScadenza) - daysUntil(b.dataScadenza));
                const first = sorted[0];
                const days = first ? daysUntil(first.dataScadenza) : Infinity;
                const { top, height } = cellGeometry(def.ripiano, def.colonna);
                const { left, width } = colGeometry(COLONNE, def.colonna - 1);
                return (
                  <div
                    key={`cell-${def.ripiano}-${def.colonna}`}
                    role={isEmpty ? undefined : 'button'}
                    tabIndex={isEmpty ? undefined : 0}
                    onClick={() => !isEmpty && onCellClick?.(cellItems, def.ripiano, def.colonna)}
                    onKeyDown={e => { if (!isEmpty && (e.key === 'Enter' || e.key === ' ')) onCellClick?.(cellItems, def.ripiano, def.colonna); }}
                    title={isEmpty ? `R${def.ripiano} Sez.${def.colonna} — vuoto` : cellItems.map(i => i.nome).join(', ')}
                    className={cn('absolute z-30 flex flex-col items-center justify-center gap-1 p-2 transition-colors duration-150', STATUS_BG[status])}
                    style={{ top, height, left, width }}
                  >
                    {isEmpty ? (
                      <span className="text-[11px] text-zinc-400/40 font-mono select-none">—</span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ring-1 ring-black/10', DOT_CLASSES[status])} />
                          {cellItems.length > 1 && <span className="text-[10px] font-bold text-muted-foreground">×{cellItems.length}</span>}
                        </div>
                        <span className="text-[12px] font-semibold text-center leading-tight line-clamp-2 max-w-full text-zinc-800">
                          {first?.nome}{cellItems.length > 1 ? ` +${cellItems.length - 1}` : ''}
                        </span>
                        {first && days !== Infinity && (
                          <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded-full leading-none shadow-sm',
                            days < 0 ? 'bg-red-500 text-white' : days <= giorniAllerta ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-600')}>
                            {days < 0 ? `Sc. ${Math.abs(days)}g fa` : `${days}g`}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
