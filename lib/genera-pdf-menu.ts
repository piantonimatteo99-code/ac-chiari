/**
 * Generatore PDF del Menu Campo
 *
 * Sezioni:
 *  A – Menu completo per giorno
 *  B – Quantita ingredienti per singolo pasto
 *  C – Lista della spesa con colonne allergeni e checkbox
 *  D – Lista partecipanti con allergie dichiarate
 */

import type { GiornoMenu, Piatto, TipoPasto, IngredienteDettaglio } from '@/app/(app)/campi/tab-spesa';
import {
  normalizeSlots,
  normalizzaUnita,
  formattaQuantita,
  chiaveAggregazione,
  fattoreConversione,
  ottieniPrezzoIngrediente,
  ottieniAllergeniIngrediente,
} from '@/app/(app)/campi/tab-spesa';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PartecipantePdf {
  nome: string;
  cognome: string;
  classe?: string;
  allergie?: string;
}

function calcolaCostoPiattoPersona(piatto: Piatto, ingredientiDb?: IngredienteDettaglio[]): number {
  if (!piatto.ingredienti || piatto.ingredienti.length === 0) return 0;
  const porzioniRef = piatto.porzioniBase || 10;
  const costo = piatto.ingredienti.reduce((acc, ing) => {
    const prezzo = ingredientiDb ? ottieniPrezzoIngrediente(ing.nome, ing.prezzoPerUnita, ingredientiDb) : (ing.prezzoPerUnita || 0);
    const qPersona = (ing.quantitaPerPersona || 0) / porzioniRef;
    const fattore = fattoreConversione(ing.unita);
    return acc + (qPersona * fattore * prezzo);
  }, 0);
  return Math.round(costo * 100) / 100;
}

type IngTotale = {
  nome: string;
  quantita: number;
  unita: string;
  allergeni: Set<string>;
};

// ─── Costanti ────────────────────────────────────────────────────────────────

const PASTO_KEYS: TipoPasto[] = ['colazione', 'merenda_mattina', 'pranzo', 'merenda', 'cena'];

// Etichette SENZA emoji (jsPDF non le supporta)
const PASTO_PLAIN: Record<TipoPasto, string> = {
  colazione:      'Colazione',
  merenda_mattina:'Merenda mattina',
  pranzo:         'Pranzo',
  merenda:        'Merenda',
  cena:           'Cena',
};

const BRAND_BLUE  = [37, 99, 235]   as [number, number, number];
const BRAND_LIGHT = [239, 246, 255] as [number, number, number];
const GRAY_700    = [55, 65, 81]    as [number, number, number];
const GRAY_500    = [107, 114, 128] as [number, number, number];
const GRAY_200    = [229, 231, 235] as [number, number, number];
const WHITE       = [255, 255, 255] as [number, number, number];
const RED_DARK    = [185, 60, 40]   as [number, number, number];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Estrae gli allergeni dal campo `note` del piatto.
 *  Formato: "Lattosio, Glutine | Note libere..."
 *  Gli allergeni sono nella parte prima del primo "|"
 */
function allergeniDaNota(note?: string): string[] {
  if (!note || !note.trim()) return [];
  const parteAllergeni = note.split('|')[0]; // prende solo la parte prima del "|"
  return parteAllergeni
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Calcola ingredienti totali aggregati, includendo gli allergeni di ogni piatto */
function calcolaIngredienti(
  piattoIds: string[],
  piatti: Piatto[],
  nPersone: number,
  ingredientiDb?: IngredienteDettaglio[],
): IngTotale[] {
  const totali: Record<string, {
    valoreBase: number;
    base: 'g' | 'ml' | 'altro';
    unitaOriginale: string;
    allergeni: Set<string>;
  }> = {};

  for (const id of piattoIds) {
    if (!id) continue;
    const piatto = piatti.find(p => p.id === id);
    if (!piatto) continue;
    const usaNomePiatto = (piatto.ingredienti?.length ?? 0) === 1;
    // Allergie lette dal campo 'note' (formato CSV prima del "|")
    const allergeniPiatto = allergeniDaNota(piatto.note);
    piatto.ingredienti?.forEach(ing => {
      const nomeDisplay = usaNomePiatto ? piatto.nome : (ing.nome?.trim() || piatto.nome);
      const { valore, base } = normalizzaUnita(ing.quantitaPerPersona, ing.unita);
      const k = chiaveAggregazione(nomeDisplay, ing.unita);
      if (!totali[k]) totali[k] = { valoreBase: 0, base, unitaOriginale: ing.unita, allergeni: new Set() };
      totali[k].valoreBase += valore * nPersone;
      allergeniPiatto.forEach(a => totali[k].allergeni.add(a));
      if (ingredientiDb) {
        ottieniAllergeniIngrediente(ing.nome, ingredientiDb).forEach(a => totali[k].allergeni.add(a));
      }
    });
  }

  return Object.entries(totali)
    .map(([k, v]) => {
      const nome = k.split('__')[0];
      const { quantita, unita } = formattaQuantita(v.valoreBase, v.base, v.unitaOriginale);
      return { nome, quantita, unita, allergeni: v.allergeni };
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
  ingredientiDb?: IngredienteDettaglio[],
): Promise<void> {
  const { default: jsPDF }    = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW    = 210;
  const marginL  = 14;
  const marginR  = 14;
  const contentW = pageW - marginL - marginR; // 182 mm

  let y = 0;

  // ── Utilità locali ─────────────────────────────────────────────────────────

  const addPageIfNeeded = (needed = 30) => {
    if (y + needed > 272) { doc.addPage(); y = 16; }
  };

  const tbl = (opts: any) => {
    autoTable(doc, { ...opts, startY: y, margin: { left: marginL, right: marginR } });
    y = (doc as any).lastAutoTable.finalY;
  };

  const sectionTitle = (text: string) => {
    addPageIfNeeded(18);
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(marginL, y, contentW, 10, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(text, marginL + 4, y + 7);
    doc.setTextColor(...GRAY_700);
    y += 13;
  };

  const subTitle = (text: string) => {
    addPageIfNeeded(12);
    doc.setFillColor(...BRAND_LIGHT);
    doc.rect(marginL, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND_BLUE);
    doc.text(text, marginL + 3, y + 5);
    doc.setTextColor(...GRAY_700);
    y += 10;
  };

  // ── Copertina ──────────────────────────────────────────────────────────────

  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageW, 45, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Menu Campo', pageW / 2, 21, { align: 'center' });
  if (nomeCampo) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(nomeCampo, pageW / 2, 32, { align: 'center' });
  }

  // Info box
  const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(marginL, 52, contentW, 16, 'F');
  doc.setTextColor(...GRAY_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Data: ${oggi}`, marginL + 4, 59);
  doc.text(`Partecipanti: ${nPersone}`, marginL + 4, 65);
  doc.text(`Giorni: ${menu.length}`, marginL + 90, 59);
  doc.text(`Pasti: ${menu.length * PASTO_KEYS.length}`, marginL + 90, 65);

  // Indice
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Contenuto', marginL, 78);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_500);
  const hasPartecipanti = (partecipanti?.length ?? 0) > 0;
  doc.text('A  -  Menu completo per giorno', marginL + 4, 85);
  doc.text('B  -  Quantita ingredienti per singolo pasto', marginL + 4, 91);
  doc.text('C  -  Lista della spesa con allergeni e checkbox', marginL + 4, 97);
  if (hasPartecipanti) doc.text('D  -  Lista partecipanti con allergie dichiarate', marginL + 4, 103);

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE A – Menu per giorno
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle('A  -  Menu completo per giorno');

  for (const giorno of menu) {
    addPageIfNeeded(50);
    subTitle(`Giorno ${giorno.giorno}`);

    const rows: [string, string][] = [];
    for (const pasto of PASTO_KEYS) {
      const slots = normalizeSlots(giorno[pasto], pasto);
      const righe = slots
        .map(s => s.piattoId ? piatti.find(p => p.id === s.piattoId) : null)
        .filter(Boolean) as Piatto[];

      const label = PASTO_PLAIN[pasto];
      if (righe.length === 0) {
        rows.push([label, '-']);
      } else if (righe.length === 1) {
        rows.push([label, righe[0].nome]);
      } else {
        const slotLabels = normalizeSlots(giorno[pasto], pasto);
        rows.push([label, righe.map((p, i) => `${slotLabels[i]?.label}: ${p.nome}`).join('\n')]);
      }
    }

    tbl({
      head: [['Pasto', 'Piatti']],
      body: rows,
      styles: { fontSize: 9.5, cellPadding: 3 },
      headStyles: { fillColor: GRAY_200, textColor: GRAY_700, fontStyle: 'bold', fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', textColor: BRAND_BLUE },
        1: { cellWidth: contentW - 40 },
      },
      theme: 'grid',
    });
    y += 7;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE B – Quantita per pasto
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;
  sectionTitle(`B  -  Quantita ingredienti per singolo pasto  (${nPersone} persone)`);

  for (const giorno of menu) {
    for (const pasto of PASTO_KEYS) {
      const slots    = normalizeSlots(giorno[pasto], pasto);
      const ids      = slots.map(s => s.piattoId ?? '').filter(Boolean);
      if (ids.length === 0) continue;
      const ings     = calcolaIngredienti(ids, piatti, nPersone);
      if (ings.length === 0) continue;

      const nomiPiatti = ids.map(id => piatti.find(p => p.id === id)?.nome).filter(Boolean).join(', ');
      addPageIfNeeded(28);
      subTitle(`Giorno ${giorno.giorno} - ${PASTO_PLAIN[pasto]}`);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY_500);
      doc.text(`Piatti: ${nomiPiatti}`, marginL + 2, y);
      y += 4;

      tbl({
        head: [['Ingrediente', `Qtà (${nPersone} pers.)`, 'U.M.']],
        body: ings.map(i => [i.nome, String(i.quantita), i.unita]),
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: GRAY_200, textColor: GRAY_700, fontStyle: 'bold', fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: contentW - 46 },
          1: { cellWidth: 30, halign: 'right' },
          2: { cellWidth: 16, halign: 'center' },
        },
        theme: 'striped',
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      y += 8;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE C – Lista della spesa con allergeni
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  y = 16;

  // Raccoglie tutti gli id usati nel menu
  const tuttiGliId: string[] = [];
  for (const giorno of menu) {
    for (const pasto of PASTO_KEYS) {
      normalizeSlots(giorno[pasto], pasto).forEach(s => { if (s.piattoId) tuttiGliId.push(s.piattoId); });
    }
  }
  const ingredientiTotali = calcolaIngredienti(tuttiGliId, piatti, nPersone, ingredientiDb);

  // Raccoglie gli allergeni unici usati (max 6 per colonna)
  const allergeniSet = new Set<string>();
  ingredientiTotali.forEach(i => i.allergeni.forEach(a => allergeniSet.add(a)));
  const allergeniList = Array.from(allergeniSet).sort().slice(0, 6);

  // Calcolo larghezze colonne
  // #:8  Ingrediente:?  Qtà:20  U.M.:12  [allergeni]:17 each  Acq.:13
  const allerColW = 17;
  const fixedW    = 8 + 20 + 12 + 13 + (allergeniList.length * allerColW);
  const ingColW   = Math.max(35, contentW - fixedW);

  sectionTitle(`C  -  Lista della spesa  (${nPersone} persone)`);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_500);
  doc.text("Segna 'X' nella colonna 'Acq.' una volta acquistato. Le colonne allergeni mostrano quali intolleranze contiene il prodotto.", marginL, y);
  y += 5;

  if (ingredientiTotali.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...GRAY_500);
    doc.text('Nessun ingrediente. Verifica che i piatti abbiano ingredienti inseriti.', marginL, y + 8);
  } else {
    // Header: usa i nomi completi degli allergeni (la larghezza colonna è sufficiente)
    const head = [['#', 'Ingrediente', `Qtà (${nPersone}p.)`, 'U.M.', ...allergeniList, 'Acq.']];

    tbl({
      head,
      body: ingredientiTotali.map((ing, i) => [
        String(i + 1),
        ing.nome,
        String(ing.quantita),
        ing.unita,
        ...allergeniList.map(a => ing.allergeni.has(a) ? '!' : ''),
        '[ ]',
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'left' },
      headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8,          halign: 'center', textColor: GRAY_500 },
        1: { cellWidth: ingColW },
        2: { cellWidth: 20,         halign: 'right' },
        3: { cellWidth: 12,         halign: 'center' },
        // Colonne allergeni dinamiche
        ...Object.fromEntries(allergeniList.map((_, ci) => [
          4 + ci,
          { cellWidth: allerColW, halign: 'center' as const, fontStyle: 'bold' as const },
        ])),
        // Colonna checkbox
        [4 + allergeniList.length]: { cellWidth: 13, halign: 'center' as const },
      },
      didParseCell: (data: any) => {
        // Header allergeni: font piccolo + testo su riga singola (no wrap)
        if (
          data.section === 'head' &&
          data.column.index >= 4 &&
          data.column.index < 4 + allergeniList.length
        ) {
          data.cell.styles.fontSize = 6.5;
          data.cell.styles.overflow = 'ellipsize';
          data.cell.styles.cellPadding = { top: 3, right: 1, bottom: 3, left: 1 };
        }
        // Corpo: evidenzia in arancione le celle con "!" (allergene presente)
        if (data.section === 'body' && data.cell.raw === '!') {
          data.cell.styles.textColor = [180, 60, 20];
          data.cell.styles.fillColor = [255, 237, 213];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      theme: 'grid',
    });
    y += 6;

    // Legenda allergeni
    if (allergeniList.length > 0) {
      addPageIfNeeded(16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY_500);
      doc.text('Legenda allergeni: ' + allergeniList.join('  |  '), marginL, y);
      y += 5;
    }

    // Costo totale
    const costoTotale = tuttiGliId.reduce((acc, id) => {
      const p = piatti.find(pp => pp.id === id);
      if (!p) return acc;
      return acc + calcolaCostoPiattoPersona(p, ingredientiDb) * nPersone;
    }, 0);

    if (costoTotale > 0) {
      addPageIfNeeded(14);
      doc.setFillColor(...BRAND_LIGHT);
      doc.rect(marginL, y, contentW, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_BLUE);
      doc.text(`Costo totale stimato: EUR ${costoTotale.toFixed(2)}  (EUR ${(costoTotale / nPersone).toFixed(2)} a persona)`, marginL + 4, y + 7.5);
      y += 16;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEZIONE D – Lista partecipanti con allergie
  // ══════════════════════════════════════════════════════════════════════════

  if (hasPartecipanti && partecipanti) {
    doc.addPage();
    y = 16;
    sectionTitle('D  -  Lista partecipanti con allergie dichiarate');

    const ordinati   = [...partecipanti].sort((a, b) => (a.cognome + a.nome).localeCompare(b.cognome + b.nome));
    const conAllergie = ordinati.filter(p => p.allergie && p.allergie.trim());

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY_500);
    doc.text(
      `Totale: ${ordinati.length} partecipanti  |  Con allergie/intolleranze: ${conAllergie.length}`,
      marginL, y
    );
    y += 6;

    // Tabella completa
    tbl({
      head: [['#', 'Cognome', 'Nome', 'Classe / Gruppo', 'Allergie / Intolleranze']],
      body: ordinati.map((p, i) => [String(i + 1), p.cognome, p.nome, p.classe || '-', p.allergie || '-']),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND_BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center', textColor: GRAY_500 },
        1: { cellWidth: 38 },
        2: { cellWidth: 38 },
        3: { cellWidth: 34 },
        4: { cellWidth: contentW - 118 },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '-') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = RED_DARK;
          data.cell.styles.fillColor = [255, 251, 235];
        }
      },
      theme: 'grid',
    });
    y += 12;

    // Riquadro solo con allergie
    if (conAllergie.length > 0) {
      addPageIfNeeded(40);
      doc.setFillColor(254, 243, 199);
      doc.rect(marginL, y, contentW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...RED_DARK);
      doc.text('ATTENZIONE - Partecipanti CON allergie / intolleranze', marginL + 4, y + 5);
      doc.setTextColor(...GRAY_700);
      y += 10;

      tbl({
        head: [['Cognome e Nome', 'Classe / Gruppo', 'Allergia / Intolleranza']],
        body: conAllergie.map(p => [`${p.cognome} ${p.nome}`, p.classe || '-', p.allergie || '']),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: RED_DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
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

  // ── Footer su tutte le pagine ─────────────────────────────────────────────
  const totalPages = (doc as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    (doc as any).setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_500);
    doc.text(`Menu Campo${nomeCampo ? ` - ${nomeCampo}` : ''}`, marginL, 291);
    doc.text(`Pagina ${i} / ${totalPages}`, pageW - marginR, 291, { align: 'right' });
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const fileName = `menu-campo${nomeCampo ? `-${nomeCampo.replace(/\s+/g, '-').toLowerCase()}` : ''}.pdf`;
  doc.save(fileName);
}
