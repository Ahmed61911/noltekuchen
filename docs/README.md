# Documentation — ERP Nolte Küchen

| Document | Public | Markdown | PDF |
|---|---|---|---|
| Guide utilisateur (français) | Tous les utilisateurs, par rôle | [guide-utilisateur-fr.md](guide-utilisateur/guide-utilisateur-fr.md) | [PDF](guide-utilisateur/guide-utilisateur-fr.pdf) |
| دليل المستخدم (العربية) | جميع المستخدمين حسب الدور | [guide-utilisateur-ar.md](guide-utilisateur/guide-utilisateur-ar.md) | [PDF](guide-utilisateur/guide-utilisateur-ar.pdf) |
| Guide développeur et passation (français) | Développeurs, administrateurs système | [guide-developpeur-fr.md](guide-developpeur/guide-developpeur-fr.md) | [PDF](guide-developpeur/guide-developpeur-fr.pdf) |

## Mettre à jour

1. Modifiez le fichier `.md`.
2. Régénérez les PDF : `docs/outils/generer-pdf.sh` (Docker requis, rien à installer).
3. Commitez les `.md` **et** les `.pdf`.

Les emplacements « [Capture d'écran] » / « [لقطة شاشة] » sont à remplacer par de vraies captures : placez l'image dans le dossier du guide (ex. `guide-utilisateur/images/commandes.png`) et remplacez l'encadré par `![Commandes](images/commandes.png)`.
