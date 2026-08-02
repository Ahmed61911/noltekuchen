/**
 * Logo Nolte Küchen pour jsPDF.
 *
 * jsPDF ne sait pas embarquer un SVG : `addImage()` veut du PNG/JPEG. Deux
 * options se présentaient, embarquer un PNG en base64 ou redessiner la marque
 * avec les primitives de jsPDF. C'est la seconde qui est retenue :
 *
 *   • le logo (`src/assets/nolte-logo.svg`) est purement typographique — le
 *     mot « nolte », une barre jaune pleine largeur, le mot « küchen » calé à
 *     droite sous la barre, et le ® en exposant ;
 *   • un tracé vectoriel reste net à n'importe quelle échelle et à
 *     l'impression, là où un PNG embarqué se pixelliserait et alourdirait le
 *     bundle de plusieurs dizaines de kilo-octets pour chaque écran qui
 *     importe le générateur ;
 *   • aucun asset binaire à régénérer, et surtout aucun téléchargement : le
 *     PDF se fabrique hors ligne, dans le navigateur.
 *
 * Les proportions viennent directement du viewBox du SVG (251 × 115), et les
 * deux mots sont dimensionnés *par leur largeur* (`getTextWidth`) plutôt que
 * par une hauteur de police supposée : c'est la seule mesure que jsPDF nous
 * donne de façon fiable, et elle suffit à respecter le gabarit d'origine.
 *
 * Attention : la fonction laisse la police, la taille et les couleurs de
 * `doc` modifiées. Repositionnez-les avant le prochain tracé.
 */

import type jsPDF from "jspdf";

/** hauteur / largeur du viewBox d'origine (251 × 115). */
export const NOLTE_LOGO_RATIO = 115 / 251;

/** Noir de marque du SVG (#1A171B). */
const BLACK: [number, number, number] = [26, 23, 27];
/** Jaune de marque du SVG (#FFED00). */
const YELLOW: [number, number, number] = [255, 237, 0];

// Repères relevés dans le viewBox, exprimés en fraction de la largeur (x, w)
// ou de la hauteur (y, h) du logo.
const MARK_X = 4.13 / 251;
const MARK_W = (232 - 4.13) / 251;
const MARK_BASELINE = 68 / 115;
const REG_RIGHT = 246.9 / 251;
const REG_BASELINE = 19 / 115;
const BAR_X = 4.13 / 251;
const BAR_W = (246.86 - 4.13) / 251;
const BAR_Y = 73.74 / 115;
const BAR_H = (84.71 - 73.74) / 115;
const SUB_RIGHT = 250.5 / 251;
const SUB_W = (250.5 - 139.5) / 251;
const SUB_BASELINE = 110.5 / 115;
/** « küchen » fait 19,6 unités de haut contre 63,6 pour « nolte ». */
const SUB_SIZE_RATIO = 19.6 / 63.6;

const MARK_WORD = "nolte";
const SUB_WORD = "küchen";

/**
 * Dessine le logo dans un rectangle dont on ne fixe que la largeur ; la
 * hauteur en découle (`width * NOLTE_LOGO_RATIO`).
 *
 * @param x bord gauche, dans l'unité du document (mm ici)
 * @param y bord supérieur
 * @param width largeur totale du logo
 */
export function drawNolteLogo(doc: jsPDF, x: number, y: number, width: number): number {
  const height = width * NOLTE_LOGO_RATIO;

  // « nolte » : on cherche la taille de police dont la largeur rendue égale
  // celle du mot dans le SVG. La hauteur d'x qui en résulte tombe à 3 % près
  // sur celle du logo d'origine, les proportions du Helvetica gras étant
  // proches de celles de la marque.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const widthPerPoint = doc.getTextWidth(MARK_WORD) / 10;
  const markSize = widthPerPoint > 0 ? (width * MARK_W) / widthPerPoint : 10;
  doc.setFontSize(markSize);
  doc.setTextColor(...BLACK);
  doc.text(MARK_WORD, x + width * MARK_X, y + height * MARK_BASELINE);

  // ® en exposant, calé à droite comme dans le SVG.
  doc.setFontSize(markSize * 0.17);
  doc.text("®", x + width * REG_RIGHT, y + height * REG_BASELINE, { align: "right" });

  // Barre jaune pleine largeur.
  doc.setFillColor(...YELLOW);
  doc.rect(x + width * BAR_X, y + height * BAR_Y, width * BAR_W, height * BAR_H, "F");

  // « küchen » : chasse élargie pour occuper exactement la largeur du SVG.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(markSize * SUB_SIZE_RATIO);
  doc.setTextColor(...BLACK);
  const letters = [...SUB_WORD];
  const natural = doc.getTextWidth(SUB_WORD);
  const gaps = Math.max(1, letters.length - 1);
  const tracking = Math.max(0, (width * SUB_W - natural) / gaps);
  let cursor = x + width * SUB_RIGHT - (natural + tracking * gaps);
  const baseline = y + height * SUB_BASELINE;
  for (const letter of letters) {
    doc.text(letter, cursor, baseline);
    cursor += doc.getTextWidth(letter) + tracking;
  }

  return height;
}
