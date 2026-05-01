'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ShelfPosition { ripiano: number; colonna: number; }
interface ShelfSelectorProps { value?: ShelfPosition | null; onChange: (pos: ShelfPosition) => void; disabled?: boolean; }

export const RIPIANI = 5;
export const COLONNE = 3;

export type CellDef = { colonna: number; ripiano: number; gridRow: string; isLast: boolean };
export const CELL_DEFS: CellDef[] = [];
for (let c = 1; c <= 2; c++)
  for (let r = 1; r <= 5; r++)
    CELL_DEFS.push({ colonna: c, ripiano: r, gridRow: `${r}`, isLast: r === 5 });
CELL_DEFS.push({ colonna: 3, ripiano: 1, gridRow: '1 / span 2', isLast: false });
CELL_DEFS.push({ colonna: 3, ripiano: 2, gridRow: '3 / span 2', isLast: false });
CELL_DEFS.push({ colonna: 3, ripiano: 3, gridRow: '5 / span 1', isLast: true });

export const UPRIGHTS: { colonna: number; type: 'left' | 'right' }[] = [];
for (let c = 1; c <= COLONNE; c++) {
  UPRIGHTS.push({ colonna: c, type: 'left' });
  UPRIGHTS.push({ colonna: c, type: 'right' });
}
export const LABELS = [1, 2, 3, 4, 5];
export function getGridCol(colonna: number, hasLabel: boolean) { const ci = colonna - 1; const base = ci * 3 + 2; return hasLabel ? base + 1 : base; }
export function getUprightCol(colonna: number, type: 'left' | 'right', hasLabel: boolean) { const ci = colonna - 1; const base = type === 'left' ? ci * 3 + 1 : ci * 3 + 3; return hasLabel ? base + 1 : base; }

// ─── Costanti layout realistico ───────────────────────────────────────────────
const UPW = 18;       // larghezza montante px
const PLANK = 14;     // altezza pianale px
const ROW_H = 68;     // altezza base di un ripiano standard (px)
const TOTAL_UNITS = 6; // L'altezza totale è divisa in 6 unità logiche
const TOTAL_H = PLANK * (TOTAL_UNITS + 1) + ROW_H * TOTAL_UNITS; // height totale px

// Gradient montante metallico con fori
const uprightBg = (side: 'left' | 'right') =>
  side === 'left'
    ? `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 9px, rgba(0,0,0,0.55) 9px, rgba(0,0,0,0.55) 11px, rgba(0,0,0,0) 11px, rgba(0,0,0,0) 14px),
       linear-gradient(to right, #6b6b6b 0%, #b0b0b0 45%, #d8d8d8 65%, #a8a8a8 100%)`
    : `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 9px, rgba(0,0,0,0.55) 9px, rgba(0,0,0,0.55) 11px, rgba(0,0,0,0) 11px, rgba(0,0,0,0) 14px),
       linear-gradient(to left,  #6b6b6b 0%, #b0b0b0 45%, #d8d8d8 65%, #a8a8a8 100%)`;

// Gradient pianale metallico (visto frontalmente: bordo anteriore alto, superficie sopra)
const plankBg = `linear-gradient(to bottom, #e8e8e8 0%, #c8c8c8 35%, #b0b0b0 70%, #989898 100%)`;
const plankShadow = '0 4px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)';

// ─── Helper: dato colonna (1-based) e NUM_COLS=3, ritorna left% e width%
function colGeometry(numCols: number, colIdx: number /* 0-based */) {
  // Section width percentage = (100% - uprights) / numCols, uprights in px
  // We'll use inline calc() strings
  const totalUprights = (numCols + 1) * UPW;
  const sectionWidthCalc = `calc((100% - ${totalUprights}px) / ${numCols})`;
  const leftCalc = `calc(${colIdx} * (${sectionWidthCalc} + ${UPW}px) + ${UPW}px)`;
  return { left: leftCalc, width: sectionWidthCalc };
}

// ─── Helper: dato ripiano (1-based) e colonna, ritorna top e height in px
function cellGeometry(ripiano: number, colonna: number) {
  if (colonna <= 2) {
    if (ripiano <= 4) {
      const top = PLANK + (ripiano - 1) * (ROW_H + PLANK);
      return { top, height: ROW_H };
    } else {
      // Ripiano 5 (ultimo) è doppio
      const top = PLANK + 4 * (ROW_H + PLANK);
      return { top, height: ROW_H * 2 + PLANK };
    }
  } else {
    // Colonna 3: 3 ripiani, tutti di altezza doppia per allinearsi
    const top = PLANK + (ripiano - 1) * 2 * (ROW_H + PLANK);
    return { top, height: ROW_H * 2 + PLANK };
  }
}

// ─── Sub-component: struttura scaffale (frame + pianali) ─────────────────────
function ShelfFrame() {
  const partialWidth = `calc(2 * ((100% - ${4 * UPW}px) / 3 + ${UPW}px) + ${UPW}px)`;
  return (
    <>
      {/* Montanti verticali - uno per ogni bordo sezione */}
      {Array.from({ length: COLONNE + 1 }, (_, i) => {
        const side = i === 0 ? 'left' : 'right';
        const leftCalc = i === 0
          ? '0px'
          : i === COLONNE
          ? `calc(100% - ${UPW}px)`
          : `calc(${i} * ((100% - ${(COLONNE + 1) * UPW}px) / ${COLONNE} + ${UPW}px))`;
        return (
          <div key={`post-${i}`} className="absolute top-0 bottom-0 z-20" style={{ left: leftCalc, width: UPW, background: uprightBg(side) }} />
        );
      })}
      
      {/* Pianali a larghezza intera (0, 2, 4, 6) */}
      {[0, 2, 4, 6].map(i => {
        const topPx = i * (ROW_H + PLANK);
        return (
          <div
            key={`plank-full-${i}`}
            className="absolute left-0 right-0 z-10"
            style={{ top: topPx, height: PLANK, background: plankBg, boxShadow: plankShadow }}
          />
        );
      })}

      {/* Pianali parziali (solo colonne 1 e 2) (1, 3) */}
      {[1, 3].map(i => {
        const topPx = i * (ROW_H + PLANK);
        return (
          <div
            key={`plank-partial-${i}`}
            className="absolute left-0 z-10"
            style={{ top: topPx, height: PLANK, background: plankBg, boxShadow: plankShadow, width: partialWidth }}
          />
        );
      })}
    </>
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
                const isDouble = r === 5;
                const topPx = PLANK + (r - 1) * (ROW_H + PLANK);
                return (
                  <div key={r} className="absolute w-full flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                    style={{ top: topPx, height: isDouble ? ROW_H * 2 + PLANK : ROW_H }}>R{r}</div>
                );
              })}
            </div>
            {/* Frame scaffale */}
            <div className="relative flex-1 rounded-sm overflow-hidden" style={{ height: TOTAL_H, background: '#f0ede8' }}>
              <ShelfFrame />
              {/* Celle cliccabili */}
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
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                      selected ? 'bg-primary/25' : 'bg-transparent hover:bg-black/5',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    style={{ top, height, left, width }}
                  >
                    {selected ? (
                      <span className="text-xl leading-none drop-shadow">📦</span>
                    ) : (
                      <span className="text-[10px] text-zinc-400/60 font-mono">R{def.ripiano}·S{def.colonna}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Base */}
          <div style={{ marginLeft: 29 }}>
            <div className="h-3 rounded-b shadow-md" style={{ background: 'linear-gradient(to bottom,#5a5a5a,#3a3a3a)' }} />
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
  const MUW = 4; const MPLANK = 3; const MROW = 8; const MCOLS = COLONNE;
  const MTOTAL_UNITS = 6;
  const MH = MPLANK * (MTOTAL_UNITS + 1) + MROW * MTOTAL_UNITS;
  const partialWidth = 2 * (22 + MUW) + MUW;
  return (
    <div className="relative inline-block flex-shrink-0 rounded overflow-hidden" title={`Ripiano ${targetR}, Sez. ${targetC}`}
      style={{ height: MH, width: MCOLS * 22 + (MCOLS + 1) * MUW }}>
      <div className="absolute inset-0" style={{ background: '#f0ede8' }} />
      {/* mini montanti */}
      {Array.from({ length: MCOLS + 1 }, (_, i) => (
        <div key={i} className="absolute top-0 bottom-0 bg-zinc-400" style={{ left: i * (22 + MUW), width: MUW }} />
      ))}
      
      {/* mini pianali full */}
      {[0, 2, 4, 6].map(i => (
        <div key={`m-plank-f-${i}`} className="absolute left-0 right-0 bg-zinc-300" style={{ top: i * (MROW + MPLANK), height: MPLANK }} />
      ))}
      {/* mini pianali partial */}
      {[1, 3].map(i => (
        <div key={`m-plank-p-${i}`} className="absolute left-0 bg-zinc-300" style={{ top: i * (MROW + MPLANK), height: MPLANK, width: partialWidth }} />
      ))}

      {/* cella evidenziata */}
      {CELL_DEFS.map(def => {
        const sel = def.ripiano === targetR && def.colonna === targetC;
        if (!sel) return null;
        let topU = 0; let heightU = 0;
        if (def.colonna <= 2) {
          if (def.ripiano <= 4) { topU = def.ripiano - 1; heightU = 1; }
          else { topU = 4; heightU = 2; }
        } else {
          topU = (def.ripiano - 1) * 2; heightU = 2;
        }
        const top = MPLANK + topU * (MROW + MPLANK);
        const height = heightU * MROW + (heightU - 1) * MPLANK;
        const colIdx = def.colonna - 1;
        
        return (
          <div key={`${def.ripiano}-${def.colonna}`} className="absolute bg-primary/60"
            style={{ top, height, left: MUW + colIdx * (22 + MUW), width: 22 }} />
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
                const isDouble = r === 5;
                const topPx = PLANK + (r - 1) * (ROW_H + PLANK);
                return (
                  <div key={r} className="absolute w-full flex items-center justify-center"
                    style={{ top: topPx, height: isDouble ? ROW_H * 2 + PLANK : ROW_H }}>
                    <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1 py-0.5">R{r}</span>
                  </div>
                );
              })}
            </div>
            {/* Frame scaffale grande */}
            <div
              className="relative flex-1 rounded overflow-hidden shadow-lg"
              style={{ height: TOTAL_H, background: 'linear-gradient(135deg, #eeebe4 0%, #e4e0d8 100%)' }}
            >
              {/* Ombra interna per dare profondità */}
              <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.12)] pointer-events-none z-40" />
              <ShelfFrame />
              {/* Celle */}
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
          {/* Base struttura */}
          <div style={{ marginLeft: 36 }}>
            <div className="h-5 rounded-b-md shadow-lg" style={{ background: 'linear-gradient(to bottom, #4a4a4a 0%, #2a2a2a 100%)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
