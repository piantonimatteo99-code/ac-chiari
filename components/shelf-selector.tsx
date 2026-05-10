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
// Colonna 3: R1 grande (copre visivamente R1+R2), poi R2 e R3
CELL_DEFS.push({ colonna: 3, ripiano: 1, isLast: false });
CELL_DEFS.push({ colonna: 3, ripiano: 2, isLast: false });
CELL_DEFS.push({ colonna: 3, ripiano: 3, isLast: true });

export const LABELS = [1, 2, 3, 4, 5];

// ─── Configurazione Geometrica Esatta — coordinate normalizzate 0-1000 ────────
// Formato [yMin, xMin, yMax, xMax] → top=(yMin/10)%, left=(xMin/10)%, h=((yMax-yMin)/10)%, w=((xMax-xMin)/10)%
type CellGeometry = { top: string, left: string, width: string, height: string };

export const EXACT_CELLS: Record<string, CellGeometry> = {
  // Modulo Sinistro (Colonna 1) - 5 ripiani
  "1-1": { top: "9.5%", left: "3.8%", width: "29.7%", height: "12.7%" },
  "2-1": { top: "23.0%", left: "3.8%", width: "29.7%", height: "12.5%" },
  "3-1": { top: "37.5%", left: "3.8%", width: "29.7%", height: "12.5%" },
  "4-1": { top: "52.0%", left: "3.8%", width: "29.7%", height: "12.5%" },
  "5-1": { top: "66.5%", left: "3.8%", width: "29.7%", height: "12.5%" },

  // Modulo Centrale (Colonna 2) - 5 ripiani
  "1-2": { top: "9.5%", left: "35.0%", width: "29.7%", height: "12.5%" },
  "2-2": { top: "23.0%", left: "35.0%", width: "29.7%", height: "12.5%" },
  "3-2": { top: "37.5%", left: "35.0%", width: "29.7%", height: "12.5%" },
  "4-2": { top: "52.0%", left: "35.0%", width: "29.7%", height: "12.5%" },
  "5-2": { top: "66.5%", left: "35.0%", width: "29.7%", height: "12.5%" },

  // Modulo Destro (Colonna 3) - 3 ripiani
  "1-3": { top: "9.5%", left: "65.0%", width: "29.2%", height: "26.0%" },
  "2-3": { top: "37.0%", left: "65.0%", width: "29.2%", height: "26.0%" },
  "3-3": { top: "66.5%", left: "65.0%", width: "29.2%", height: "26.0%" },
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
interface MiniShelfProps { posizione: ShelfPosition | null | undefined; hasAlert?: boolean; }
export function MiniShelf({ posizione, hasAlert }: MiniShelfProps) {
  if (!posizione) return null;
  const { ripiano: targetR, colonna: targetC } = posizione;

  // Compute dot center from geometry
  const geo = getExactGeometry(targetR, targetC);
  // Parse percentage values to compute center
  const parseP = (v: string) => parseFloat(v);
  const topP = parseP(geo.top);
  const leftP = parseP(geo.left);
  const heightP = parseP(geo.height);
  const widthP = parseP(geo.width);
  const dotTop = `${topP + heightP / 2}%`;
  const dotLeft = `${leftP + widthP / 2}%`;

  return (
    <div
      className="relative inline-block flex-shrink-0 rounded overflow-hidden"
      title={`Ripiano ${targetR}, Sez. ${targetC}`}
      style={{ height: '50px', width: '80px' }}
    >
      {/* sfondo scaffale con filtro — non tocca i figli */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/scaffale-bg.png)',
          backgroundSize: '100% 100%',
          filter: 'saturate(0.05) brightness(1.18)',
        }}
      />
      {/* pallino posizionato al centro della cella */}
      <span
        className={cn(
          'absolute z-10 rounded-full shadow',
          hasAlert ? 'bg-red-500' : 'bg-primary'
        )}
        style={{
          top: dotTop,
          left: dotLeft,
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
        }}
      />
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
    if (ripiano > 5) ripiano = 5;
    // La colonna 3 ha solo R1 (grande), R2 e R3. Rindirizziamo R4+ in R3
    if (colonna === 3 && ripiano > 3) ripiano = 3;
    const k = `${ripiano}-${colonna}`;
    if (!gridMap[k]) gridMap[k] = [];
    gridMap[k].push(item);
  }
  const occupiedCells = Object.values(gridMap).filter(c => c.length > 0).length;
  const totalCells = CELL_DEFS.length;

  // Per-ripiano alert summary: collect all items in a given ripiano across all columns
  const ripianoAlerts: Record<number, { expired: number; warning: number; names: string[] }> = {};
  for (const [key, cellItems] of Object.entries(gridMap)) {
    const ripiano = parseInt(key.split('-')[0]);
    if (!ripianoAlerts[ripiano]) ripianoAlerts[ripiano] = { expired: 0, warning: 0, names: [] };
    for (const item of cellItems) {
      const d = daysUntil(item.dataScadenza);
      if (d < 0) { ripianoAlerts[ripiano].expired++; ripianoAlerts[ripiano].names.push(item.nome); }
      else if (d <= giorniAllerta) { ripianoAlerts[ripiano].warning++; ripianoAlerts[ripiano].names.push(item.nome); }
    }
  }

  return (
    <div className="space-y-4">
      {/* Counter */}
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground font-medium">{occupiedCells}/{totalCells} celle occupate · {items.length} prodotti</span>
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
            {/* Label ripiani + alert banner */}
            <div className="flex flex-col flex-shrink-0 relative" style={{ width: 28 }}>
              {LABELS.map(r => {
                const { top, height } = getExactGeometry(r, 1);
                return (
                  <div key={r} className="absolute w-full flex items-center justify-center"
                    style={{ top, height }}>
                    <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded px-1 py-0.5 shadow-sm">R{r}</span>
                  </div>
                );
              })}
            </div>
            {/* Frame scaffale (immagine) */}
            <div
              className="relative flex-1 rounded overflow-hidden shadow-lg border border-black/10"
              style={{ height: '500px' }}
            >
              <ShelfBg />
              {/* Celle interattive con rettangolo colorato */}
              {CELL_DEFS.map(def => {
                const key = `${def.ripiano}-${def.colonna}`;
                const cellItems = gridMap[key] || [];
                const status = cellStatus(cellItems, giorniAllerta);
                const isEmpty = status === 'empty';
                const sorted = [...cellItems].sort((a, b) => daysUntil(a.dataScadenza) - daysUntil(b.dataScadenza));
                const first = sorted[0];
                const days = first ? daysUntil(first.dataScadenza) : Infinity;
                const { top, left, width, height } = getExactGeometry(def.ripiano, def.colonna);

                return (
                  <div
                    key={`cell-${def.ripiano}-${def.colonna}`}
                    role={isEmpty ? undefined : 'button'}
                    tabIndex={isEmpty ? undefined : 0}
                    onClick={() => !isEmpty && onCellClick?.(cellItems, def.ripiano, def.colonna)}
                    onKeyDown={e => { if (!isEmpty && (e.key === 'Enter' || e.key === ' ')) onCellClick?.(cellItems, def.ripiano, def.colonna); }}
                    title={isEmpty ? `R${def.ripiano} Sez.${def.colonna} — vuoto` : cellItems.map(i => i.nome).join(', ')}
                    className={cn(
                      'absolute z-30 flex flex-col items-center justify-center gap-0.5 p-1 transition-colors duration-150',
                      STATUS_BG[status]
                    )}
                    style={{ top, height, left, width }}
                  >
                    {!isEmpty && (
                      <>
                        <div className="flex items-center gap-1">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-black/10', DOT_CLASSES[status])} />
                          {cellItems.length > 1 && <span className="text-[9px] font-bold text-zinc-600">×{cellItems.length}</span>}
                        </div>
                        <span className="text-[10px] font-semibold text-center leading-tight line-clamp-2 max-w-full text-zinc-800 drop-shadow-sm">
                          {first?.nome}{cellItems.length > 1 ? ` +${cellItems.length - 1}` : ''}
                        </span>
                        {first && days !== Infinity && (
                          <span className={cn(
                            'text-[8px] font-mono px-1 py-0.5 rounded-full leading-none',
                            days < 0 ? 'bg-red-500 text-white' : days <= giorniAllerta ? 'bg-amber-500 text-white' : 'bg-white/70 text-zinc-600'
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
          </div>

          {/* Alert banner per ripiano */}
          <div className="mt-3 space-y-1.5" style={{ paddingLeft: 36 }}>
            {LABELS.map(r => {
              const alert = ripianoAlerts[r];
              if (!alert || (alert.expired === 0 && alert.warning === 0)) return null;
              const isExpired = alert.expired > 0;
              return (
                <div
                  key={`alert-r${r}`}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium',
                    isExpired
                      ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
                      : 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
                  )}
                >
                  <span>{isExpired ? '🔴' : '⚠️'}</span>
                  <span className="font-bold">Ripiano {r}:</span>
                  <span>
                    {isExpired && alert.expired > 0 && `${alert.expired} scaduto/i`}
                    {isExpired && alert.warning > 0 && `, `}
                    {alert.warning > 0 && `${alert.warning} in scadenza`}
                    {' — '}
                    {alert.names.join(', ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
