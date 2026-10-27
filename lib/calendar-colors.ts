export interface CalendarColor {
  id: string;
  label: string;
  hex: string;
}

/** Palette of available user calendar colors */
export const CALENDAR_COLORS: CalendarColor[] = [
  { id: 'indigo',   label: 'Indaco',      hex: '#6366f1' },
  { id: 'rose',     label: 'Rosa',        hex: '#f43f5e' },
  { id: 'orange',   label: 'Arancione',   hex: '#f97316' },
  { id: 'teal',     label: 'Turchese',    hex: '#14b8a6' },
  { id: 'purple',   label: 'Viola',       hex: '#a855f7' },
  { id: 'sky',      label: 'Azzurro',     hex: '#0ea5e9' },
  { id: 'amber',    label: 'Ambra',       hex: '#f59e0b' },
  { id: 'red',      label: 'Rosso',       hex: '#ef4444' },
  { id: 'emerald',  label: 'Verde',       hex: '#10b981' },
  { id: 'pink',     label: 'Rosa caldo',  hex: '#ec4899' },
  { id: 'cyan',     label: 'Ciano',       hex: '#06b6d4' },
  { id: 'lime',     label: 'Lime',        hex: '#84cc16' },
];

/**
 * Shared group-index color palette — identical to the dashboard MEMBER_COLORS.
 * The calendar and dashboard both use this for automatic group coloring.
 * Index 0 = first group in the list, index 1 = second, etc.
 */
export const GROUP_INDEX_COLORS: string[] = [
  '#6366f1', // indigo  (index 0)
  '#10b981', // emerald (index 1)
  '#f59e0b', // amber   (index 2)
  '#ef4444', // red     (index 3)
  '#8b5cf6', // violet  (index 4)
  '#06b6d4', // cyan    (index 5)
  '#f97316', // orange  (index 6)
  '#14b8a6', // teal    (index 7)
];

/**
 * Returns the automatic hex color for a group at the given index.
 * Matches the color shown in the dashboard legend.
 * Returns the first color for any negative index (group not found fallback).
 */
export function getGroupIndexColor(index: number): string {
  if (index < 0) return GROUP_INDEX_COLORS[0];
  return GROUP_INDEX_COLORS[index % GROUP_INDEX_COLORS.length];
}

/**
 * Returns the hex string for a manually-chosen colorId,
 * or undefined to fall back to the automatic group-index color.
 */
export function getCalendarColorHex(colorId?: string): string | undefined {
  if (!colorId || colorId === 'default') return undefined;
  return CALENDAR_COLORS.find(c => c.id === colorId)?.hex;
}
