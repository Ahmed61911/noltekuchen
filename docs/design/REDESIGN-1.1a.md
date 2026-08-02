# Refonte visuelle 1.1a — Spécification

Branche `v1.1a-redesign`. Production sur `v1.0`.

**Périmètre : visuel uniquement.** Aucune règle métier, aucun calcul, aucune
permission, aucun libellé de navigation ne change. Tout ce qui s'en approche est
listé en fin de document, section « Hors périmètre ».

**Identité préservée.** Orange `oklch(0.72 0.19 50)`, navy `oklch(0.27 0.05 245)`,
crème `oklch(0.97 0.005 80)`, teal, bleu roi, rouge, Space Grotesk + DM Sans,
rayon `0.625rem`. Aucune couleur de marque ni police nouvelle n'est proposée.

La fondation v1.1a déjà présente dans `src/styles.css` (élévations `--elev-1..4`,
tokens de mouvement, `.elev-*`, `.lift`, `.enter`, `.surface`, `.skeleton`,
anneau de focus unique, coupure sous `prefers-reduced-motion`) est le socle. Ce
document décrit comment l'appliquer, pas comment la refaire.

---

## 0. Ce que la refonte corrige

Sept constats vérifiés dans le code actuel. Ils motivent chaque décision qui suit.

| # | Constat | Où | Effet pour l'utilisateur |
|---|---|---|---|
| 1 | L'en-tête de tableau ne colle pas au défilement | tous les écrans de liste | à la 15ᵉ ligne, on ne sait plus quelle colonne on lit |
| 2 | Deux conteneurs différents pour le même tableau | `_app.products.index.tsx` (`Card` + `Table`) vs `_app.orders.index.tsx` (`Card p-4` + `div.rounded-md.border` + `Table`) | double bordure, table décalée de 16 px, densité incohérente d'un écran à l'autre |
| 3 | Trois systèmes de couleurs de statut | `bg-amber-500/15 text-amber-700` (orders/invoices), `variant="destructive"` (products), `bg-warning/10 text-warning` (products/$id) | en thème sombre, `PAY` dans `_app.orders.index.tsx` n'a pas de variante `dark:` — « Payée » s'affiche en vert 700 sur fond sombre, contraste insuffisant |
| 4 | `--warning` **est** `--primary` (même `oklch(0.72 0.19 50)`) | `src/styles.css` | sur le graphique principal du tableau de bord, les aires « entrées » et « sorties » sont tracées dans **la même couleur** (`_app.dashboard.tsx` l.241-242) |
| 5 | Aucun écran de liste n'a d'état d'erreur ; `_app.orders.index.tsx` n'a même pas d'état de chargement (`const { data: orders = [] }`, sans `isLoading`) | orders, invoices, products, stock… | pendant le premier chargement, et pour toujours en cas d'erreur réseau, l'écran affiche « Aucune commande » |
| 6 | Alignement numérique perdu en arabe | `[dir="rtl"] .text-right { text-align: left }` (spécificité 0,2,0) l'emporte sur `[dir="rtl"] table td { text-align: right }` (0,1,2) | en RTL, colonnes chiffrées et colonnes texte finissent toutes alignées au même bord : la lecture des montants s'effondre |
| 7 | `focus-visible:outline-none` dans `buttonVariants` annule l'anneau de focus de la fondation | `src/components/ui/button.tsx` l.8 | l'anneau unique introduit en 1.1a ne s'applique à aucun bouton |

Aucun de ces sept points ne demande de toucher au métier.

---

## 1. Fondations transverses

### 1.1 Échelle typographique

Une seule échelle, six rôles. Space Grotesk (`font-display`) est réservé aux
titres et aux **valeurs chiffrées mises en avant** ; tout le reste est DM Sans.

| Rôle | Classe | Taille / interligne | Graisse | Usage |
|---|---|---|---|---|
| `title-page` | `font-display text-xl leading-7 font-semibold tracking-tight` | 20 / 28 | 600 | `h1` de chaque écran (liste **et** détail) |
| `title-section` | `font-display text-[0.9375rem] leading-5 font-semibold` | 15 / 20 | 600 | `CardTitle`, titres de blocs |
| `body` | `text-sm leading-5` | 14 / 20 | 400 | texte courant, cellules de tableau |
| `body-strong` | `text-sm leading-5 font-medium` | 14 / 20 | 500 | colonne identifiante d'une ligne (nom, n°) |
| `meta` | `text-xs leading-4 text-muted-foreground` | 12 / 16 | 400 | sous-titres, dates secondaires, compteurs |
| `micro-label` | `text-[0.6875rem] leading-4 font-medium uppercase tracking-[0.06em] text-muted-foreground` | 11 / 16 | 500 | étiquettes de cartes statistiques |
| `numeric` | `text-sm tabular-nums` | 14 / 20 | 400 | **toute** cellule chiffrée, sans exception |

Changement notable : `h1` passe de `text-2xl` (produits, commandes, stock…) et
`text-3xl` (`products/$id`) à **`text-xl` partout**. Gain : environ 10 px de
hauteur utile sur chaque écran, et un titre qui ne concurrence plus la donnée.
C'est un outil interne : le titre sert à confirmer où l'on est, pas à impressionner.

**Caveat RTL — à corriger dans `styles.css` :** Space Grotesk et DM Sans n'ont
aucune couverture arabe. Aujourd'hui `[dir="rtl"] body` bascule le corps de texte
sur `--font-sans`, mais la règle `h1..h5 { font-family: var(--font-display);
letter-spacing: -0.02em }` reste active en arabe : les titres tombent sur une
police système arbitraire **avec un crénage négatif**, ce qui casse les ligatures
de l'arabe. Ajouter :

```css
[dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3,
[dir="rtl"] h4, [dir="rtl"] h5 {
  font-family: var(--font-sans);
  letter-spacing: normal;
}
/* L'arabe n'a pas de capitales : les micro-étiquettes doivent perdre
   uppercase et tracking, sinon les lettres se disjoignent. */
[dir="rtl"] .micro-label,
[dir="rtl"] .uppercase { text-transform: none; letter-spacing: normal; }
```

### 1.2 Rythme d'espacement

Échelle unique : **4 / 8 / 12 / 16 / 24 / 32**. Rien entre.

| Zone | Valeur | Aujourd'hui |
|---|---|---|
| Padding de `<main>` | `p-4 md:p-5 lg:p-6` (16 / 20 / 24) | `p-4 md:p-6 lg:p-8` |
| Écart entre sections d'une page | `space-y-4` (16) sur les listes, `space-y-6` (24) sur détail et tableau de bord | `space-y-6` partout |
| Padding intérieur de carte « contenu » | `p-4` | `p-4` à `p-6` selon l'écran |
| Padding intérieur de carte statistique | `px-4 py-3` | `p-4` / `p-5` |
| Cellule de tableau | `px-3 py-0` + hauteur de ligne fixe | `p-2` |
| Écart entre contrôles d'une barre de filtres | `gap-2` (8) | `gap-2` |

**Budget vertical sur 1366 × 768** (le portable type de l'équipe), écran de liste :

```
768  hauteur fenêtre
-56  en-tête applicatif (h-14)
-40  padding vertical de <main> (2 × 20)
-44  en-tête de page (titre + action, sur une ligne)
-16  gouttière
-76  bandeau de cartes statistiques
-16  gouttière
-52  barre de filtres
-16  gouttière
-40  en-tête de tableau (collant)
= 412 px de corps de tableau visible → 8 lignes à 48 px + amorce de la 9ᵉ
```

En 1.0, avec `lg:p-8`, `space-y-6` et des cartes statistiques à 90 px, le même
écran affiche **6 lignes**. Le gain est de deux lignes et demie par écran, tous
les jours, sans rien retirer.

### 1.3 Élévation — quoi porte quelle ombre

| Niveau | Ce qui le porte |
|---|---|
| plat (bordure seule) | lignes de tableau, séparateurs, champs de saisie |
| `--elev-1` | cartes de contenu, coquille de tableau, barre de filtres |
| `--elev-2` | cartes statistiques, carte survolée, en-tête applicatif au défilement |
| `--elev-3` | popover, dropdown, tooltip, en-tête de tableau collant (ombre portée vers le bas uniquement) |
| `--elev-4` | dialog, alert-dialog, sheet |
| `--elev-brand` | **un seul élément par écran** : le bouton d'action principal |

Règle : `shadow-card`, `shadow-soft`, `shadow-elegant` et `shadow-glow` (v1.0)
sont remplacés par cette échelle. `shadow-elegant` sur le bouton principal
devient `elev-brand`. Ne pas empiler deux niveaux sur des éléments imbriqués :
une carte `elev-1` contenant une carte `elev-1` doit voir la fille passer à plat.

### 1.4 Mouvement — inventaire complet

| Élément | Propriétés | Durée | Courbe |
|---|---|---|---|
| Survol de ligne de tableau | `background-color` | `--dur-instant` (100 ms) | `--ease-out` |
| Survol de carte cliquable | `box-shadow` + `translateY(-1px)` | `--dur-fast` (160 ms) | `--ease-out` |
| Survol de bouton | `background-color` | `--dur-instant` | linéaire |
| Entrée de page | `.enter` sur le conteneur racine, décalage 40 ms | `--dur-slow` (380 ms) | `--ease-out` |
| Overlay de dialog | `opacity` | `--dur-fast` | `--ease-out` |
| Contenu de dialog | `opacity` + `scale(0.98→1)` + `translateY(4px→0)` | `--dur-base` (240 ms) | `--ease-out` |
| Fermeture de dialog | inverse | `--dur-fast` | `--ease-in-out` |
| Sheet / drawer | `translate` sur l'axe inline | `--dur-base` | `--ease-out` |
| Repli de la barre latérale | `width` | `--dur-base` | `--ease-out` (aujourd'hui `duration-200 ease-linear`) |
| Bascule d'onglet | `opacity` du panneau | `--dur-fast` | `--ease-out` |
| Squelette | `.skeleton` | 1,6 s en boucle | linéaire |

Interdits explicites :
- **`.lift` ne s'applique jamais à une ligne de tableau.** Une ligne qui se
  soulève au survol dans un tableau de 200 lignes donne le mal de mer. `.lift`
  est réservé aux cartes.
- Pas de `--ease-spring` sur autre chose qu'un badge de compteur qui s'incrémente.
  Le rebond n'a pas sa place dans un outil de saisie.
- **Une seule** `.enter` par route, sur le conteneur de plus haut niveau. Deux
  `.enter` imbriqués font animer les petits-enfants deux fois.
- Le tableau de bord doit cesser d'utiliser `framer-motion` (seul écran à
  l'importer, `_app.dashboard.tsx` l.4) au profit de `.enter` : deux systèmes
  d'animation sur un même écran, c'est un écart de rythme visible.

### 1.5 Statuts — une seule table de correspondance

Composant `<StatusBadge tone label />`, construit sur `Badge variant="outline"`.
Jamais de badge plein pour un statut : le plein est réservé au bouton principal.

| `tone` | Fond | Texte | Bordure |
|---|---|---|---|
| `neutral` | `bg-muted` | `text-muted-foreground` | `border-border` |
| `info` | `bg-info/10` | `text-info` | `border-info/25` |
| `success` | `bg-success/10` | `text-success` | `border-success/25` |
| `warning` | `bg-warning/12` | `text-warning` | `border-warning/30` |
| `danger` | `bg-destructive/10` | `text-destructive` | `border-destructive/25` |

Tous ces couples sont dérivés des tokens, donc suivent automatiquement le thème
sombre — ce que `text-amber-700` ne fait pas.

Attention : `--warning` étant identique à `--primary`, un badge `warning` et le
bouton principal partagent la teinte. C'est précisément pourquoi le badge reste
en fond teinté à 12 % avec bordure : à aucun moment il ne peut être confondu
avec un bouton orange plein.

Correspondance à appliquer **sans changer aucun libellé** :

| Domaine | Valeur | `tone` | Libellé (inchangé) |
|---|---|---|---|
| Commande | `pending` | `warning` | En attente |
| Commande | `validated` | `info` | Validée |
| Commande | `delivered` | `success` | Livrée |
| Commande | `cancelled` | `danger` | Annulée |
| Paiement | `unpaid` | `danger` | Impayée |
| Paiement | `partial` | `warning` | Partielle |
| Paiement | `paid` | `success` | Payée |
| Facture | `draft` | `neutral` | Brouillon |
| Facture | `pending` | `warning` | En attente |
| Facture | `paid` | `success` | Payée |
| Facture | `cancelled` | `danger` | Annulée |
| Stock produit | rupture | `danger` | Rupture de stock |
| Stock produit | sous seuil | `warning` | Stock faible |
| Stock produit | normal | `success` | En stock |
| Délai commande | retard | `danger` | `{n}j retard` |
| Délai commande | ≤ 3 j | `warning` | `{n}j` |
| Délai commande | > 3 j | `neutral` | `{n}j` |

### 1.6 Anneau de focus — conflit à résoudre

La fondation pose `:where(a, button, …):focus-visible { outline: 2px solid
var(--color-ring); outline-offset: 2px }`. `:where()` a une spécificité nulle,
donc toute classe utilitaire l'emporte. Trois primitives l'annulent :

- `src/components/ui/button.tsx` l.8 : `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`
- `src/components/ui/badge.tsx` l.7 : `focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`
- `src/components/ui/input.tsx` : à vérifier, même motif

**Correction :** retirer `focus-visible:outline-none` et le `ring-*` associé de
ces trois fichiers, et laisser la règle globale s'appliquer. C'est le seul
endroit du chantier où l'on touche à `src/components/ui/`, et c'est justifié :
sans cela, la fondation d'accessibilité de la 1.1a est morte-née.

---

## 2. Archétype A — la coquille

**Qui, quoi, à quelle fréquence.** Tout le monde, toute la journée. La coquille
n'est jamais l'objet du travail : elle doit disparaître visuellement et ne
répondre qu'à deux questions — où suis-je, comment vais-je ailleurs.

### 2.1 Barre latérale

Fichier : `src/components/app-sidebar.tsx`. Trois groupes (Principal, Opérations,
Administration) plus Paramètres en pied. Aucun libellé, aucun ordre, aucun
filtrage par permission ne change.

```
┌──────────────────────┐          ┌────┐
│ [logo]               │          │[L] │   replié (3rem)
│ ERP INTERNE          │          ├────┤
├──────────────────────┤          │ ▣  │   ← tooltip au survol
│ PRINCIPAL            │          │ ▣  │
│▌▣ Tableau de bord    │  actif   │ ▣  │
│ ▣ Produits           │          │ ·  │   ← séparateur de groupe
│ ▣ Mouvements de st…  │          │ ▣  │
│ ▣ Commandes          │          │ ▣  │
│ ▣ Ventes             │          └────┘
│ ▣ Facturation        │
│ ▣ Rendez-vous        │
│                      │
│ OPÉRATIONS           │
│ ▣ Projets            │
│ …                    │
├──────────────────────┤
│ ▣ Paramètres         │
└──────────────────────┘
   ▌ = filet orange 3 px, côté « start »
```

Décisions :

1. **État actif enfin distinguable.** Aujourd'hui actif et survol utilisent le
   même `bg-sidebar-accent` : impossible de dire où l'on est. L'actif reçoit en
   plus un filet de 3 px `--color-primary` côté *start* — l'utilitaire
   `.rule-start` existe déjà dans la fondation et utilise `border-inline-start`,
   donc il bascule seul en arabe — et passe en `font-medium`. Le survol garde le
   fond teinté seul.
2. **Hauteur des entrées : `h-9` (36 px)** au lieu de `h-8`. Onze entrées à 36 px
   = 396 px, tiennent sans défilement sur 768 px une fois les trois libellés de
   groupe comptés. Cible de pointage plus confortable sans perdre de place utile.
3. **Tooltips en mode replié.** `SidebarMenuButton` accepte déjà une prop
   `tooltip` qui n'est jamais passée. En replié, la barre est une colonne de onze
   icônes sans texte : inutilisable pour qui ne les connaît pas par cœur. Passer
   `tooltip={it.label}` — le libellé est celui qui existe déjà, rien de nouveau.
4. **Supprimer les `{!collapsed && …}`.** La primitive masque déjà libellés et
   titres de groupe via `group-data-[collapsible=icon]:opacity-0` avec une
   transition. Le démontage manuel en React fait disparaître le texte d'un coup
   au lieu de le fondre, et duplique la logique.
5. **Séparation des groupes en mode replié.** Les libellés de groupe disparaissent :
   insérer un `<Separator />` de 1 px entre groupes, visible uniquement en replié.
6. **Zone active dans le pied.** Paramètres suit exactement la même règle d'actif.

RTL : `side={lang === "ar" ? "right" : "left"}` est déjà géré, et la règle
`[dir="rtl"] [data-slot="sidebar-container"].border-r` bascule la bordure. Le
filet actif en `border-inline-start` suit. Le logo et les icônes ne se
retournent pas (`.rtl-flip` non appliqué) : correct, ce ne sont pas des flèches.

### 2.2 En-tête applicatif

Fichier : `src/components/app-header.tsx`. Hauteur `h-14` conservée.

```
┌────────────────────────────────────────────────────────────────────────┐
│ ☰ │ Produits › Hotte Bosch 90 cm        [FR] [◐] [🔔3] [A ahmed…]      │
└────────────────────────────────────────────────────────────────────────┘
  start ─────────────────────────────────────────────────────────► end
```

1. **Le fil d'Ariane remplace la mention statique.** Aujourd'hui l'espace de
   départ affiche « Nolte Küchen · ERP Interne » — information déjà portée par le
   logo de la barre latérale, à deux centimètres. Quand la barre est repliée en
   rail d'icônes, l'utilisateur n'a plus aucun repère textuel. Le fil d'Ariane
   utilise la primitive `breadcrumb` (présente, jamais employée) et **réutilise
   les libellés de navigation existants** : aucun libellé nouveau.
   *Coût :* il faut une correspondance route → libellé. Extraire les tableaux
   `main`/`ops` de `app-sidebar.tsx` vers `src/lib/nav.ts` et les consommer des
   deux côtés. C'est du déplacement de code, pas du comportement.
   *Si ce coût est refusé :* se contenter de retirer la mention statique et
   laisser l'espace vide. Le gain d'orientation est perdu, mais le bruit aussi.
2. **Bouton de langue cassé à réparer.** Il combine `size="icon"` (boîte fixe
   `h-9 w-9`) avec une icône **et** le texte « FR »/« AR » : le contenu déborde.
   Passer `variant="ghost" size="sm"` avec `px-2` et `gap-1.5`.
3. **Adresse e-mail tronquée.** `<span className="hidden text-sm md:inline">{user?.email}</span>`
   affiche l'adresse entière — jusqu'à 30 caractères mangés à l'en-tête. Afficher
   la partie locale seule, `max-w-[10rem] truncate`, l'adresse complète restant
   dans `DropdownMenuLabel` où elle est déjà.
4. **Ombre au défilement.** L'en-tête est `sticky` avec `bg-background/80
   backdrop-blur-md` mais sans ombre : rien ne dit qu'il flotte au-dessus du
   contenu. Ajouter `--elev-2` uniquement lorsque `window.scrollY > 0`
   (ou `scroll-timeline` si dispo), transition `--dur-fast`.
5. **Lien d'évitement.** Premier élément focalisable du document :
   « Aller au contenu » (`sr-only focus:not-sr-only`), cible `#main-content`.
   Aujourd'hui, un utilisateur clavier traverse onze liens de navigation à chaque
   changement de page.
6. **Popover de notifications.** Conserver la structure. Deux retouches : le
   `text-left` de la ligne (l.130) devient `text-start` ; les icônes
   `text-amber-500` / `text-emerald-500` passent aux tokens `text-warning` /
   `text-success`.

Ordre de focus de la coquille : lien d'évitement → bascule de barre latérale →
fil d'Ariane (non focalisable si un seul niveau) → langue → thème →
notifications → compte → `#main-content` → contenu de la page. Rappeler dans
l'infobulle de la bascule que le raccourci `Ctrl/⌘ + B` existe déjà.

### 2.3 Cadre de page

`src/routes/_app.tsx` : `<main id="main-content" tabIndex={-1} className="flex-1
p-4 md:p-5 lg:p-6">`. Le `bg-gradient-mesh` du conteneur est conservé — c'est un
dégradé crème très faible qui fait partie de l'identité.

---

## 3. Archétype B — écran de liste

**Qui, quoi, à quelle fréquence.** Vendeurs, magasiniers, administration.
Ils cherchent une ligne précise, ou balayent un ensemble filtré pour repérer
une anomalie (retard, rupture, impayé). Dizaines de fois par jour. **C'est
l'écran où le gain doit être le plus fort.**

Concerne : produits, mouvements de stock, commandes, ventes, facturation,
clients, fournisseurs, dépôts, projets, documents, utilisateurs, journaux, audit.

### 3.1 Composition

```
┌────────────────────────────────────────────────────────────────────────┐
│ Commandes clients                        [+ Nouvelle commande]         │  44
│ Cycle de vie, délais et livraison                                      │
├────────────────────────────────────────────────────────────────────────┤  16
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│ │ 12     │ │ 8      │ │ 43     │ │ 2      │ │ 5      │                │  76
│ │ EN ATT.│ │VALIDÉES│ │ LIVRÉES│ │ANNULÉES│ │RETARD  │                │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                │
├────────────────────────────────────────────────────────────────────────┤  16
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ [🔍 Rechercher…] [Statut ▾][Paiement ▾][Client ▾][Du][Au] ⟲   43/128│ │  52
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤  16
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ N°     Client        Date      Total    Statut   Paiement  ⋮actions│ │  40  ← collant
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ CMD-0042  Benali    12/03/26  4 200,00  [Livrée] [Payée]   👁 🗑   │ │  48
│ │ CMD-0041  Tazi      11/03/26  1 850,00  [En att][Impayée]  👁 ✓ 🚚 │ │  48
│ │ …                                                                  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

Quatre régions, dans cet ordre, toujours. Sur portable, seule la barre de
filtres se replie (voir 3.4).

### 3.2 En-tête de page — `<PageHeader>`

```tsx
<PageHeader
  title="Commandes clients"
  subtitle="Cycle de vie, délais et livraison"
  actions={<Button className="elev-brand">…</Button>}
/>
```

- Titre `title-page`, sous-titre `meta`, sur deux lignes serrées (`leading-tight`).
- Les actions se placent côté *end* via `ms-auto`. **Jamais `ml-auto`** —
  `_app.products.index.tsx` l.372 utilise `ml-auto` pour le compteur, qui reste
  donc du mauvais côté en arabe.
- Un seul bouton plein par écran. S'il en faut un second (Exporter, Imprimer),
  il est `variant="outline"` et se place *avant* le principal dans l'ordre de
  lecture, donc côté start du bouton plein.
- La recherche **quitte** l'en-tête de page (où elle est sur produits) pour la
  barre de filtres, où elle est déjà sur commandes et factures. Un seul endroit.

### 3.3 Bandeau statistique — `<StatCard>`

Un composant unique remplace `StatCard` (produits, cliquable) et `Kpi`
(commandes, non cliquable) :

```tsx
<StatCard
  icon={Clock} label="En attente" value={12}
  tone="warning"           // default | success | warning | danger | info
  filled={false}           // true = fond plein (tableau de bord uniquement)
  onClick={…} active={…}   // absents => carte non interactive
/>
```

- Hauteur fixe **76 px**, `px-4 py-3`, icône 36 px dans une pastille
  `rounded-lg bg-{tone}/10 text-{tone}`, étiquette `micro-label`, valeur
  `font-display text-2xl font-semibold tabular-nums`.
- Icône côté start, texte côté end du bloc, en `flex items-center gap-3`.
- **Non cliquable** (commandes, factures) : `elev-1`, pas de curseur, pas de
  survol. **Cliquable** (produits) : `cursor-pointer`, `.lift` limité à
  `elev-1 → elev-2` sans translation, et à l'état actif `ring-1 ring-primary
  border-primary/70 bg-primary/5`, plus `role="button"`, `tabIndex={0}`,
  `aria-pressed`. La différence d'affordance doit être visible sans survol :
  la carte cliquable porte un `border-border` légèrement plus marqué.
- Ne **pas** rendre cliquables les cartes qui ne le sont pas aujourd'hui.
- Grille : `grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5` selon le
  nombre de cartes. Sur 1366 px, cinq cartes de 76 px tiennent sur une ligne.

### 3.4 Barre de filtres — `<Toolbar>`

Une carte `surface` en `p-3`, `flex flex-wrap items-center gap-2`.

Ordre imposé, du start vers le end : **recherche → filtres à choix → filtres de
dates → « Réinitialiser » → compteur**.

- Recherche : largeur `w-64` fixe, icône `Search` en `absolute start-2.5`,
  champ en `ps-9`. **`_app.orders.index.tsx` l.505 et `_app.invoices.index.tsx`
  utilisent `absolute left-2` avec `pl-8`** : en arabe, la loupe se superpose au
  texte saisi. À convertir en `start`/`ps`.
- Sélecteurs : largeurs normalisées sur trois paliers seulement — `w-36` (états
  courts), `w-44` (dépôts, types), `w-56` (clients, produits). Aujourd'hui on
  trouve `w-32`, `w-40`, `w-44`, `w-48`, `w-56` : le repliage est imprévisible.
- « Réinitialiser » : `variant="ghost" size="sm"`, avec icône `RotateCcw`,
  visible uniquement si au moins un filtre est actif — comportement déjà en
  place, à conserver tel quel.
- Compteur : `meta`, `ms-auto`, format `{filtrées} / {total}`.
- **Repli sous `md`** : la recherche reste visible pleine largeur ; les autres
  filtres passent dans un `Sheet` déclenché par un bouton `Filtres` portant un
  `Badge` du nombre de filtres actifs. Aucun filtre n'est retiré, seulement
  déplacé.

### 3.5 Le tableau

**Un seul conteneur**, partout :

```tsx
<div className="surface overflow-hidden">
  <div className="max-h-[calc(100vh-22rem)] overflow-auto">
    <Table>…</Table>
  </div>
</div>
```

Fini le `Card p-4` + `div.rounded-md.border` de commandes et factures : la carte
**est** le cadre du tableau, sans padding, sans bordure interne.

| Point | Spécification |
|---|---|
| En-tête | `sticky top-0 z-10 bg-card`, bordure basse 1 px, ombre `--elev-3` limitée vers le bas, hauteur 40 px, `micro-label` sans `uppercase` (déjà `text-muted-foreground font-medium`) |
| Hauteur de ligne | **48 px fixes** (`h-12`, cf. `--row-height`), y compris les lignes à vignette |
| Cellule | `px-3`, `align-middle`, `text-sm` |
| Zébrage | aucun. Une bordure basse `border-border/60` suffit et pèse moins |
| Survol | `bg-muted/50`, 100 ms |
| Ligne cliquable | `cursor-pointer` + la **première cellule contient un vrai `<Link>`** vers la même cible. Aujourd'hui `onClick` sur `<TableRow>` (produits l.402) est invisible au clavier |
| Colonne identifiante | `body-strong`, jamais tronquée |
| Colonnes chiffrées | `text-end tabular-nums` — **`text-end`, pas `text-right`** (cf. constat n°6) |
| Références | `font-mono text-xs` (déjà le cas sur produits et commandes) |
| Colonne d'actions | `sticky inset-inline-end-0 bg-card`, largeur fixe, bordure start 1 px lorsque le tableau défile horizontalement |
| Vignettes | 32 px (`h-8 w-8`), au plus trois empilées + `+N`. Aujourd'hui 40 px × 4 déforment la hauteur de ligne |

**Défilement horizontal.** Commandes affiche 12 colonnes, factures 8 : sur 1366 px
le tableau déborde. La colonne d'actions collante côté end règle le cas le plus
douloureux (les boutons Valider/Livrer sortaient de l'écran). Ne pas masquer de
colonne : les équipes s'appuient dessus.

**Actions de ligne.** Rester sur des boutons visibles — masquer « Livrer » dans
un menu `…` coûterait un clic à chaque commande traitée, plusieurs dizaines de
fois par jour. Mais :
- taille `h-8 w-8` au lieu de `h-9 w-9` (5 actions × 4 px = 20 px regagnés) ;
- icônes en `text-muted-foreground`, passant à `text-foreground` au survol.
  Aujourd'hui elles sont colorées en dur (`text-blue-600`, `text-emerald-600`,
  `text-rose-600`) : cinq points de couleur par ligne sur 40 lignes, l'œil ne
  sait plus où se poser. Seule la suppression garde `text-destructive` ;
- `Tooltip` sur chacune, avec le libellé déjà présent dans `title=`.

**Grosse volumétrie.** Aujourd'hui, `select("*")` sans limite, rendu intégral :
2 000 produits = 2 000 lignes dans le DOM. Sans changer la requête ni ajouter de
pagination, poser sur les lignes :

```css
.data-table tbody tr { content-visibility: auto; contain-intrinsic-size: auto 48px; }
```

Le navigateur cesse de peindre les lignes hors écran. Zéro changement
fonctionnel, gain immédiat au défilement. La pagination réelle est en
hors périmètre.

### 3.6 États de l'écran de liste

Les quatre états occupent **la même boîte**, à l'intérieur de la coquille de
tableau, en-tête de colonnes conservé, pour que rien ne saute.

**Chargement** — `<TableSkeleton rows={8} columns={n} />` : de vraies
`TableRow` de 48 px contenant des barres `.skeleton` de hauteur 12 px et de
largeurs variées (60 %, 85 %, 40 %…) pour imiter la densité réelle. Les cartes
statistiques affichent une barre `.skeleton` de 24 px à la place du chiffre —
aujourd'hui le tableau de bord affiche « 0 » puis la vraie valeur, ce qui se lit
comme une donnée fausse.

**Vide — aucune donnée** (`total === 0`) :

```
        ┌───┐
        │ ▣ │      icône du domaine, 40 px, text-muted-foreground
        └───┘
    Aucune commande pour le moment
    Créez une première commande pour la voir apparaître ici.
         [+ Nouvelle commande]        ← seulement si l'utilisateur peut créer
```
`py-16`, centré, titre `text-sm font-medium`, description `meta`.

**Vide — aucun résultat** (`total > 0 && filtrées === 0`) : cas de loin le plus
fréquent, quelqu'un a laissé un filtre en place.

```
    Aucun résultat pour ces filtres
    43 commandes existent mais aucune ne correspond à votre recherche.
         [⟲ Réinitialiser les filtres]
```
Le bouton appelle exactement le `reset` déjà écrit dans chaque écran.

**Erreur** — aujourd'hui inexistante ; l'écran ment en affichant « Aucune
commande ». Panneau `Alert variant="destructive"` dans la coquille de tableau :

```
    ⚠  Impossible de charger les commandes
       La connexion au serveur a échoué. Vérifiez votre accès réseau.
       [Réessayer]        Détail technique ▾
```
« Détail technique » est un `Collapsible` révélant `error.message` en
`font-mono text-xs`. Le bouton appelle `refetch()`.

**Accès refusé** — un utilisateur sans le droit `view` qui arrive par URL directe
voit aujourd'hui un tableau vide (la RLS renvoie zéro ligne) et croit ses données
perdues. Écran plein, centré :

```
        🔒
    Accès non autorisé
    Vous n'avez pas la permission de consulter ce module.
    Contactez un administrateur si vous pensez qu'il s'agit d'une erreur.
         [Retour au tableau de bord]
```
La *maquette* est dans le périmètre. **Le branchement sur `can(module,'view')`
est un changement de comportement : hors périmètre** (§ 9). Livrer le composant
prêt à l'emploi, non câblé.

---

## 4. Archétype C — écran de détail

**Qui, quoi.** On ouvre un détail pour vérifier un état et agir dessus :
encaisser, valider, livrer, corriger une fiche. Quelques dizaines de fois par
jour, toujours en aller-retour depuis une liste.

Concerne : `products/$id`, `orders/$id`, `sales/$id`, `invoices/$id`,
`projects/$id`, `users/$id`.

Aujourd'hui deux mondes : `products/$id` est riche (titre 3xl, grille 5/7,
bento de spécifications), `orders/$id` et `invoices/$id` sont des piles de
`Card p-4`. On unifie sur une seule ossature.

### 4.1 Composition

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← │ CMD-0042                       [Valider] [Livrer] [Annuler]        │ collant
│   │ Benali · échéance 26/03/2026   [En attente] [Impayée]              │
├────────────────────────────────────────────────────────────┬───────────┤
│ colonne principale (8/12)                                  │ rail (4/12)│
│ ┌────────────────────────────────────────────────────────┐ │ ┌───────┐ │
│ │ Produits commandés                                     │ │ │Total  │ │
│ │ ─────────────────────────────────────────────────────  │ │ │ TTC   │ │
│ │ Description        Qté     PU      TVA    Total TTC    │ │ │4 200  │ │
│ │ …                                                      │ │ │Payé   │ │
│ └────────────────────────────────────────────────────────┘ │ │2 000  │ │
│ ┌────────────────────────────────────────────────────────┐ │ │Reste  │ │
│ │ Paiements                                              │ │ │2 200  │ │
│ │ [Montant][Mode ▾] [+ Ajouter]                          │ │ ├───────┤ │
│ │ …                                                      │ │ │Client │ │
│ └────────────────────────────────────────────────────────┘ │ │Benali │ │
│                                                            │ └───────┘ │
└────────────────────────────────────────────────────────────┴───────────┘
```

Ce que ça change concrètement pour `orders/$id` : les trois cartes de résumé
(client, statuts, montants) qui occupent aujourd'hui toute la largeur en haut
passent dans le rail de fin. Sur 1366 × 768, les lignes de la commande remontent
au-dessus de la ligne de flottaison — c'est l'information qu'on vient chercher.

### 4.2 En-tête de détail — `<DetailHeader>`

- `sticky top-14 z-20`, fond `bg-background/85 backdrop-blur-md`, bordure basse,
  `--elev-2` au défilement. Sur une facture de 40 lignes, les actions restent
  atteignables sans remonter.
- Retour : `Button variant="ghost" size="icon"` avec `ArrowLeft`. **Ajouter la
  classe `rtl-flip`** — la règle globale ne cible que `svg.lucide-arrow-left`,
  ce qui couvre le cas, mais l'expliciter évite la régression au prochain
  changement d'icône.
- Titre : `title-page`. Ligne secondaire `meta` : contexte + `<StatusBadge>`.
  Uniformiser `products/$id` (aujourd'hui `text-3xl`) sur ce format.
- Actions côté end, ordre constant : actions secondaires (`outline`), action
  principale (plein, `elev-brand`), puis destructive (`variant="destructive"`),
  toujours en dernier et séparée par un `Separator` vertical de 16 px.

### 4.3 Colonne principale et rail

- Grille `grid grid-cols-1 gap-4 lg:grid-cols-12`, principale `lg:col-span-8`,
  rail `lg:col-span-4`. Sous `lg`, le rail passe **au-dessus** de la colonne
  principale (le résumé prime sur petit écran) : `order-first lg:order-none`.
- Rail `sticky top-32 self-start` : il suit la lecture des lignes.
- Cartes du rail : `surface p-4`, titre `micro-label`, valeur `font-display
  text-xl tabular-nums`. Le total TTC est la seule valeur en `text-2xl`.
- Tableaux internes (lignes de commande, paiements, mouvements) : mêmes règles
  qu'au § 3.5, sans bandeau statistique ni barre de filtres, sans en-tête collant
  (ils sont courts), lignes à **40 px** au lieu de 48 (contexte plus dense).
- `products/$id` conserve sa galerie : elle devient le premier bloc de la
  colonne principale (`aspect-[4/3]`), le bento de spécifications passe en
  `grid-cols-2 sm:grid-cols-4` dans la même colonne, et prix / marge / stock /
  dépôt vont dans le rail. La structure 5/7 actuelle disparaît au profit du 8/4
  commun.

### 4.4 Mode édition en ligne

`products/$id` bascule tout l'écran en formulaire (`isEditing`). On conserve ce
comportement — c'est fonctionnel — mais visuellement : la carte d'édition prend
`--elev-2` et un filet `rule-start` orange, et l'en-tête de détail affiche
« Modification en cours » en `meta` pour qu'on ne se croie pas en consultation.

### 4.5 États du détail

| État | Traitement |
|---|---|
| Chargement | Squelette de la structure : bloc titre 20 px, trois barres de rail, six lignes de tableau. **Pas de spinner centré** — aujourd'hui `products/$id`, `projects/$id`, `invoices/$id` affichent un `Loader2` dans le vide, et `orders/$id` un simple « Chargement… » en haut à gauche |
| Introuvable | Bloc centré : « Cette commande est introuvable » / « Elle a peut-être été supprimée. » + `[Retour aux commandes]`. Aujourd'hui `products/$id` affiche « Aucune donnée » sous une flèche de retour nue |
| Erreur | Même panneau qu'au § 3.6, pleine largeur sous l'en-tête de détail |
| Accès refusé | Même composant qu'au § 3.6 |
| Sous-liste vide | Ligne `meta` centrée dans la carte, `py-8` : « Aucun paiement enregistré », « Aucun document joint », « Aucune activité ». Formulation homogène : toujours « Aucun/Aucune X » sans point final |

---

## 5. Archétype D — formulaires et dialogues

**Qui, quoi.** Création et édition de fiches et de pièces. Le formulaire de
commande et de facture comporte un tableau de lignes éditable : c'est le
formulaire le plus lourd de l'application et il est saisi plusieurs fois par jour.

### 5.1 Coquille de dialogue

Défaut actuel : `DialogContent className="max-w-3xl max-h-[90vh]
overflow-y-auto"` fait défiler **tout** le dialogue, pied compris. Sur un
portable de 768 px, il faut faire défiler un formulaire produit jusqu'en bas pour
atteindre « Enregistrer ». Le sélecteur multi-produits (`_app.orders.index.tsx`
l.411) fait déjà les choses correctement : `flex flex-col overflow-hidden` avec
un corps `flex-1 overflow-y-auto`. Généraliser ce patron :

```tsx
<DialogContent className="flex max-h-[85vh] w-[min(92vw,var(--dlg))] flex-col gap-0 overflow-hidden p-0 elev-4">
  <DialogHeader className="border-b px-6 py-4">…</DialogHeader>
  <div className="flex-1 overflow-y-auto px-6 py-5">…</div>
  <DialogFooter className="border-t bg-muted/30 px-6 py-3">…</DialogFooter>
</DialogContent>
```

Trois largeurs seulement (`--dlg`) : **`sm` 480 px** (confirmation, formulaire à
1-3 champs : mouvement de stock, dépôt), **`md` 720 px** (fiche à deux colonnes :
produit, client, fournisseur), **`lg` 960 px** (documents à lignes : commande,
facture, vente). Aujourd'hui on trouve `max-w-2xl`, `max-w-3xl`, `max-w-4xl` sans
règle.

Le pied est toujours visible, séparé par une bordure et un fond `bg-muted/30`.
Actions en fin : `Annuler` (`variant="ghost"`) puis l'action principale.

### 5.2 Champs

Le helper `Field` de `_app.products.index.tsx` (étiquette `text-xs
text-muted-foreground` + contrôle, `space-y-1.5`) est le bon patron. Il est
copié-collé dans `products.index` et `products.$id` et **absent** de commandes et
factures, où l'on trouve `<div><Label>Date commande</Label><Input/></div>` :
l'étiquette colle au champ. Extraire en `src/components/forms/field.tsx` :

```tsx
<Field label="Prix de vente" unit="DH" required hint="Prix affiché au client">
  <Input … />
</Field>
```

- Étiquette : `text-xs font-medium text-muted-foreground`, liée par `htmlFor`.
- Requis : `<span aria-hidden className="ms-0.5 text-destructive">*</span>` +
  `aria-required="true"` sur le contrôle. Aujourd'hui l'astérisque est concaténé
  dans la chaîne (`t("sku") + " *"`), donc lu par les lecteurs d'écran comme
  « étoile ».
- Unité (`DH`, `%`, `cm`) : suffixe `meta` dans l'étiquette, pas dans le
  placeholder.
- Aide : `meta` sous le champ, `mt-1`.
- Hauteur de contrôle : **36 px** (`h-9`) en formulaire, **32 px** (`h-8`) dans
  les tableaux de lignes éditables — c'est déjà ce que font commandes et
  factures, on l'inscrit dans la règle.
- Grille : `grid gap-x-5 gap-y-4 sm:grid-cols-2`, champs longs en
  `sm:col-span-2`. Les champs apparentés restent sur la même ligne (prix
  d'achat / prix de vente ; quantité / seuil).

### 5.3 Tableau de lignes éditable

Le cœur des formulaires commande, facture et vente.

- Conteneur `rounded-lg border`, en-tête `bg-muted/40`, lignes 44 px.
- Largeurs de colonnes fixes en pourcentage, comme aujourd'hui
  (`w-[28%]` produit, `w-[15%]` dépôt…) : à harmoniser entre les trois écrans,
  qui divergent.
- Le total de ligne est `text-end tabular-nums font-medium`.
- Bouton de suppression de ligne : `h-8 w-8 ghost`, icône `text-muted-foreground`,
  `text-destructive` au survol.
- Les deux boutons d'ajout (`Plusieurs produits`, `Ligne`) restent au-dessus du
  tableau, côté end, en `size="sm" variant="outline"`.
- Le message d'indisponibilité (`text-xs text-rose-600`, l.345) passe en
  `text-destructive`.
- Le bloc de totaux : carte `surface p-4` alignée côté end sous le tableau, avec
  `Sous-total HT`, `TVA`, séparateur, `Total TTC` en `text-lg font-semibold
  tabular-nums`. Structure déjà bonne, juste normalisée.
- **Cases à cocher natives** dans le sélecteur multi-produits
  (`<input type="checkbox">`, l.435) : remplacer par la primitive `Checkbox`,
  qui a l'anneau de focus et les états corrects.

### 5.4 Confirmations

`src/components/confirm-dialog.tsx` est déjà le bon modèle : un seul
`AlertDialog` monté à la racine, titre + description des effets réels, libellé
d'action explicite, `destructive` pour le rouge. Les descriptions écrites dans
les écrans de commandes sont exemplaires (« La marchandise sera immédiatement
sortie du stock. En cas d'erreur, repasser la commande en Annulée la réintègre. »).
Trois retouches visuelles :

1. `AlertDialogContent` en `elev-4`, largeur `sm` (480 px).
2. Quand `destructive`, **le focus initial va sur « Annuler »**, pas sur
   l'action. Une confirmation destructive validée par une frappe d'Entrée
   réflexe, c'est une commande supprimée.
3. Icône d'accompagnement dans l'en-tête : `AlertTriangle` en `text-destructive`
   dans une pastille `bg-destructive/10` de 36 px si `destructive`, `Info` en
   `text-info` sinon. Côté start du titre.

### 5.5 Après enregistrement

Le comportement actuel est cohérent et ne change pas : `toast.success`,
invalidation react-query, fermeture du dialogue, réinitialisation du formulaire.
Uniformiser seulement la **position du toast** : `sonner` doit recevoir la
direction courante — en arabe, les toasts doivent apparaître côté start-bas.
Passer `dir={lang === "ar" ? "rtl" : "ltr"}` au `<Toaster>`.

### 5.6 États du formulaire

| État | Traitement |
|---|---|
| Chargement des listes de référence (clients, produits, dépôts) | Le `SelectTrigger` affiche « Chargement… » et reste désactivé. Aujourd'hui il affiche une liste vide, indistinguable d'une base sans clients |
| Enregistrement | Bouton principal `disabled` + `Loader2` en rotation, libellé inchangé. Déjà le cas sur commandes et factures ; à généraliser à produits, qui se contente de `disabled` |
| Erreur de sauvegarde | `toast.error(e.message)` conservé. En plus : `Alert variant="destructive"` persistant en tête du corps du dialogue, car le toast disparaît avant qu'on ait fini de lire |
| Validation échouée | Conservée telle quelle (toast listant les champs). Le marquage champ par champ demanderait un nouvel état : hors périmètre |
| Formulaire modifié puis fermé | Comportement actuel conservé (fermeture sans avertissement) |

---

## 6. Archétype E — tableau de bord

**Qui, quoi.** Direction et responsables, une à trois fois par jour, en lecture
seule : prendre la température, repérer les ruptures, cliquer vers le détail.

### 6.1 Composition

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tableau de bord                                    Période [Mois ▾]     │
│ Vue d'ensemble de l'activité Nolte Küchen                              │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│ │▣ STOCK  │ │▣ ENTRÉES│ │▣ SORTIES│ │▣ CA     │   4 cartes pleines     │
│ │  1 248  │ │    320  │ │    186  │ │ 84 200  │   (identité DreamsPOS) │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                        │
├────────────────────────────────────────────┬───────────────────────────┤
│ Mouvements — Mois                          │ ⚠ Alertes stock faible    │
│ [aire teal = entrées, aire orange = sorties]│ • Hotte Bosch      [2]   │
│                                            │ • Plan de travail  [0]   │
├────────────────────────────────┬───────────┴───────────────────────────┤
│ Produits les plus actifs       │ Activité récente                      │
│ [barres horizontales]          │ [liste]                               │
└────────────────────────────────┴───────────────────────────────────────┘
```

### 6.2 Cartes statistiques pleines

Les quatre cartes de couleur (orange, teal, navy, bleu roi) **sont** l'identité
DreamsPOS de la 1.0 : on les garde. Trois corrections :

1. **Contraste des étiquettes.** `opacity-80` sur du blanc posé sur
   `--primary oklch(0.72 0.19 50)` donne environ 2,9:1 à 11 px — sous le seuil
   AA. Passer à `opacity-90` **et** `font-weight: 500`, ce qui remonte au-delà de
   4,5:1 sur les quatre fonds. Idem pour la ligne `delta`.
2. Élévation `--elev-2`, aucun survol (elles ne sont pas cliquables — ne pas les
   rendre cliquables, ce serait un changement de comportement).
3. Hauteur alignée sur `<StatCard>` en variante `filled` : même composant, même
   gabarit interne que les bandeaux de listes. Un seul objet à maintenir.

Pendant le chargement, la valeur est une barre `.skeleton` de 24 px, pas « 0 ».

### 6.3 Graphiques Recharts

**Correction prioritaire.** Le graphique principal trace `in` avec
`var(--color-primary)` et `out` avec `var(--color-warning)` — or les deux tokens
valent exactement `oklch(0.72 0.19 50)`. Les deux aires sont dans la même
couleur. Nouvelle affectation, prise dans la palette de graphiques existante :

| Série | Token | Justification |
|---|---|---|
| Entrées de stock | `--chart-2` (teal) | même teal que le statut « succès » |
| Sorties de stock | `--chart-1` (orange) | orange de marque |
| Produits les plus actifs | `--chart-1` | série unique |
| Toute troisième série | `--chart-3` (bleu roi), puis `--chart-4` (navy), `--chart-5` (vert) | ordre fixe |

Autres réglages, valables pour tous les graphiques de l'application, y compris
`_app.reports.tsx` :

- Grille : `stroke="var(--color-border)"`, `strokeDasharray="3 3"`, horizontale
  seulement (verticale seulement pour les barres horizontales). Déjà correct.
- Axes : `fontSize={11}`, `tickLine={false}`, `axisLine={false}`,
  `stroke="var(--color-muted-foreground)"`. Déjà correct.
- Épaisseur de trait 2 px, dégradé de remplissage 0,35 → 0.
- Infobulle : utiliser la primitive `chart` (`ChartTooltipContent`) plutôt que
  les `contentStyle` en ligne recopiés dans chaque écran.
- Hauteur : 288 px (`h-72`) pour le graphique principal, 256 px (`h-64`) pour
  les secondaires. Déjà le cas.
- Légende : absente aujourd'hui du graphique des mouvements. Sans elle, deux
  aires colorées sans clé de lecture. Ajouter une légende compacte en haut à
  droite de l'en-tête de carte : deux pastilles de 8 px + libellés `meta`
  « Entrées » / « Sorties » (chaînes déjà présentes : `stock_in`, `stock_out`).

**RTL.** `[dir="rtl"] .recharts-wrapper { direction: ltr }` est déjà posé, et
c'est le bon choix : Recharts ne sait pas s'inverser proprement. Conséquence à
assumer : dans un tableau de bord en arabe, les graphiques se lisent de gauche à
droite alors que la page va de droite à gauche. Acceptable pour des axes
temporels ; à signaler à l'équipe. La légende, elle, doit rester **hors** du
`recharts-wrapper` pour suivre la direction de la page.

### 6.4 Blocs de liste

Alertes de stock, activité récente, produits les plus actifs : mêmes règles.

- Ligne : `flex items-center justify-between rounded-lg border border-border/60
  px-3 py-2`, hauteur 44 px.
- Les alertes de stock sont des `<Link>` : leur survol passe à `bg-accent` et le
  badge de quantité utilise `<StatusBadge tone="danger">`.
- Vide : « Aucune alerte de stock » (`meta`, centré, `py-8`). **Retirer l'émoji**
  de « Aucune alerte 🎉 » : dans un ERP interne, le ton attendu est neutre.
- Chargement : trois lignes `.skeleton` de 44 px.
- Erreur : une ligne `Alert variant="destructive"` compacte dans la carte, pas un
  écran plein — le reste du tableau de bord doit rester lisible si une seule
  requête échoue.

### 6.5 Sélecteur de période

Reste côté end de l'en-tête de page, `w-36`. Envisager `ToggleGroup` plutôt que
`Select` — cinq options courtes, un clic au lieu de deux. Mais cela ajoute
environ 260 px de largeur dans l'en-tête et casse sur portable. **Rester sur
`Select`** ; le gain ne paye pas le coût.

---

## 7. Récapitulatif des états

Quatre composants partagés couvrent tout. Les livrer **en premier** : chaque
écran ensuite refondu les consomme au lieu de réinventer sa variante.

| Composant | Fichier proposé | Primitives utilisées |
|---|---|---|
| `<TableSkeleton rows columns />` | `src/components/data/table-skeleton.tsx` | `table` + `.skeleton` |
| `<EmptyState variant icon title description action />` | `src/components/data/empty-state.tsx` | aucune (div + `button`) |
| `<ErrorState error onRetry />` | `src/components/data/error-state.tsx` | `alert`, `collapsible`, `button` |
| `<PermissionDenied />` | `src/components/data/permission-denied.tsx` | aucune |

Inventaire de ce qui existe aujourd'hui, à remplacer :

| Écran | Chargement | Vide | Erreur |
|---|---|---|---|
| `products.index` | `t("loading")` en cellule | `t("no_data")` | absente |
| `orders.index` | **aucun** | « Aucune commande » | absente |
| `invoices.index` | ligne de cellule | « Aucune facture » | absente |
| `stock` | `t("loading")` | `t("no_data")` | absente |
| `suppliers` | « Chargement… » | « Aucun fournisseur » | absente |
| `warehouses` | « Chargement… » | « Aucun dépôt » | absente |
| `customers` | ligne de cellule | « Aucun client » | absente |
| `projects.index` | ligne de cellule | « Aucun projet » | absente |
| `products/$id` | `Loader2` centré | « Aucune donnée » | absente |
| `orders/$id` | « Chargement… » brut | — | absente |
| `dashboard` | `animate-pulse` (graphique seul) | « Aucune alerte 🎉 » | absente |

Huit formulations de chargement, onze formulations de vide, zéro erreur.

---

## 8. Copie française et clés i18n

`src/lib/i18n.tsx` est un dictionnaire plat `Record<string, string>`. Clés en
`snake_case`, à ajouter aux deux dictionnaires.

### 8.1 États

| Clé | Français |
|---|---|
| `state_loading` | Chargement… *(existe : `loading`)* |
| `state_empty_title` | Aucune donnée pour le moment |
| `state_empty_desc` | Les éléments créés apparaîtront ici. |
| `state_no_results_title` | Aucun résultat pour ces filtres |
| `state_no_results_desc` | {total} éléments existent, mais aucun ne correspond à votre recherche. |
| `state_reset_filters` | Réinitialiser les filtres |
| `state_error_title` | Impossible de charger les données |
| `state_error_desc` | La connexion au serveur a échoué. Vérifiez votre accès réseau. |
| `state_error_retry` | Réessayer |
| `state_error_details` | Détail technique |
| `state_denied_title` | Accès non autorisé |
| `state_denied_desc` | Vous n'avez pas la permission de consulter ce module. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur. |
| `state_denied_back` | Retour au tableau de bord |
| `state_not_found_title` | Élément introuvable |
| `state_not_found_desc` | Il a peut-être été supprimé. |

### 8.2 Vides par domaine

| Clé | Français |
|---|---|
| `empty_products` | Aucun produit au catalogue |
| `empty_products_desc` | Ajoutez un premier produit pour commencer à suivre votre stock. |
| `empty_orders` | Aucune commande pour le moment |
| `empty_orders_desc` | Créez une première commande pour la voir apparaître ici. |
| `empty_invoices` | Aucune facture émise |
| `empty_customers` | Aucun client enregistré |
| `empty_suppliers` | Aucun fournisseur enregistré |
| `empty_warehouses` | Aucun dépôt configuré |
| `empty_movements` | Aucun mouvement de stock |
| `empty_projects` | Aucun projet en cours |
| `empty_documents` | Aucun document |
| `empty_payments` | Aucun paiement enregistré |
| `empty_activity` | Aucune activité |
| `empty_alerts` | Aucune alerte de stock |
| `empty_notifications` | Aucune notification *(existe en dur dans `app-header.tsx`)* |

### 8.3 Coquille et divers

| Clé | Français |
|---|---|
| `skip_to_content` | Aller au contenu |
| `toggle_sidebar` | Afficher ou masquer le menu (Ctrl + B) |
| `filters` | Filtres |
| `filters_active` | {n} filtre(s) actif(s) |
| `results_count` | {shown} / {total} |
| `chart_legend_in` | Entrées *(réutiliser `stock_in`)* |
| `chart_legend_out` | Sorties *(réutiliser `stock_out`)* |
| `editing_in_progress` | Modification en cours |
| `select_loading` | Chargement… |

**Question ouverte :** les traductions arabes doivent être fournies par un
locuteur. Les poser en français dans `ar` créerait un mélange pire que
l'absence. Solution provisoire : `t()` retombe déjà sur la clé si absente —
préférer une retombée sur le français, ce qui est un changement d'une ligne dans
`i18n.tsx` (`dicts[lang][k] ?? dicts.fr[k] ?? String(k)`). À arbitrer.

---

## 9. Accessibilité

### Contrastes vérifiés

| Combinaison | Ratio | Verdict |
|---|---|---|
| `--muted-foreground` sur `--card` | ≈ 4,9:1 | conforme AA texte normal |
| `--muted-foreground` sur `--muted` | ≈ 4,7:1 | conforme, limite |
| `--primary-foreground` sur `--primary` | ≈ 4,6:1 | conforme AA ; à ne pas descendre sous 14 px |
| Étiquette blanche 80 % sur `--primary` (cartes du tableau de bord) | ≈ 2,9:1 | **non conforme** → passer à 90 % + graisse 500 |
| `text-amber-700` sur `bg-amber-500/15` en thème sombre | ≈ 2,4:1 | **non conforme** → `<StatusBadge>` règle le cas |
| `--destructive` sur `bg-destructive/10` | ≈ 5,1:1 | conforme |
| Bordure `--border` sur `--card` | ≈ 1,3:1 | insuffisant pour une bordure porteuse de sens : ne jamais faire reposer une information sur la seule bordure |

### Clavier

- Ordre de focus d'un écran de liste : lien d'évitement → coquille → titre (non
  focalisable) → action principale → recherche → filtres → réinitialiser →
  première ligne du tableau → actions de la ligne → ligne suivante.
- Toute ligne cliquable a un `<Link>` réel dans sa cellule identifiante.
- `Escape` ferme dialogues, popovers et sheets (Radix, déjà en place).
- `Ctrl/⌘ + B` replie la barre latérale (déjà en place, à documenter dans
  l'infobulle).
- Les cartes statistiques cliquables sont des `button` avec `aria-pressed`.
- L'en-tête de tableau collant ne piège pas le focus (`position: sticky`, pas de
  `tabindex`).

### Cibles de pointage

36 px pour les boutons d'icône sur poste fixe (inférieur aux 44 px des
recommandations tactiles, assumé : cet outil est utilisé à la souris toute la
journée, et 44 px coûterait une ligne de tableau par écran). Sous le point de
rupture `md`, les boutons d'icône passent à 40 px et les lignes de tableau à
52 px.

### Sémantique

- `<Table>` avec `<caption className="sr-only">` décrivant le contenu.
- Colonnes triables (le cas échéant) : `aria-sort`.
- Les squelettes portent `aria-hidden="true"`, et la zone du tableau porte
  `aria-busy="true"` pendant le chargement.
- Les états vides et d'erreur sont dans un `role="status"` (vide) ou
  `role="alert"` (erreur).
- Les badges de statut portent leur libellé en texte : jamais de couleur seule.

### RTL — liste des points à corriger

Tous vérifiés dans le code actuel.

| Fichier | Problème | Correction |
|---|---|---|
| `_app.products.index.tsx` l.372 | `ml-auto` sur le compteur | `ms-auto` |
| `_app.orders.index.tsx` l.416, l.505 | `absolute left-2` + `pl-8` pour l'icône de recherche | `start-2.5` + `ps-9` |
| `_app.invoices.index.tsx` | idem | idem |
| `_app.orders.index.tsx`, `_app.invoices.index.tsx`, `_app.dashboard.tsx` | `mr-2` / `mr-1` sur les icônes de bouton | `me-2` / `me-1` (produits le fait déjà) |
| tous les tableaux | `text-right` sur les colonnes chiffrées, neutralisé par la règle RTL globale | `text-end` |
| `styles.css` | `h1..h5` gardent `font-display` + crénage négatif en arabe | règle `[dir="rtl"]` dédiée (§ 1.1) |
| `styles.css` | `uppercase` + `tracking` sur les micro-étiquettes en arabe | neutralisés en RTL (§ 1.1) |
| `sonner` | direction non transmise | `dir` depuis `useI18n()` |
| `ImageViewer` (produits) | `top-4 right-4`, `left-4`, `right-4`, `-translate-x-1/2` | `inset-inline-end-4`, `inset-inline-start-4` ; les chevrons prennent `.rtl-flip` |
| vignettes produits | `-space-x-2` ne s'inverse pas | cosmétique, l'empilement part du mauvais côté ; à convertir en marges logiques |

Règle générale à faire respecter en revue : **aucun nouveau `left-`, `right-`,
`ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`** dans le code de la 1.1a.
Uniquement `start`/`end`, `ms`/`me`, `ps`/`pe`, `text-start`/`text-end`. Les
mappings de compatibilité en fin de `styles.css` existent pour le code hérité,
pas pour le neuf — et le constat n°6 montre qu'ils créent leurs propres bugs.

---

## 10. Faut-il une nouvelle primitive ?

Non. Les 46 primitives couvrent le besoin :

- `sticky` header de tableau : CSS pur sur `TableHeader`.
- Squelettes : `.skeleton` de la fondation ; la primitive `skeleton` existante
  (`animate-pulse bg-primary/10`) sera alignée sur `.skeleton` pour n'avoir
  qu'un seul rendu de chargement.
- États vides / erreur / refus : composition de `alert`, `collapsible`, `button`.
- Fil d'Ariane : `breadcrumb`, présent et inutilisé.
- Repli des filtres sur portable : `sheet`.
- Légende de graphique : `chart` (`ChartLegendContent`), présent et inutilisé.
- Infobulles de rail replié : `tooltip`, déjà supporté par `SidebarMenuButton`.

Les composants proposés (`StatCard`, `StatusBadge`, `PageHeader`, `Toolbar`,
`DetailHeader`, `Field`, `TableSkeleton`, `EmptyState`, `ErrorState`,
`PermissionDenied`) sont des **compositions applicatives**, à placer dans
`src/components/data/` et `src/components/forms/`, pas dans
`src/components/ui/`, qui reste le miroir de shadcn.

---

## 11. Hors périmètre

Recommandations écartées parce qu'elles changeraient le comportement, une règle
métier ou une permission. À reprendre dans une 1.2 fonctionnelle.

1. **Pagination des listes.** Toutes les requêtes font `select("*")` sans limite
   et rendent l'intégralité. La primitive `pagination` existe et n'est utilisée
   nulle part. Le palliatif `content-visibility` (§ 3.5) est purement visuel ;
   la vraie pagination change le chargement des données.
2. **Garde `can(module, 'view')` sur les routes.** L'écran « Accès non autorisé »
   est spécifié et livrable, mais le brancher modifie le contrôle d'accès côté
   client. À traiter avec un relecteur privilèges.
3. **Unification du formateur monétaire.** `_app.products.index.tsx` affiche
   `p.selling_price.toFixed(2)` (« 1234.00 DH ») là où commandes et factures
   utilisent `Intl.NumberFormat("fr-FR")` (« 1 234,00 DH »). L'alignement et la
   police tabulaire sont dans le périmètre ; changer les chaînes affichées
   modifie ce que l'utilisateur lit, donc non.
4. **Erreurs champ par champ dans les formulaires.** Aujourd'hui un toast liste
   les champs manquants. Marquer les champs en rouge demande un nouvel état de
   validation.
5. **Retrait de `framer-motion` du `package.json`.** Le remplacement de son usage
   par `.enter` dans le tableau de bord est visuel ; désinstaller la dépendance
   est une décision de build.
6. **Recherche globale (`command` / palette).** La primitive `command` est
   présente et inutilisée. Une palette `Ctrl+K` serait le plus gros gain de
   vitesse de l'application — et c'est une fonctionnalité entière.
7. **Bascule de densité (compact / confortable).** Ajoute un état persistant.
8. **Tri par colonne.** Aucune liste n'est triable ; ajouter le tri est
   fonctionnel.
9. **Repli du texte de statut des produits en infobulle** (description du dépôt
   déplacée en `Tooltip` pour tenir la hauteur de ligne) : l'information reste
   accessible, mais elle cesse d'être visible sans interaction. À valider avec
   les magasiniers avant de l'appliquer.
10. **Traductions arabes des nouvelles chaînes** et retombée `ar → fr` dans
    `i18n.tsx`.

---

## 12. Ordre de déploiement recommandé

Séquencé pour que chaque lot soit livrable seul, visible immédiatement, et
prépare le suivant. Un lot = une PR relue.

### Lot 1 — Socle invisible (½ journée) — *à faire en premier, sans exception*

1. Corriger le conflit d'anneau de focus dans `button.tsx`, `badge.tsx`,
   `input.tsx` (constat n°7). Sans cela, tout le reste s'empile sur une base
   d'accessibilité inopérante.
2. Ajouter les règles RTL de typographie dans `styles.css` (§ 1.1).
3. Livrer `<StatusBadge>`, `<TableSkeleton>`, `<EmptyState>`, `<ErrorState>`,
   `<PermissionDenied>`, `<StatCard>`, `<PageHeader>`, `<Toolbar>`, `<Field>`.
   Aucun écran ne les consomme encore.
4. Ajouter les clés i18n du § 8.

*Effet visible : nul. Effet réel : tout ce qui suit devient du câblage.*

### Lot 2 — L'écran de liste (2 à 3 jours) — **le plus gros retour**

Appliquer l'archétype B à **produits, commandes, facturation, ventes** d'abord
(les quatre écrans les plus consultés), puis stock, clients, fournisseurs,
dépôts, projets, documents, utilisateurs, journaux, audit.

Par écran : coquille de tableau unique, en-tête collant, lignes 48 px, colonne
d'actions collante, `text-end tabular-nums`, `<StatusBadge>`, `<Toolbar>`,
`<StatCard>`, les quatre états, corrections RTL du § 9.

*Deux à trois lignes de plus visibles par écran, un en-tête de colonnes qui ne
s'échappe plus, des statuts lisibles en thème sombre, et la fin des écrans qui
affichent « Aucune commande » pendant qu'ils chargent.*

### Lot 3 — La coquille (1 jour)

Barre latérale (actif distinguable, tooltips en replié, `h-9`, séparateurs),
en-tête (fil d'Ariane, bouton de langue réparé, e-mail tronqué, ombre au
défilement, lien d'évitement), padding de `<main>`.

*Placé après le lot 2 parce que le fil d'Ariane s'appuie sur `src/lib/nav.ts`,
extrait à ce moment-là, et parce que le gain de densité du lot 2 se voit sans lui.*

### Lot 4 — Les détails (1 à 2 jours)

Archétype C sur `orders/$id`, `invoices/$id`, `sales/$id`, `products/$id`,
`projects/$id` : en-tête de détail collant, grille 8/4, rail de résumé, états.

### Lot 5 — Formulaires et dialogues (1 à 2 jours)

Coquille de dialogue à pied fixe, trois largeurs, `<Field>` généralisé,
tableaux de lignes harmonisés, `Checkbox` à la place des cases natives,
confirmations (focus sur Annuler, icône, `elev-4`), `dir` sur sonner.

### Lot 6 — Tableau de bord (½ journée)

Correction des couleurs du graphique (constat n°4 — c'est un bug de lecture,
pas une préférence), contraste des étiquettes, légende, `<StatCard filled>`,
squelettes, suppression de `framer-motion` sur cet écran, retrait de l'émoji.

*Le tableau de bord est le plus visible mais le moins utilisé. Il passe après
les écrans où les équipes passent leurs journées. Seule exception : si la
correction des deux aires de même couleur peut être extraite en une PR d'une
ligne, la sortir tout de suite — c'est une information actuellement illisible.*

---

## 13. Questions ouvertes

1. **Fil d'Ariane** : accepte-t-on l'extraction de `src/lib/nav.ts` (déplacement
   de code partagé entre barre latérale et en-tête), ou préfère-t-on la version
   minimale « on retire simplement la mention statique » ?
2. **Description du dépôt dans la liste produits** : peut-on la déplacer en
   infobulle pour tenir une hauteur de ligne fixe, ou les magasiniers en ont-ils
   besoin en permanence ?
3. **Densité de ligne** : 48 px est un compromis. Les équipes préféreraient-elles
   44 px (une ligne de plus par écran, confort moindre) ?
4. **Arabe** : qui fournit les traductions des nouvelles chaînes ? Et valide-t-on
   la retombée `ar → fr` en attendant ?
5. **Graphiques en arabe** : le maintien en LTR est-il accepté par les
   utilisateurs arabophones, ou faut-il au moins inverser l'axe des catégories ?
6. **Thème sombre** : est-il réellement utilisé en production ? Plusieurs
   corrections de contraste ne le concernent que lui ; si personne ne s'en sert,
   l'effort peut être réduit — mais la bascule est dans l'en-tête, donc
   accessible à tous.
