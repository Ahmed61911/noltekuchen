# Image jetable qui transforme les guides Markdown en PDF.
# Construite et utilisée uniquement par docs/outils/generer-pdf.sh.
FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b \
      fonts-noto-core fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir weasyprint==63.1 pydyf==0.11.0 markdown==3.7 pypdfium2==4.30.0
WORKDIR /docs
