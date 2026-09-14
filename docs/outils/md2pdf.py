#!/usr/bin/env python3
"""Convertit un guide Markdown en PDF (Markdown -> HTML -> WeasyPrint).

Lancé par docs/outils/generer-pdf.sh dans un conteneur jetable ; ne pas
l'exécuter directement sur le serveur (dépendances non installées sur l'hôte).

Usage : md2pdf.py <entree.md> <sortie.pdf> [--rtl]

Conventions Markdown reconnues (en plus du Markdown standard + tableaux) :
  > **[Capture d'écran] ...**   -> encadré « capture d'écran à insérer »
  > **[لقطة شاشة] ...**         -> idem en arabe
  > **Astuce ...** / **نصيحة**   -> encadré vert
  > **Important ...** / **مهم**  -> encadré orange
  [TOC]                         -> table des matières
La première ligne « # Titre » et le paragraphe qui suit forment la couverture.
"""
import re
import sys
from datetime import date
from pathlib import Path

import markdown
from weasyprint import CSS, HTML

src, out = Path(sys.argv[1]), Path(sys.argv[2])
rtl = "--rtl" in sys.argv

text = src.read_text(encoding="utf-8")

# Couverture : premier titre H1 + premier paragraphe (sous-titre).
m = re.match(r"\s*#\s+(.+?)\n+(.+?)\n\n", text, re.S)
title, subtitle = (m.group(1).strip(), m.group(2).strip()) if m else (src.stem, "")
body_md = text[m.end():] if m else text

# Python-Markdown fusionne deux citations « > » séparées par une ligne vide :
# un commentaire HTML entre les deux garde chaque encadré distinct.
body_md = re.sub(r"(^>.*\n)\n(?=>)", r"\1\n<!-- -->\n\n", body_md, flags=re.M)

html_body = markdown.markdown(
    body_md,
    extensions=["tables", "fenced_code", "toc", "attr_list", "sane_lists"],
    extension_configs={"toc": {"toc_depth": "1-2", "title": "Sommaire" if not rtl else "المحتويات"}},
)

# Encadrés : on type les <blockquote> d'après leur premier mot en gras.
KINDS = [
    (r"\[(Capture|لقطة)", "shot"),
    (r"(Astuce|نصيحة|Bon à savoir)", "tip"),
    (r"(Important|Attention|مهم|تنبيه)", "warn"),
]

def classify(match: re.Match) -> str:
    inner = match.group(1)
    for pattern, cls in KINDS:
        if re.match(r"\s*<p><strong>" + pattern, inner):
            return f'<blockquote class="{cls}">{inner}</blockquote>'
    return match.group(0)

html_body = re.sub(r"<blockquote>(.*?)</blockquote>", classify, html_body, flags=re.S)

direction = "rtl" if rtl else "ltr"
lang = "ar" if rtl else "fr"
generated = date.today().strftime("%d/%m/%Y")
page_word = "صفحة" if rtl else "Page"

html = f"""<!doctype html>
<html lang="{lang}" dir="{direction}">
<head><meta charset="utf-8"><title>{title}</title></head>
<body>
<section class="cover">
  <div class="brand">NOLTE KÜCHEN · ERP</div>
  <h1 class="cover-title">{title}</h1>
  <p class="cover-sub">{subtitle}</p>
  <p class="cover-date">{generated}</p>
</section>
<main>{html_body}</main>
</body></html>"""

font = '"Noto Naskh Arabic", "Noto Sans Arabic", "Noto Sans", sans-serif' if rtl else '"Noto Sans", "DejaVu Sans", sans-serif'

css = f"""
@page {{
  size: A4;
  margin: 22mm 18mm 20mm 18mm;
  @top-center {{ content: string(doc-title); font: 8pt {font}; color: #8a8f98; }}
  @bottom-center {{ content: "{page_word} " counter(page) " / " counter(pages); font: 8pt {font}; color: #8a8f98; }}
}}
@page :first {{ @top-center {{ content: none; }} @bottom-center {{ content: none; }} }}
html {{ font-family: {font}; font-size: {'11pt' if rtl else '10pt'}; line-height: {'1.75' if rtl else '1.55'}; color: #1f2328; }}
body {{ margin: 0; }}
.cover {{ page-break-after: always; height: 240mm; display: flex; flex-direction: column; justify-content: center;
          border-{('right' if rtl else 'left')}: 6px solid #e8590c; padding: 0 12mm; }}
.cover .brand {{ letter-spacing: .25em; font-size: 9pt; color: #e8590c; font-weight: 700; }}
.cover-title {{ string-set: doc-title content(); font-size: 28pt; line-height: 1.2; margin: 6mm 0 4mm; color: #111; border: 0; }}
.cover-sub {{ font-size: 12pt; color: #555; max-width: 140mm; }}
.cover-date {{ margin-top: 14mm; color: #8a8f98; font-size: 9pt; }}
h1, h2, h3, h4 {{ color: #111; line-height: 1.3; page-break-after: avoid; }}
main h1 {{ page-break-before: always; font-size: 20pt; border-bottom: 3px solid #e8590c; padding-bottom: 2mm; margin-top: 0; }}
main h2 {{ font-size: 14.5pt; margin-top: 9mm; color: #c2410c; }}
main h3 {{ font-size: 12pt; margin-top: 6mm; }}
main h4 {{ font-size: 10.5pt; margin-top: 4mm; color: #444; }}
p, li {{ orphans: 3; widows: 3; }}
ul, ol {{ padding-{('right' if rtl else 'left')}: 6mm; }}
li {{ margin: 1mm 0; }}
a {{ color: #c2410c; text-decoration: none; }}
code {{ font-family: "DejaVu Sans Mono", monospace; font-size: .86em; background: #f3f4f6; padding: .5mm 1.2mm;
        border-radius: 1mm; unicode-bidi: isolate; direction: ltr; }}
pre {{ background: #0f172a; color: #e2e8f0; padding: 3.5mm 4mm; border-radius: 2mm; font-size: 8.2pt; line-height: 1.45;
       white-space: pre-wrap; word-break: break-word; direction: ltr; text-align: left; page-break-inside: avoid; }}
pre code {{ background: none; color: inherit; padding: 0; font-size: 1em; }}
table {{ border-collapse: collapse; width: 100%; margin: 3mm 0 5mm; font-size: .9em; page-break-inside: auto; }}
th, td {{ border: 1px solid #d0d7de; padding: 1.6mm 2.2mm; vertical-align: top; text-align: {('right' if rtl else 'left')}; }}
th {{ background: #fff4e6; color: #7c2d12; }}
tr {{ page-break-inside: avoid; }}
blockquote {{ margin: 4mm 0; padding: 3mm 4mm; border-radius: 2mm; page-break-inside: avoid; }}
blockquote p {{ margin: 1mm 0; }}
blockquote.shot {{ border: 1.5px dashed #94a3b8; background: #f8fafc; color: #475569; text-align: center; padding: 8mm 6mm; }}
blockquote.tip {{ background: #ecfdf5; border-{('right' if rtl else 'left')}: 4px solid #10b981; }}
blockquote.warn {{ background: #fff7ed; border-{('right' if rtl else 'left')}: 4px solid #f59e0b; }}
blockquote:not(.shot):not(.tip):not(.warn) {{ background: #f6f8fa; border-{('right' if rtl else 'left')}: 4px solid #d0d7de; }}
.toc {{ page-break-after: always; }}
.toc .toctitle {{ font-size: 20pt; font-weight: 700; display: block; border-bottom: 3px solid #e8590c; margin-bottom: 4mm; }}
.toc ul {{ list-style: none; padding-{('right' if rtl else 'left')}: 5mm; }}
.toc > ul {{ padding: 0; }}
.toc > ul > li > a {{ font-weight: 700; }}
.toc a {{ color: #1f2328; }}
.toc a::after {{ content: leader('.') target-counter(attr(href), page); color: #8a8f98; }}
hr {{ border: 0; border-top: 1px solid #d0d7de; margin: 6mm 0; }}
"""

if rtl:
    # Libellés français au milieu d'une phrase arabe : une police sans-serif
    # se lit mieux qu'une chasse fixe, et un encadré aligné à droite évite
    # que l'algorithme bidi ne mélange les segments quand le texte est centré.
    css += """
code { font-family: "Noto Sans", "DejaVu Sans", sans-serif; font-size: .9em; background: #f1f3f5; }
blockquote.shot { text-align: right; }
"""

HTML(string=html, base_url=str(src.parent)).write_pdf(out, stylesheets=[CSS(string=css)])
print(f"[md2pdf] {src.name} -> {out.name}")
