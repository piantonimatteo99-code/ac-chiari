'use client';

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

      {/* Scaffale grafico realistico */}
      <div className="w-full select-none">
        {/* Header colonne */}
        <div className="flex mb-1 pl-7">
          {Array.from({ length: COLONNE }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[11px] text-muted-foreground font-medium"
            >
              Col {i + 1}
            </div>
          ))}
        </div>

        {/* Ripiani */}
        {Array.from({ length: RIPIANI }, (_, ri) => {
          const ripiano = ri + 1;
          return (
            <div key={ripiano} className="relative mb-1">
              {/* Label ripiano */}
              <span className="absolute -left-0 top-1/2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground w-6 text-center">
                R{ripiano}
              </span>

              {/* Struttura scaffale: montante sx + celle + montante dx */}
              <div className="flex items-stretch ml-7">
                {/* Montante sinistro */}
                <div className="w-2 bg-gradient-to-r from-zinc-400 to-zinc-300 dark:from-zinc-600 dark:to-zinc-500 rounded-l-sm flex-shrink-0 shadow-sm" />

                {/* Celle (piano del ripiano) */}
                <div className="flex flex-1 border-t-4 border-b border-zinc-300 dark:border-zinc-600 bg-amber-50/70 dark:bg-amber-950/20">
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
                          'flex-1 h-14 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 border-r last:border-r-0 border-zinc-200 dark:border-zinc-700',
                          'hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                          selected
                            ? 'bg-primary/20 text-primary shadow-inner'
                            : '',
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

                {/* Montante destro */}
                <div className="w-2 bg-gradient-to-l from-zinc-400 to-zinc-300 dark:from-zinc-600 dark:to-zinc-500 rounded-r-sm flex-shrink-0 shadow-sm" />
              </div>
            </div>
          );
        })}

        {/* Base dello scaffale */}
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

  const CELL_W = 10; // px larghezza cella
  const CELL_H = 7;  // px altezza cella (lievemente ridotta per 5 ripiani)
  const POST_W = 3;  // px montante
  const totalW = POST_W + COLONNE * CELL_W + POST_W;
  const totalH = RIPIANI * (CELL_H + 2) + 3; // +2 bordo ripiano, +3 base

  return (
    <div
      className="relative inline-block flex-shrink-0"
      title={`Ripiano ${targetR}, Colonna ${targetC}`}
      style={{ width: totalW, height: totalH }}
    >
      {/* Ripiani */}
      {Array.from({ length: RIPIANI }, (_, ri) => {
        const rip = ri + 1;
        const top = ri * (CELL_H + 2);
        return (
          <div
            key={rip}
            className="absolute flex items-stretch"
            style={{ top, left: 0, right: 0, height: CELL_H + 2 }}
          >
            {/* Montante sx */}
            <div
              className="bg-zinc-400 dark:bg-zinc-500 flex-shrink-0"
              style={{ width: POST_W, height: CELL_H + 2 }}
            />
            {/* Celle */}
            <div
              className="flex flex-1 border-t-2 border-zinc-400 dark:border-zinc-500 bg-amber-50 dark:bg-amber-950/30"
              style={{ height: CELL_H + 2 }}
            >
              {Array.from({ length: COLONNE }, (_, ci) => {
                const col = ci + 1;
                const isSelected = rip === targetR && col === targetC;
                return (
                  <div
                    key={col}
                    className={cn(
                      'flex-1 border-r last:border-r-0 border-zinc-200/60 dark:border-zinc-700/60',
                      isSelected ? 'bg-primary' : ''
                    )}
                    style={{ height: CELL_H }}
                  />
                );
              })}
            </div>
            {/* Montante dx */}
            <div
              className="bg-zinc-400 dark:bg-zinc-500 flex-shrink-0"
              style={{ width: POST_W, height: CELL_H + 2 }}
            />
          </div>
        );
      })}
      {/* Base */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-500 dark:bg-zinc-600 rounded-b"
        style={{ height: 3 }}
      />
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
  /** Giorni mancanti per considerare "in scadenza" */
  giorniAllerta?: number;
  /** Callback al click su una cella occupata */
  onCellClick?: (items: ShelfItem[], ripiano: number, colonna: number) => void;
}

/** Calcola i giorni alla scadenza (negativo = già scaduto). */
function daysUntil(isoDate?: string): number {
  if (!isoDate) return Infinity;
  try {
    const diff = Math.ceil(
      (new Date(isoDate).getTime() - new Date().setHours(0, 0, 0, 0)) /
        86_400_000
    );
    return diff;
  } catch {
    return Infinity;
  }
}

function cellStatus(cellItems: ShelfItem[], giorniAllerta: number) {
  if (cellItems.length === 0) return 'empty';
  const hasScaduto = cellItems.some(i => daysUntil(i.dataScadenza) < 0);
  const hasAllerta = cellItems.some(
    i => daysUntil(i.dataScadenza) >= 0 && daysUntil(i.dataScadenza) <= giorniAllerta
  );
  if (hasScaduto) return 'expired';
  if (hasAllerta) return 'warning';
  return 'ok';
}

const STATUS_CLASSES = {
  empty:
    'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
  ok: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 cursor-pointer',
  warning:
    'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 hover:bg-amber-100/80 dark:hover:bg-amber-900/60 cursor-pointer',
  expired:
    'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 hover:bg-red-100/80 dark:hover:bg-red-900/60 cursor-pointer',
};

const DOT_CLASSES = {
  empty: '',
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  expired: 'bg-red-500',
};

export function ShelfMap({ items, giorniAllerta = 7, onCellClick }: ShelfMapProps) {
  // Raggruppa per (ripiano, colonna)
  const grid: Record<string, ShelfItem[]> = {};
  for (const item of items) {
    const key = `${item.posizione.ripiano}-${item.posizione.colonna}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(item);
  }

  const totalItems = items.length;
  const occupiedCells = Object.values(grid).filter(c => c.length > 0).length;
  const totalCells = RIPIANI * COLONNE;

  return (
    <div className="space-y-4">
      {/* Legenda + statistiche */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Presente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> In scadenza
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Scaduto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700 inline-block" /> Vuoto
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          {occupiedCells}/{totalCells} celle · {totalItems} prodotti
        </div>
      </div>

      {/* Scaffale grafico grande */}
      <div className="w-full select-none overflow-x-auto">
        <div className="min-w-[340px]">
          {/* Header colonne */}
          <div className="flex mb-2" style={{ paddingLeft: '2.25rem' }}>
            {Array.from({ length: COLONNE }, (_, ci) => (
              <div
                key={ci}
                className="flex-1 text-center text-xs font-semibold text-muted-foreground tracking-wide"
              >
                Sez. {ci + 1}
              </div>
            ))}
          </div>

          {/* Struttura scaffale */}
          {Array.from({ length: RIPIANI }, (_, ri) => {
            const ripiano = ri + 1;
            return (
              <div key={ripiano} className="relative mb-1 flex items-stretch">
                {/* Label ripiano */}
                <div className="w-9 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1 py-0.5">
                    R{ripiano}
                  </span>
                </div>

                {/* Montante sinistro */}
                <div className="w-2.5 bg-gradient-to-r from-zinc-500 to-zinc-400 dark:from-zinc-500 dark:to-zinc-600 flex-shrink-0 rounded-l shadow-sm" />

                {/* Celle */}
                <div className="flex flex-1 border-t-[5px] border-b-2 border-zinc-400 dark:border-zinc-500">
                  {Array.from({ length: COLONNE }, (_, ci) => {
                    const colonna = ci + 1;
                    const key = `${ripiano}-${colonna}`;
                    const cellItems = grid[key] ?? [];
                    const status = cellStatus(cellItems, giorniAllerta);
                    const isEmpty = status === 'empty';

                    // Prodotto con scadenza più vicina
                    const sorted = [...cellItems].sort((a, b) =>
                      daysUntil(a.dataScadenza) - daysUntil(b.dataScadenza)
                    );
                    const first = sorted[0];
                    const days = first ? daysUntil(first.dataScadenza) : Infinity;

                    return (
                      <div
                        key={colonna}
                        role={isEmpty ? undefined : 'button'}
                        tabIndex={isEmpty ? undefined : 0}
                        onClick={() =>
                          !isEmpty && onCellClick?.(cellItems, ripiano, colonna)
                        }
                        onKeyDown={e => {
                          if (!isEmpty && (e.key === 'Enter' || e.key === ' '))
                            onCellClick?.(cellItems, ripiano, colonna);
                        }}
                        title={
                          isEmpty
                            ? `Ripiano ${ripiano}, Sez. ${colonna} — vuoto`
                            : cellItems.map(i => i.nome).join(', ')
                        }
                        className={cn(
                          'flex-1 min-h-[72px] flex flex-col items-center justify-center gap-1',
                          'border-r last:border-r-0 border-zinc-300 dark:border-zinc-600',
                          'transition-all duration-150 p-1.5',
                          STATUS_CLASSES[status]
                        )}
                      >
                        {isEmpty ? (
                          <span className="text-[10px] text-zinc-300 dark:text-zinc-600 font-mono">
                            —
                          </span>
                        ) : (
                          <>
                            {/* Indicatore stato + count */}
                            <div className="flex items-center gap-1">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full flex-shrink-0',
                                  DOT_CLASSES[status]
                                )}
                              />
                              {cellItems.length > 1 && (
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  ×{cellItems.length}
                                </span>
                              )}
                            </div>

                            {/* Nome prodotto (troncato) */}
                            <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2 max-w-full px-1">
                              {cellItems.length === 1
                                ? first?.nome
                                : `${first?.nome}${cellItems.length > 1 ? ` +${cellItems.length - 1}` : ''}`}
                            </span>

                            {/* Badge scadenza */}
                            {first && days !== Infinity && (
                              <span
                                className={cn(
                                  'text-[9px] font-mono px-1 py-0.5 rounded leading-none',
                                  days < 0
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                    : days <= giorniAllerta
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
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

                {/* Montante destro */}
                <div className="w-2.5 bg-gradient-to-l from-zinc-500 to-zinc-400 dark:from-zinc-500 dark:to-zinc-600 flex-shrink-0 rounded-r shadow-sm" />
              </div>
            );
          })}

          {/* Base */}
          <div
            className="h-4 bg-gradient-to-b from-zinc-500 to-zinc-600 dark:from-zinc-600 dark:to-zinc-700 rounded-b-md shadow-md"
            style={{ marginLeft: '2.25rem' }}
          />
        </div>
      </div>
    </div>
  );
}
