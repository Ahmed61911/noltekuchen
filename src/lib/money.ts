/**
 * Calculs monétaires partagés (lignes de devis, commandes, ventes, factures).
 *
 * Auparavant chaque écran redéfinissait `computeLine` sans arrondi : les
 * lignes étaient arrondies à 2 décimales au stockage (numeric(12,2)) alors que
 * le total de l'en-tête était la somme des valeurs non arrondies. La somme des
 * lignes ne correspondait donc pas toujours au total du document, à quelques
 * centimes près.
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
  tax_rate: number;
};

export function computeLine(l: MoneyLine) {
  const ht = round2(l.quantity * l.unit_price * (1 - l.discount_rate / 100));
  const tva = round2(ht * (l.tax_rate / 100));
  return { ht, tva, ttc: round2(ht + tva) };
}

/** Totaux document = somme des lignes arrondies (pas l'inverse). */
export function computeTotals(lines: MoneyLine[]) {
  let ht = 0;
  let tva = 0;
  let ttc = 0;
  for (const l of lines) {
    const c = computeLine(l);
    ht += c.ht;
    tva += c.tva;
    ttc += c.ttc;
  }
  return { ht: round2(ht), tva: round2(tva), ttc: round2(ttc) };
}
