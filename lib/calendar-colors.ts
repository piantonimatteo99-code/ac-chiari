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
 * Returns the hex string for a given colorId,
 * or undefined to fall back to the CSS --primary variable.
 */
export function getCalendarColorHex(colorId?: string): string | undefined {
  if (!colorId || colorId === 'default') return undefined;
  return CALENDAR_COLORS.find(c => c.id === colorId)?.hex;
}
