/**
 * Generatore PDF del Menù Campo
 *
 * Produce un PDF con 4 sezioni:
 *  A – Menù completo per giorno
 *  B – Quantità ingredienti per singolo pasto
 *  C – Lista della spesa totale con colonna checkbox
 *  D – Lista partecipanti con allergie dichiarate
 */

import type { GiornoMenu, Piatto, TipoPasto } from '@/app/(app)/campi/tab-spesa';
import {
  PASTO_LABELS,
  normalizeSlots,
  normalizzaUnita,
  formattaQuantita,
  chiaveAggregazione,
} from '@/app/(app)/campi/tab-spesa';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PartecipantePdf {
  nome: string;
  cognome: string;
  classe?: string;
  allergie?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PASTO_KEYS: TipoPasto[] = ['colazione', 'merenda_mattina', 'pranzo', 'merenda', 'cena'];

/** Colori del brand */
const BRAND_BLUE  = [37, 99, 235] as [number, number, number];
const BRAND_LIGHT = [239, 246, 255] as [number, number, number];
const GRAY_700    = [55, 65, 81] as [number, number, number];
const GRAY_500    = [107, 114, 128] as [number, number, number];
const GRAY_200    = [229, 231, 235] as [number, number, number];
const WHITE       = [255, 255, 255] as [number, number, number];
const RED_DARK    = [185, 60, 40] as [number, number, number];

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

// ─── Generatore principale ──────────────────────────────────────────────────

export async function generaPdfMenu(
  menu: GiornoMenu[],
  piatti: Piatto[],
  nPersone: number,
  nomeCampo?: string,
  partecipanti?: PartecipantePdf[],
): Promise<void> {
  // Import dinamici (evita problemi SSR)
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

  /** Chiama autoTable e aggiorna y con finalY */
  const table = (options: any) => {
    autoTable(doc, { ...options, startY: y });
    y = (doc as any).lastAutoTable.finalY;
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

  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageW, 45, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Menu Campo', pageW / 2, 22, { align: 'center' });

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
  const hasPartecipanti = (partecipanti?.length ?? 0) > 0;
  doc.text('  A  —  Menu completo per giorno', marginL + 4, 88);
  doc.text('  B  —  Quantita ingredienti per singolo pasto', marginL + 4, 95);
  doc.text('  C  —  Lista della spesa totale con checkbox', marginL + 4, 102);
  if (hasPartecipanti) {
    doc.text('  D  —  Lista partecipanti con allergie dichiarate', marginL + 4, 109);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE A – Menù per giorno
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle('A  —  Menu completo per giorno');

  for (const giorno of menu) {
    addPageIfNeeded(50);
    subTitle(`Giorno ${giorno.giorno}`);

    const tableRows: [string, string][] = [];

    for (const pasto of PASTO_KEYS) {
      const slots = normalizeSlots(giorno[pasto], pasto);
      const labelEmoji = PASTO_LABELS[pasto];

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

    table({
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
    y += 8;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE B – Quantità ingredienti per pasto
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle(`B  —  Quantita ingredienti per singolo pasto  (${nPersone} persone)`);

  for (const giorno of menu) {
    for (const pasto of PASTO_KEYS) {
      const slots = normalizeSlots(giorno[pasto], pasto);
      const piattoIds = slots.map(s => s.piattoId ?? '').filter(Boolean);
      if (piattoIds.length === 0) continue;

      const ingredienti = calcolaIngredienti(piattoIds, piatti, nPersone);
      if (ingredienti.length === 0) continue;

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

      table({
        margin: { left: marginL, right: marginR },
        head: [['Ingrediente', `Quantita (${nPersone} pers.)`, 'Unita']],
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
      y += 10;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE C – Lista della spesa totale con checkbox
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle(`C  —  Lista della spesa totale  (${nPersone} persone)`);

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
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_500);
    doc.text("Spunta la casella a destra una volta acquistato l'ingrediente.", marginL, y);
    y += 6;

    table({
      margin: { left: marginL, right: marginR },
      head: [['#', 'Ingrediente', `Quantita (${nPersone} pers.)`, 'Unita', 'v']],
      body: ingredientiTotali.map((ing, i) => [
        String(i + 1),
        ing.nome,
        String(ing.quantita),
        ing.unita,
        '[ ]',
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
        4: { cellWidth: 10, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      theme: 'grid',
    });
    y += 8;

    // Costo totale
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
      doc.text(`Costo totale stimato: EUR ${costoTotale.toFixed(2)}`, marginL + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_500);
      doc.text(`(EUR ${(costoTotale / nPersone).toFixed(2)} a persona)`, marginL + 4, y + 11);
      y += 18;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE D – Lista partecipanti con allergie
  // ══════════════════════════════════════════════════════════════════════════

  if (hasPartecipanti && partecipanti) {
    doc.addPage();
    y = 16;
    sectionTitle('D  —  Lista partecipanti con allergie dichiarate');

    const ordinati = [...partecipanti].sort((a, b) =>
      (a.cognome + a.nome).localeCompare(b.cognome + b.nome)
    );
    const conAllergie = ordinati.filter(p => p.allergie && p.allergie.trim());

    // Riepilogo testuale
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_500);
    doc.text(
      `Totale partecipanti: ${ordinati.length}   |   Con allergie/intolleranze dichiarate: ${conAllergie.length}`,
      marginL, y
    );
    y += 7;

    // Tabella completa tutti i partecipanti
    table({
      margin: { left: marginL, right: marginR },
      head: [['#', 'Cognome', 'Nome', 'Classe / Gruppo', 'Allergie / Intolleranze']],
      body: ordinati.map((p, i) => [
        String(i + 1),
        p.cognome,
        p.nome,
        p.classe || '—',
        p.allergie || '—',
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', textColor: GRAY_500 },
        1: { cellWidth: 38 },
        2: { cellWidth: 38 },
        3: { cellWidth: 35 },
        4: { cellWidth: contentW - 121 },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      didParseCell: (data: any) => {
        if (
          data.section === 'body' &&
          data.column.index === 4 &&
          data.cell.raw !== '—' &&
          data.cell.raw !== ''
        ) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = RED_DARK;
          data.cell.styles.fillColor = [255, 251, 235];
        }
      },
      theme: 'grid',
    });
    y += 14;

    // Riquadro riepilogo SOLO partecipanti con allergie
    if (conAllergie.length > 0) {
      addPageIfNeeded(50);

      // Header rosso
      doc.setFillColor(254, 243, 199);
      doc.rect(marginL, y, contentW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...RED_DARK);
      doc.text('ATTENZIONE — Partecipanti con allergie / intolleranze', marginL + 4, y + 5.5);
      doc.setTextColor(...GRAY_700);
      y += 11;

      table({
        margin: { left: marginL, right: marginR },
        head: [['Cognome e Nome', 'Classe / Gruppo', 'Allergia / Intolleranza']],
        body: conAllergie.map(p => [
          `${p.cognome} ${p.nome}`,
          p.classe || '—',
          p.allergie || '',
        ]),
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: RED_DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: 'bold' },
          1: { cellWidth: 40 },
          2: { cellWidth: contentW - 95, fontStyle: 'bold', textColor: RED_DARK },
        },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        theme: 'grid',
      });
    }
  }

  // ── Footer su tutte le pagine ───────────────────────────────────────────────
  const totalPages = (doc as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    (doc as any).setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_500);
    doc.text(`Menu Campo${nomeCampo ? ` — ${nomeCampo}` : ''}`, marginL, 290);
    doc.text(`Pagina ${i} / ${totalPages}`, pageW - marginR, 290, { align: 'right' });
  }

  // ── Download ────────────────────────────────────────────────────────────────
  const fileName = `menu-campo${nomeCampo ? `-${nomeCampo.replace(/\s+/g, '-').toLowerCase()}` : ''}.pdf`;
  doc.save(fileName);
}
