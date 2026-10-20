import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export function parseCustomDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  const str = String(dateString).trim();
  if (!str) return null;

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // YYYY-MM-DD or other valid strings
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

export function formatDisplayDate(dateString?: string | null, fallback = '—'): string {
  if (!dateString) return fallback;
  const d = parseCustomDate(dateString);
  if (!d) return fallback === '—' && dateString ? dateString : fallback;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
