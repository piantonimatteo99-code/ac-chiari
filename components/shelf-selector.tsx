'use client';

import { cn } from '@/lib/utils';

export interface ShelfPosition {
  ripiano: number; // 1 (top) to 4 (bottom)
  colonna: number; // 1 (left) to 4 (right)
}

interface ShelfSelectorProps {
  value?: ShelfPosition | null;
  onChange: (pos: ShelfPosition) => void;
  disabled?: boolean;
}

const RIPIANI = 4;
const COLONNE = 4;

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
  const CELL_H = 8;  // px altezza cella
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
