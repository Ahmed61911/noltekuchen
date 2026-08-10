import type jsPDF from "jspdf";
import { pdfText } from "@/lib/pdf-safe";

const INK: [number, number, number] = [18, 27, 41];
const MUTED: [number, number, number] = [98, 106, 117];

/**
 * Dessine l'en-tête de marque "NADO CUISINE SARL".
 */
export function drawNadoCuisineHeader(doc: jsPDF, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text("NADO CUISINE ", x, y + 6);

  const mainW = doc.getTextWidth("NADO CUISINE ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(...MUTED);
  doc.text("SARL", x + mainW, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text("Vente, installation et équipement des cuisines", x, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(pdfText("Importation et exportation"), x, y + 16.5);

  return 18;
}

export const NADO_LEGAL_LINES = [
  "NADO CUISINE — Société à responsabilité limitée au capital de 100.000 DHS",
  "Siège social : Boulevard Al Massira - Al Matar - Nador",
  "IF : 40422840   —   PATENTE : 56126506   —   RC : 10603   —   ICE : 59796000073",
];
