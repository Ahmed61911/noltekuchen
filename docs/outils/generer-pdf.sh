#!/usr/bin/env bash
# Régénère les PDF de tous les guides à partir de leurs fichiers .md.
# À relancer après chaque modification d'un guide.
#
# Usage : docs/outils/generer-pdf.sh
# Prérequis : Docker (rien à installer sur la machine elle-même).
set -euo pipefail
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE=nolte-docs-pdf

docker build -q -t "$IMAGE" "$DOCS/outils" >/dev/null

run() {
  docker run --rm --network none --memory 768m \
    --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$DOCS:/docs" "$IMAGE" python3 /docs/outils/md2pdf.py "$@"
}

run guide-utilisateur/guide-utilisateur-fr.md guide-utilisateur/guide-utilisateur-fr.pdf
run guide-utilisateur/guide-utilisateur-ar.md guide-utilisateur/guide-utilisateur-ar.pdf --rtl
run guide-developpeur/guide-developpeur-fr.md guide-developpeur/guide-developpeur-fr.pdf

echo "[generer-pdf] terminé"
