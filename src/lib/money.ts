/**
 * Calculs monétaires partagés (lignes de devis, commandes, ventes, factures).
 *
 * Auparavant chaque écran redéfinissait `computeLine` sans arrondi.
 *
 * Ici tout est arrondi au centime, et les totaux sont la somme des lignes
 * telles qu'elles seront réellement enregistrées.
 */

/** Arrondi au centime, aligné sur numeric(12,2) côté base. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type MoneyLine = {
  quantity: number;
  unit_price: number;
  discount_rate: number;
};

export function computeLine(l: MoneyLine) {
  const ttc = round2(l.quantity * l.unit_price * (1 - l.discount_rate / 100));
  return { ttc };
}

/** Totaux document = somme des lignes arrondies (pas l'inverse). */
export function computeTotals(lines: MoneyLine[]) {
  let ttc = 0;
  for (const l of lines) {
    const c = computeLine(l);
    ttc += c.ttc;
  }
  return { ttc: round2(ttc) };
}
