/**
 * Generatore PDF del Menù Campo
 *
 * Produce un PDF con 3 sezioni:
 *  A – Menù completo per giorno
 *  B – Quantità ingredienti per singolo pasto
 *  C – Lista della spesa totale con colonna checkbox
 */

import type { GiornoMenu, Piatto, TipoPasto } from '@/app/(app)/campi/tab-spesa';
import {
  PASTO_LABELS,
  normalizeSlots,
  normalizzaUnita,
  formattaQuantita,
  chiaveAggregazione,
} from '@/app/(app)/campi/tab-spesa';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PASTO_KEYS: TipoPasto[] = ['colazione', 'merenda_mattina', 'pranzo', 'merenda', 'cena'];

/** Colori del brand */
const BRAND_BLUE  = [37, 99, 235] as [number, number, number];
const BRAND_LIGHT = [239, 246, 255] as [number, number, number];
const GRAY_700    = [55, 65, 81] as [number, number, number];
const GRAY_500    = [107, 114, 128] as [number, number, number];
const GRAY_200    = [229, 231, 235] as [number, number, number];
const WHITE       = [255, 255, 255] as [number, number, number];

type IngTotale = { nome: string; quantita: number; unita: string };

/** Calcola gli ingredienti totali per una lista di piattoId */
function calcolaIngredienti(
  piattoIds: string[],
  piatti: Piatto[],
  nPersone: number,
): IngTotale[] {
  const totali: Record<string, { valoreBase: number; base: 'g' | 'ml' | 'altro'; unitaOriginale: string }> = {};

  for (const id of piattoIds) {
    if (!id) continue;
    const piatto = piatti.find(p => p.id === id);
    if (!piatto) continue;
    const usaNomePiatto = (piatto.ingredienti?.length ?? 0) === 1;
    piatto.ingredienti?.forEach(ing => {
      const nomeDisplay = usaNomePiatto ? piatto.nome : (ing.nome?.trim() || piatto.nome);
      const { valore, base } = normalizzaUnita(ing.quantitaPerPersona, ing.unita);
      const k = chiaveAggregazione(nomeDisplay, ing.unita);
      if (!totali[k]) totali[k] = { valoreBase: 0, base, unitaOriginale: ing.unita };
      totali[k].valoreBase += valore * nPersone;
    });
  }

  return Object.entries(totali)
    .map(([k, v]) => {
      const nome = k.split('__')[0];
      const { quantita, unita } = formattaQuantita(v.valoreBase, v.base, v.unitaOriginale);
      return { nome, quantita, unita };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Restituisce i nomi dei piatti per un pasto */
function nomiPiatti(
  slots: ReturnType<typeof normalizeSlots>,
  piatti: Piatto[],
): string {
  const nomi = slots
    .map(s => s.piattoId ? piatti.find(p => p.id === s.piattoId)?.nome : null)
    .filter(Boolean) as string[];
  return nomi.length > 0 ? nomi.join(', ') : '—';
}

// ─── Generatore principale ──────────────────────────────────────────────────

export async function generaPdfMenu(
  menu: GiornoMenu[],
  piatti: Piatto[],
  nPersone: number,
  nomeCampo?: string,
): Promise<void> {
  // Importazione dinamica per evitare problemi SSR
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default ?? (jsPDFModule as any).jsPDF;
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
  const pageW = 210;
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  let y = 0;

  // ── Utilità ────────────────────────────────────────────────────────────────

  const addPageIfNeeded = (needed = 30) => {
    if (y + needed > 270) {
      doc.addPage();
      y = 16;
    }
  };

  const sectionTitle = (text: string) => {
    addPageIfNeeded(20);
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(marginL, y, contentW, 10, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(text, marginL + 4, y + 7);
    doc.setTextColor(...GRAY_700);
    y += 14;
  };

  const subTitle = (text: string) => {
    addPageIfNeeded(14);
    doc.setFillColor(...BRAND_LIGHT);
    doc.rect(marginL, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_BLUE);
    doc.text(text, marginL + 3, y + 5.5);
    doc.setTextColor(...GRAY_700);
    y += 11;
  };

  // ── Copertina ──────────────────────────────────────────────────────────────

  // Header colorato
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageW, 45, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('📋 Menù Campo', pageW / 2, 22, { align: 'center' });

  if (nomeCampo) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(nomeCampo, pageW / 2, 33, { align: 'center' });
  }

  // Info box
  const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(marginL, 52, contentW, 18, 'F');
  doc.setTextColor(...GRAY_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Data generazione: ${oggi}`, marginL + 4, 60);
  doc.text(`Numero partecipanti: ${nPersone}`, marginL + 4, 66);
  doc.text(`Giorni di campo: ${menu.length}`, marginL + 100, 60);
  doc.text(`Pasti totali: ${menu.length * PASTO_KEYS.length}`, marginL + 100, 66);

  // Indice
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GRAY_700);
  doc.text('Contenuto del documento', marginL, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_500);
  doc.text('  A  —  Menù completo per giorno', marginL + 4, 88);
  doc.text('  B  —  Quantità ingredienti per singolo pasto', marginL + 4, 95);
  doc.text('  C  —  Lista della spesa totale con checkbox', marginL + 4, 102);

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE A – Menù per giorno
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle('A  —  Menù completo per giorno');

  for (const giorno of menu) {
    addPageIfNeeded(50);
    subTitle(`Giorno ${giorno.giorno}`);

    const tableRows: [string, string][] = [];

    for (const pasto of PASTO_KEYS) {
      const slots = normalizeSlots(giorno[pasto], pasto);
      const labelEmoji = PASTO_LABELS[pasto];

      // Raggruppa per label (Primo, Secondo, ecc.)
      const righe: { label: string; nome: string }[] = [];
      for (const slot of slots) {
        const piatto = slot.piattoId ? piatti.find(p => p.id === slot.piattoId) : null;
        if (piatto) {
          righe.push({ label: slot.label, nome: piatto.nome });
        }
      }

      if (righe.length === 0) {
        tableRows.push([labelEmoji, '—']);
      } else if (righe.length === 1) {
        tableRows.push([labelEmoji, righe[0].nome]);
      } else {
        tableRows.push([labelEmoji, righe.map(r => `${r.label}: ${r.nome}`).join('\n')]);
      }
    }

    doc.autoTable({
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [['Pasto', 'Piatti']],
      body: tableRows,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: GRAY_200, textColor: GRAY_700, fontStyle: 'bold', fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold', textColor: BRAND_BLUE },
        1: { cellWidth: contentW - 45 },
      },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE B – Quantità ingredienti per pasto
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle(`B  —  Quantità ingredienti per singolo pasto  (${nPersone} persone)`);

  for (const giorno of menu) {
    for (const pasto of PASTO_KEYS) {
      const slots = normalizeSlots(giorno[pasto], pasto);
      const piattoIds = slots.map(s => s.piattoId ?? '').filter(Boolean);
      if (piattoIds.length === 0) continue;

      const ingredienti = calcolaIngredienti(piattoIds, piatti, nPersone);
      if (ingredienti.length === 0) continue;

      // Nomi piatti in questo pasto
      const nomiPiattiPasto = piattoIds
        .map(id => piatti.find(p => p.id === id)?.nome)
        .filter(Boolean)
        .join(', ');

      addPageIfNeeded(30);
      subTitle(`Giorno ${giorno.giorno} — ${PASTO_LABELS[pasto]}`);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_500);
      doc.text(`Piatti: ${nomiPiattiPasto}`, marginL + 2, y);
      y += 5;

      doc.autoTable({
        startY: y,
        margin: { left: marginL, right: marginR },
        head: [['Ingrediente', `Quantità (${nPersone} pers.)`, 'Unità']],
        body: ingredienti.map(ing => [ing.nome, String(ing.quantita), ing.unita]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: GRAY_200, textColor: GRAY_700, fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: contentW - 50 },
          1: { cellWidth: 30, halign: 'right' },
          2: { cellWidth: 20, halign: 'center' },
        },
        theme: 'striped',
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE C – Lista della spesa totale con checkbox
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle(`C  —  Lista della spesa totale  (${nPersone} persone)`);

  // Calcola ingredienti totali su tutti i giorni/pasti
  const tuttiGliId: string[] = [];
  for (const giorno of menu) {
    for (const pasto of PASTO_KEYS) {
      const slots = normalizeSlots(giorno[pasto], pasto);
      slots.forEach(s => { if (s.piattoId) tuttiGliId.push(s.piattoId); });
    }
  }
  const ingredientiTotali = calcolaIngredienti(tuttiGliId, piatti, nPersone);

  if (ingredientiTotali.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...GRAY_500);
    doc.text('Nessun ingrediente calcolato. Controlla che i piatti abbiano ingredienti inseriti.', marginL, y + 10);
  } else {
    // Istruzioni
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_500);
    doc.text('Spunta la casella a destra una volta acquistato l\'ingrediente.', marginL, y);
    y += 6;

    doc.autoTable({
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [['#', 'Ingrediente', `Quantità (${nPersone} pers.)`, 'Unità', '✓']],
      body: ingredientiTotali.map((ing, i) => [
        String(i + 1),
        ing.nome,
        String(ing.quantita),
        ing.unita,
        '⬜',
      ]),
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: {
        fillColor: BRAND_BLUE,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', textColor: GRAY_500 },
        1: { cellWidth: contentW - 60 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 10, halign: 'center', fontSize: 14 },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 8;

    // Riepilogo costo
    const costoTotale = tuttiGliId.reduce((acc, id) => {
      const piatto = piatti.find(p => p.id === id);
      return acc + (piatto?.costoPorzione ?? 0) * nPersone;
    }, 0);

    if (costoTotale > 0) {
      addPageIfNeeded(20);
      doc.setFillColor(...BRAND_LIGHT);
      doc.rect(marginL, y, contentW, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...BRAND_BLUE);
      doc.text(`Costo totale stimato: € ${costoTotale.toFixed(2)}`, marginL + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_500);
      doc.text(`(€ ${(costoTotale / nPersone).toFixed(2)} a persona)`, marginL + 4, y + 11);
    }
  }

  // ── Footer su tutte le pagine ───────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_500);
    doc.text(`Menù Campo${nomeCampo ? ` — ${nomeCampo}` : ''}`, marginL, 290);
    doc.text(`Pagina ${i} / ${totalPages}`, pageW - marginR, 290, { align: 'right' });
  }

  // ── Download ────────────────────────────────────────────────────────────────
  const fileName = `menu-campo${nomeCampo ? `-${nomeCampo.replace(/\s+/g, '-').toLowerCase()}` : ''}.pdf`;
  doc.save(fileName);
}
