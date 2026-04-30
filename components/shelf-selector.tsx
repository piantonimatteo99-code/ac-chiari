'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ShelfPosition {
  ripiano: number; // 1 (top) to 5 (bottom)
  colonna: number; // 1 (left) to 4 (right)
}

interface ShelfSelectorProps {
  value?: ShelfPosition | null;
  onChange: (pos: ShelfPosition) => void;
  disabled?: boolean;
}

export const RIPIANI = 5;
export const COLONNE = 4;

// ─── Scaffale interattivo (grande, per il form) ────────────────────────────────
export function ShelfSelector({ value, onChange, disabled }: ShelfSelectorProps) {
  const isSelected = (r: number, c: number) =>
    value?.ripiano === r && value?.colonna === c;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clicca sulla cella dello scaffale per indicare la posizione del prodotto
      </p>

      <div className="w-full select-none">
        {/* Header colonne */}
        <div className="flex mb-1 pl-7">
          {Array.from({ length: COLONNE }, (_, i) => (
            <div key={i} className="flex-1 text-center text-[11px] text-muted-foreground font-medium">
              Col {i + 1}
            </div>
          ))}
        </div>

        {/* Ripiani */}
        {Array.from({ length: RIPIANI }, (_, ri) => {
          const ripiano = ri + 1;
          return (
            <div key={ripiano} className="relative mb-1">
              <span className="absolute -left-0 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground w-6 text-center">
                R{ripiano}
              </span>
              <div className="flex items-stretch ml-7">
                <div className="w-2 bg-gradient-to-r from-zinc-400 to-zinc-300 dark:from-zinc-600 dark:to-zinc-500 rounded-l-sm flex-shrink-0 shadow-sm" />
                <div className="flex flex-1 border-t-4 border-b border-zinc-300 dark:border-zinc-600 bg-zinc-100/80 dark:bg-zinc-800/40">
                  {Array.from({ length: COLONNE }, (_, ci) => {
                    const colonna = ci + 1;
                    const selected = isSelected(ripiano, colonna);
                    return (
                      <button
                        key={colonna}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange({ ripiano, colonna })}
                        className={cn(
                          'flex-1 h-14 flex flex-col items-center justify-center gap-0.5 transition-all duration-150',
                          'border-r last:border-r-0 border-zinc-200 dark:border-zinc-700',
                          'hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                          selected ? 'bg-primary/20 text-primary shadow-inner' : '',
                          disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        aria-label={`Ripiano ${ripiano}, Colonna ${colonna}`}
                      >
                        {selected ? (
                          <span className="text-lg leading-none">📦</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">
                            {ripiano},{colonna}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="w-2 bg-gradient-to-l from-zinc-400 to-zinc-300 dark:from-zinc-600 dark:to-zinc-500 rounded-r-sm flex-shrink-0 shadow-sm" />
              </div>
            </div>
          );
        })}

        {/* Base */}
        <div className="ml-7 h-3 bg-gradient-to-b from-zinc-400 to-zinc-500 dark:from-zinc-600 dark:to-zinc-700 rounded-b-sm shadow" />
      </div>

      {value && (
        <p className="text-sm font-medium text-primary">
          ✓ Ripiano {value.ripiano}, Colonna {value.colonna}
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

  const CELL_W = 10;
  const CELL_H = 7;
  const POST_W = 3;
  const totalW = POST_W + COLONNE * CELL_W + POST_W;
  const totalH = RIPIANI * (CELL_H + 2) + 3;

  return (
    <div
      className="relative inline-block flex-shrink-0"
      title={`Ripiano ${targetR}, Colonna ${targetC}`}
      style={{ width: totalW, height: totalH }}
    >
      {Array.from({ length: RIPIANI }, (_, ri) => {
        const rip = ri + 1;
        const top = ri * (CELL_H + 2);
        return (
          <div key={rip} className="absolute flex items-stretch" style={{ top, left: 0, right: 0, height: CELL_H + 2 }}>
            <div className="bg-zinc-400 dark:bg-zinc-500 flex-shrink-0" style={{ width: POST_W, height: CELL_H + 2 }} />
            <div className="flex flex-1 border-t-2 border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800/60" style={{ height: CELL_H + 2 }}>
              {Array.from({ length: COLONNE }, (_, ci) => {
                const col = ci + 1;
                const sel = rip === targetR && col === targetC;
                return (
                  <div
                    key={col}
                    className={cn('flex-1 border-r last:border-r-0 border-zinc-200/60 dark:border-zinc-700/60', sel ? 'bg-primary' : '')}
                    style={{ height: CELL_H }}
                  />
                );
              })}
            </div>
            <div className="bg-zinc-400 dark:bg-zinc-500 flex-shrink-0" style={{ width: POST_W, height: CELL_H + 2 }} />
          </div>
        );
      })}
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-500 dark:bg-zinc-600 rounded-b" style={{ height: 3 }} />
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

// Colori montanti metallici (inline style per gradiente personalizzato)
const POST_LEFT  = { background: 'linear-gradient(to right,  #52525b 0%, #a1a1aa 50%, #d4d4d8 100%)' };
const POST_RIGHT = { background: 'linear-gradient(to left,   #52525b 0%, #a1a1aa 50%, #d4d4d8 100%)' };
const BASE_STYLE = { background: 'linear-gradient(to bottom, #52525b 0%, #3f3f46 100%)' };

export function ShelfMap({ items, giorniAllerta = 7, onCellClick }: ShelfMapProps) {
  // Mappa (ripiano-colonna) → prodotti
  const grid: Record<string, ShelfItem[]> = {};
  for (const item of items) {
    const k = `${item.posizione.ripiano}-${item.posizione.colonna}`;
    if (!grid[k]) grid[k] = [];
    grid[k].push(item);
  }

  const occupiedCells = Object.values(grid).filter(c => c.length > 0).length;
  const totalCells = RIPIANI * COLONNE;

  /*
   * CSS Grid con template:
   *   [label 2rem] + per ogni modulo [montanteSx 10px] [cella 1fr] [montanteDx 10px]
   *
   * Tutti i ripiani condividono lo STESSO grid → le colonne "montante" sono
   * elementi CSS continui e verticali, proprio come i pali metallici reali.
   * Tra moduli adiacenti i due montanti (dx + sx) si affiancano → effetto
   * doppio palo visibile nella foto dello scaffale fisico.
   */
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

      {/* Scaffale */}
      <div className="w-full select-none overflow-x-auto">
        <div className="min-w-[500px]">

          {/* Intestazioni sezioni — stesso gridCols → perfettamente allineate */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols }} className="mb-1">
            <div />
            {Array.from({ length: COLONNE }, (_, ci) => [
              <div key={`hpL-${ci}`} />,
              <div key={`hT-${ci}`} className="text-center text-xs font-semibold text-muted-foreground py-1 tracking-wide">
                Sez. {ci + 1}
              </div>,
              <div key={`hpR-${ci}`} />,
            ])}
          </div>

          {/* Tutti i ripiani in un unico grid — i montanti sono colonne CSS continue */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gridAutoRows: 'minmax(82px, auto)' }}>
            {Array.from({ length: RIPIANI }, (_, ri) => {
              const ripiano = ri + 1;
              const isFirst = ri === 0;
              const isLast  = ri === RIPIANI - 1;
              const nodes: React.ReactNode[] = [];

              // Label
              nodes.push(
                <div key={`L-${ri}`} className="flex items-center justify-center pr-1">
                  <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                    R{ripiano}
                  </span>
                </div>
              );

              for (let ci = 0; ci < COLONNE; ci++) {
                const colonna   = ci + 1;
                const cellItems = grid[`${ripiano}-${colonna}`] ?? [];
                const status    = cellStatus(cellItems, giorniAllerta);
                const isEmpty   = status === 'empty';
                const sorted    = [...cellItems].sort((a, b) => daysUntil(a.dataScadenza) - daysUntil(b.dataScadenza));
                const first     = sorted[0];
                const days      = first ? daysUntil(first.dataScadenza) : Infinity;

                // Montante sinistro
                nodes.push(
                  <div
                    key={`pL-${ri}-${ci}`}
                    style={POST_LEFT}
                    className={cn(
                      isFirst && ci === 0           && 'rounded-tl',
                      isLast  && ci === 0           && 'rounded-bl',
                    )}
                  />
                );

                // Cella
                nodes.push(
                  <div
                    key={`C-${ri}-${ci}`}
                    role={isEmpty ? undefined : 'button'}
                    tabIndex={isEmpty ? undefined : 0}
                    onClick={() => !isEmpty && onCellClick?.(cellItems, ripiano, colonna)}
                    onKeyDown={e => { if (!isEmpty && (e.key === 'Enter' || e.key === ' ')) onCellClick?.(cellItems, ripiano, colonna); }}
                    title={isEmpty ? `R${ripiano} Sez.${colonna} — vuoto` : cellItems.map(i => i.nome).join(', ')}
                    className={cn(
                      // Bordo superiore spesso = piano del ripiano visto frontalmente
                      'border-t-[6px]',
                      !isLast && 'border-b border-b-black/10',
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

                // Montante destro
                nodes.push(
                  <div
                    key={`pR-${ri}-${ci}`}
                    style={POST_RIGHT}
                    className={cn(
                      isFirst && ci === COLONNE - 1 && 'rounded-tr',
                      isLast  && ci === COLONNE - 1 && 'rounded-br',
                    )}
                  />
                );
              }

              return nodes;
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
