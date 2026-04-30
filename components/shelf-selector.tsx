'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ShelfPosition {
  ripiano: number;
  colonna: number;
}

interface ShelfSelectorProps {
  value?: ShelfPosition | null;
  onChange: (pos: ShelfPosition) => void;
  disabled?: boolean;
}

export const RIPIANI = 5;
export const COLONNE = 4;

// ─── Struttura Scaffale Condivisa ──────────────────────────────────────────────
// Rispecchia fedelmente lo scaffale fisico: le prime 3 sezioni hanno 5 ripiani,
// l'ultima sezione ne ha 3 (con i primi due di altezza doppia).

export type CellDef = { colonna: number; ripiano: number; gridRow: string; isLast: boolean };
export const CELL_DEFS: CellDef[] = [];
for (let c = 1; c <= 3; c++) {
  for (let r = 1; r <= 5; r++) {
    CELL_DEFS.push({ colonna: c, ripiano: r, gridRow: `${r}`, isLast: r === 5 });
  }
}
// Colonna 4 (3 spazi: i primi due occupano 2 righe della griglia, l'ultimo 1 riga)
CELL_DEFS.push({ colonna: 4, ripiano: 1, gridRow: '1 / span 2', isLast: false });
CELL_DEFS.push({ colonna: 4, ripiano: 2, gridRow: '3 / span 2', isLast: false });
CELL_DEFS.push({ colonna: 4, ripiano: 3, gridRow: '5 / span 1', isLast: true });

export const UPRIGHTS: { colonna: number; type: 'left' | 'right' }[] = [];
for (let c = 1; c <= COLONNE; c++) {
  UPRIGHTS.push({ colonna: c, type: 'left' });
  UPRIGHTS.push({ colonna: c, type: 'right' });
}

export const LABELS = [1, 2, 3, 4, 5];

export function getGridCol(colonna: number, hasLabel: boolean) {
  const ci = colonna - 1;
  const base = ci * 3 + 2;
  return hasLabel ? base + 1 : base;
}

export function getUprightCol(colonna: number, type: 'left' | 'right', hasLabel: boolean) {
  const ci = colonna - 1;
  const base = type === 'left' ? ci * 3 + 1 : ci * 3 + 3;
  return hasLabel ? base + 1 : base;
}

// Gradienti metallici per i montanti
const POST_LEFT  = { background: 'linear-gradient(to right,  #71717a 0%, #a1a1aa 50%, #d4d4d8 100%)' };
const POST_RIGHT = { background: 'linear-gradient(to left,   #71717a 0%, #a1a1aa 50%, #d4d4d8 100%)' };
const BASE_STYLE = { background: 'linear-gradient(to bottom, #52525b 0%, #3f3f46 100%)' };

// ─── Scaffale interattivo (grande, per il form) ────────────────────────────────

export function ShelfSelector({ value, onChange, disabled }: ShelfSelectorProps) {
  const isSelected = (r: number, c: number) => value?.ripiano === r && value?.colonna === c;
  const gridCols = `2rem repeat(${COLONNE}, 10px 1fr 10px)`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clicca sulla cella dello scaffale per indicare la posizione del prodotto
      </p>

      <div className="w-full select-none overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols }} className="mb-1">
            <div />
            {Array.from({ length: COLONNE }, (_, ci) => (
              <div
                key={ci}
                style={{ gridColumn: getGridCol(ci + 1, true) }}
                className="text-center text-[11px] text-muted-foreground font-medium"
              >
                Sez. {ci + 1}
              </div>
            ))}
          </div>

          {/* Grid Ripiani */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridAutoRows: 'minmax(48px, auto)' }}>
            {/* Labels */}
            {LABELS.map(r => (
              <div key={`lbl-${r}`} style={{ gridColumn: 1, gridRow: r }} className="flex items-center justify-center pr-1">
                <span className="text-[10px] font-medium text-muted-foreground">R{r}</span>
              </div>
            ))}

            {/* Uprights */}
            {UPRIGHTS.map((u, i) => (
              <div
                key={`up-${i}`}
                style={{
                  gridColumn: getUprightCol(u.colonna, u.type, true),
                  gridRow: '1 / span 5',
                  ...(u.type === 'left' ? POST_LEFT : POST_RIGHT)
                }}
                className={cn(
                  'shadow-[inset_0_0_2px_rgba(0,0,0,0.2)]',
                  u.type === 'left' && u.colonna === 1 && 'rounded-l-sm',
                  u.type === 'right' && u.colonna === COLONNE && 'rounded-r-sm'
                )}
              />
            ))}

            {/* Cells */}
            {CELL_DEFS.map(def => {
              const selected = isSelected(def.ripiano, def.colonna);
              return (
                <button
                  key={`${def.ripiano}-${def.colonna}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ripiano: def.ripiano, colonna: def.colonna })}
                  style={{ gridColumn: getGridCol(def.colonna, true), gridRow: def.gridRow }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 transition-all duration-150',
                    'border-t-[4px] border-zinc-300 dark:border-zinc-500',
                    !def.isLast && 'border-b border-zinc-200 dark:border-zinc-700',
                    'hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                    selected ? 'bg-primary/20 text-primary shadow-inner' : 'bg-zinc-50/50 dark:bg-zinc-800/30',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {selected ? (
                    <span className="text-lg leading-none">📦</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                      R{def.ripiano},S{def.colonna}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Base */}
          <div style={{ paddingLeft: '2rem' }}>
            <div className="h-3 rounded-b-sm shadow" style={BASE_STYLE} />
          </div>
        </div>
      </div>

      {value && (
        <p className="text-sm font-medium text-primary">
          ✓ Ripiano {value.ripiano}, Sezione {value.colonna}
        </p>
      )}
    </div>
  );
}

// ─── Mini Scaffale (thumbnail, per le liste) ───────────────────────────────────

interface MiniShelfProps {
  posizione: ShelfPosition | null | undefined;
}

export function MiniShelf({ posizione }: MiniShelfProps) {
  if (!posizione) return null;
  const { ripiano: targetR, colonna: targetC } = posizione;

  const CELL_W = 14;
  const CELL_H = 6;
  const POST_W = 3;
  const gridCols = `repeat(${COLONNE}, ${POST_W}px ${CELL_W}px ${POST_W}px)`;

  return (
    <div className="relative inline-block flex-shrink-0" title={`Ripiano ${targetR}, Sez. ${targetC}`}>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridAutoRows: `${CELL_H}px` }}>
        {/* Uprights */}
        {UPRIGHTS.map((u, i) => (
          <div
            key={`up-${i}`}
            style={{ gridColumn: getUprightCol(u.colonna, u.type, false), gridRow: '1 / span 5' }}
            className="bg-zinc-400 dark:bg-zinc-500"
          />
        ))}

        {/* Cells */}
        {CELL_DEFS.map(def => {
          const sel = def.ripiano === targetR && def.colonna === targetC;
          return (
            <div
              key={`${def.ripiano}-${def.colonna}`}
              style={{ gridColumn: getGridCol(def.colonna, false), gridRow: def.gridRow }}
              className={cn(
                'border-t-[1.5px] border-zinc-300 dark:border-zinc-500',
                sel ? 'bg-primary' : 'bg-zinc-100 dark:bg-zinc-800'
              )}
            />
          );
        })}
      </div>
      <div className="h-[2px] bg-zinc-500 dark:bg-zinc-600 rounded-b" />
    </div>
  );
}

// ─── Mappa Scaffale Grande (visualizzazione inventario) ────────────────────────

export interface ShelfItem {
  id: string;
  nome: string;
  categoria: string;
  quantita: number;
  dataScadenza?: string;
  posizione: ShelfPosition;
}

interface ShelfMapProps {
  items: ShelfItem[];
  giorniAllerta?: number;
  onCellClick?: (items: ShelfItem[], ripiano: number, colonna: number) => void;
}

function daysUntil(isoDate?: string): number {
  if (!isoDate) return Infinity;
  try {
    return Math.ceil(
      (new Date(isoDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000
    );
  } catch {
    return Infinity;
  }
}

function cellStatus(cellItems: ShelfItem[], giorniAllerta: number) {
  if (cellItems.length === 0) return 'empty';
  if (cellItems.some(i => daysUntil(i.dataScadenza) < 0)) return 'expired';
  if (cellItems.some(i => { const d = daysUntil(i.dataScadenza); return d >= 0 && d <= giorniAllerta; })) return 'warning';
  return 'ok';
}

const DOT_CLASSES = {
  empty: '',
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  expired: 'bg-red-500',
};

export function ShelfMap({ items, giorniAllerta = 7, onCellClick }: ShelfMapProps) {
  const gridMap: Record<string, ShelfItem[]> = {};
  
  for (const item of items) {
    let { ripiano, colonna } = item.posizione;
    // Migrazione visiva: se ci sono vecchi dati con ripiano > 3 nella colonna 4, li uniamo al ripiano 3
    if (colonna === 4 && ripiano > 3) ripiano = 3;
    const k = `${ripiano}-${colonna}`;
    if (!gridMap[k]) gridMap[k] = [];
    gridMap[k].push(item);
  }

  const occupiedCells = Object.values(gridMap).filter(c => c.length > 0).length;
  const totalCells = CELL_DEFS.length; // 15 (sx) + 3 (dx) = 18

  const gridCols = `2rem repeat(${COLONNE}, 10px 1fr 10px)`;

  return (
    <div className="space-y-4">
      {/* Legenda + statistiche */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {[
            { color: 'bg-emerald-400', label: 'Presente' },
            { color: 'bg-amber-400',   label: 'In scadenza' },
            { color: 'bg-red-400',     label: 'Scaduto' },
            { color: 'bg-zinc-300 dark:bg-zinc-600', label: 'Vuoto' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn('w-3 h-3 rounded-sm inline-block', color)} />
              {label}
            </span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {occupiedCells}/{totalCells} celle · {items.length} prodotti
        </span>
      </div>

      {/* Scaffale grafico grande */}
      <div className="w-full select-none overflow-x-auto pb-2">
        <div className="min-w-[500px]">

          {/* Intestazioni sezioni */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols }} className="mb-1">
            <div />
            {Array.from({ length: COLONNE }, (_, ci) => (
              <div
                key={ci}
                style={{ gridColumn: getGridCol(ci + 1, true) }}
                className="text-center text-xs font-semibold text-muted-foreground py-1 tracking-wide"
              >
                Sez. {ci + 1}
              </div>
            ))}
          </div>

          {/* Grid Ripiani */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridAutoRows: 'minmax(76px, auto)' }}>
            
            {/* Labels Laterali */}
            {LABELS.map(r => (
              <div key={`lbl-${r}`} style={{ gridColumn: 1, gridRow: r }} className="flex items-center justify-center pr-1">
                <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                  R{r}
                </span>
              </div>
            ))}

            {/* Montanti Metallici Continui */}
            {UPRIGHTS.map((u, i) => (
              <div
                key={`up-${i}`}
                style={{
                  gridColumn: getUprightCol(u.colonna, u.type, true),
                  gridRow: '1 / span 5',
                  ...(u.type === 'left' ? POST_LEFT : POST_RIGHT)
                }}
                className={cn(
                  'shadow-[inset_0_0_3px_rgba(0,0,0,0.3)]',
                  u.type === 'left' && u.colonna === 1 && 'rounded-l-sm',
                  u.type === 'right' && u.colonna === COLONNE && 'rounded-r-sm'
                )}
              />
            ))}

            {/* Celle / Ripiani */}
            {CELL_DEFS.map(def => {
              const cellItems = gridMap[`${def.ripiano}-${def.colonna}`] ?? [];
              const status    = cellStatus(cellItems, giorniAllerta);
              const isEmpty   = status === 'empty';
              const sorted    = [...cellItems].sort((a, b) => daysUntil(a.dataScadenza) - daysUntil(b.dataScadenza));
              const first     = sorted[0];
              const days      = first ? daysUntil(first.dataScadenza) : Infinity;

              return (
                <div
                  key={`cell-${def.ripiano}-${def.colonna}`}
                  role={isEmpty ? undefined : 'button'}
                  tabIndex={isEmpty ? undefined : 0}
                  onClick={() => !isEmpty && onCellClick?.(cellItems, def.ripiano, def.colonna)}
                  onKeyDown={e => { if (!isEmpty && (e.key === 'Enter' || e.key === ' ')) onCellClick?.(cellItems, def.ripiano, def.colonna); }}
                  title={isEmpty ? `R${def.ripiano} Sez.${def.colonna} — vuoto` : cellItems.map(i => i.nome).join(', ')}
                  style={{ gridColumn: getGridCol(def.colonna, true), gridRow: def.gridRow }}
                  className={cn(
                    // Bordo superiore spesso = piano del ripiano visto frontalmente
                    'border-t-[5px]',
                    !def.isLast && 'border-b border-b-black/10 dark:border-b-black/40',
                    'flex flex-col items-center justify-center gap-1 p-2 transition-colors duration-150',
                    isEmpty
                      ? 'bg-zinc-100 dark:bg-zinc-800/60 border-t-zinc-400 dark:border-t-zinc-500'
                      : status === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-t-zinc-400 dark:border-t-zinc-500 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        : status === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-t-amber-400 dark:border-t-amber-600 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60'
                          : 'bg-red-50 dark:bg-red-950/40 border-t-red-400 dark:border-t-red-600 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/60'
                  )}
                >
                  {isEmpty ? (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono select-none">—</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_CLASSES[status])} />
                        {cellItems.length > 1 && (
                          <span className="text-[10px] font-bold text-muted-foreground">×{cellItems.length}</span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2 max-w-full">
                        {first?.nome}{cellItems.length > 1 ? ` +${cellItems.length - 1}` : ''}
                      </span>
                      {first && days !== Infinity && (
                        <span className={cn(
                          'text-[9px] font-mono px-1 py-0.5 rounded leading-none mt-0.5',
                          days < 0
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : days <= giorniAllerta
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        )}>
                          {days < 0 ? `Sc. ${Math.abs(days)}g fa` : `${days}g`}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Base dello scaffale */}
          <div style={{ paddingLeft: '2rem' }}>
            <div className="h-4 rounded-b-md shadow-md" style={BASE_STYLE} />
          </div>

        </div>
      </div>
    </div>
  );
}
