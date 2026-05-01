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

// ─── Geometria calibrata sull'immagine reale scaffale-bg.png ─────────────────
// 4 montanti a ~3%, ~34%, ~65%, ~97% larghezza
// Contenuto verticale: 5% top → 95% bottom = 90%, diviso in 6 unità (R1-R4=1u, R5=2u)
const BAY_DEFS = [
  { left: 4.0,  width: 29.0 }, // Sez 1 (sinistra)
  { left: 34.5, width: 29.0 }, // Sez 2 (centro)
  { left: 65.5, width: 30.0 }, // Sez 3 (destra)
];
const TOP_PAD = 7.5;  // % dall'alto del primo spazio utile
const UNIT_H  = 12.5; // % altezza di 1 unità logica
// R1-R4=1u, R5=2u → 6u=75%, bottom edge a 7.5+75=82.5%

function colGeometry(_numCols: number, colIdx: number) {
  const bay = BAY_DEFS[colIdx] ?? BAY_DEFS[0];
  return { left: `${bay.left}%`, width: `${bay.width}%` };
}

function cellGeometry(ripiano: number, colonna: number) {
  if (colonna <= 2) {
    if (ripiano <= 4) {
      const top = TOP_PAD + (ripiano - 1) * UNIT_H;
      return { top: `${top.toFixed(2)}%`, height: `${UNIT_H.toFixed(2)}%` };
    } else {
      // R5 = doppio
      const top = TOP_PAD + 4 * UNIT_H;
      return { top: `${top.toFixed(2)}%`, height: `${(2 * UNIT_H).toFixed(2)}%` };
    }
  } else {
    // Colonna 3: 3 ripiani, ognuno = 2 unità
    const top = TOP_PAD + (ripiano - 1) * 2 * UNIT_H;
    return { top: `${top.toFixed(2)}%`, height: `${(2 * UNIT_H).toFixed(2)}%` };
  }
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
                const isDouble = r === 5;
                const { top, height } = cellGeometry(r, 1);
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
              style={{ height: '500px' }}
            >
              <ShelfBg />
              {/* Celle interattive */}
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
