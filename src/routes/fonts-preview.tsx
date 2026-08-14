import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/fonts-preview")({
  component: FontsPreview,
  head: () => ({
    meta: [{ title: "Fonts Preview — Nolte Küchen" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Instrument+Serif&family=Sora:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&family=Archivo:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=Playfair+Display:wght@600;700;800&family=Söhne&family=General+Sans&display=swap",
      },
    ],
  }),
});

type Pair = {
  id: string;
  name: string;
  vibe: string;
  display: string;
  body: string;
  displayFamily: string;
  bodyFamily: string;
};

const pairs: Pair[] = [
  {
    id: "1",
    name: "Space Grotesk × DM Sans",
    vibe: "Actuel — c'est ce que le site utilise déjà. Moderne, tech, neutre.",
    display: "Space Grotesk",
    body: "DM Sans",
    displayFamily: "'Space Grotesk', ui-sans-serif, system-ui",
    bodyFamily: "'DM Sans', ui-sans-serif, system-ui",
  },
  {
    id: "2",
    name: "Fraunces × Inter",
    vibe: "Éditorial premium. Serif expressif contemporain + sans classique. Marque haut de gamme.",
    display: "Fraunces",
    body: "Inter",
    displayFamily: "'Fraunces', ui-serif, Georgia",
    bodyFamily: "'Inter', ui-sans-serif, system-ui",
  },
  {
    id: "3",
    name: "Instrument Serif × Inter",
    vibe: "Chic, magazine, moderne. Grands titres serif italiques élégants — parfait pour l'univers cuisine allemande.",
    display: "Instrument Serif",
    body: "Inter",
    displayFamily: "'Instrument Serif', ui-serif, Georgia",
    bodyFamily: "'Inter', ui-sans-serif, system-ui",
  },
  {
    id: "4",
    name: "Sora × Manrope",
    vibe: "SaaS moderne. Géométrique, propre, très lisible en dashboard.",
    display: "Sora",
    body: "Manrope",
    displayFamily: "'Sora', ui-sans-serif, system-ui",
    bodyFamily: "'Manrope', ui-sans-serif, system-ui",
  },
  {
    id: "5",
    name: "Archivo × IBM Plex Sans",
    vibe: "Industriel, précis, allemand. Fort en display, sobre en corps de texte. Ambiance ingénierie.",
    display: "Archivo",
    body: "IBM Plex Sans",
    displayFamily: "'Archivo', ui-sans-serif, system-ui",
    bodyFamily: "'IBM Plex Sans', ui-sans-serif, system-ui",
  },
  {
    id: "6",
    name: "Playfair Display × Work Sans",
    vibe: "Luxe classique. Serif Didone très contrasté + sans neutre. Élégance intemporelle.",
    display: "Playfair Display",
    body: "Work Sans",
    displayFamily: "'Playfair Display', ui-serif, Georgia",
    bodyFamily: "'Work Sans', ui-sans-serif, system-ui",
  },
];

function Sample({ p }: { p: Pair }) {
  return (
    <section
      className="rounded-2xl border bg-card p-8 shadow-card"
      style={{ fontFamily: p.bodyFamily }}
    >
      <div className="mb-6 flex items-baseline justify-between gap-4 border-b pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Option {p.id}
          </div>
          <div
            className="mt-1 text-lg font-semibold"
            style={{ fontFamily: p.displayFamily }}
          >
            {p.name}
          </div>
        </div>
        <p className="max-w-md text-right text-sm text-muted-foreground">{p.vibe}</p>
      </div>

      <h1
        className="text-5xl font-semibold leading-[1.05] tracking-tight"
        style={{ fontFamily: p.displayFamily }}
      >
        L'élégance allemande, gérée avec précision.
      </h1>

      <h2
        className="mt-8 text-2xl font-semibold"
        style={{ fontFamily: p.displayFamily }}
      >
        Tableau de bord — Novembre 2026
      </h2>

      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Pilotez votre stock, vos commandes et vos rendez-vous depuis une seule interface.
        Nolte Küchen ERP centralise l'ensemble du back-office pour votre showroom.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { label: "Chiffre d'affaires", value: "128 450 DH", d: "+12,4%" },
          { label: "Commandes", value: "342", d: "+8" },
          { label: "Stock critique", value: "17", d: "SKU" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-background p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {k.label}
            </div>
            <div
              className="mt-2 text-3xl font-semibold"
              style={{ fontFamily: p.displayFamily }}
            >
              {k.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{k.d}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h3
            className="text-lg font-semibold"
            style={{ fontFamily: p.displayFamily }}
          >
            Détail d'une commande
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2">Produit</th>
                <th className="py-2">Qté</th>
                <th className="py-2 text-right">Prix</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Nova Lack — Blanc mat", "1", "8 240 DH"],
                ["Îlot central 240cm", "1", "3 120 DH"],
                ["Plan travail céramique", "2", "1 680 DH"],
              ].map((r) => (
                <tr key={r[0]} className="border-b last:border-0">
                  <td className="py-3">{r[0]}</td>
                  <td className="py-3">{r[1]}</td>
                  <td className="py-3 text-right tabular-nums">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3
            className="text-lg font-semibold"
            style={{ fontFamily: p.displayFamily }}
          >
            Notes internes
          </h3>
          <p className="mt-3 text-sm leading-relaxed">
            Livraison prévue semaine 47. Le client a confirmé les finitions en showroom
            avec Sabine. RDV de pose planifié le 21/11 — équipe Munich.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant"
              style={{ fontFamily: p.bodyFamily }}
            >
              Valider la commande
            </button>
            <button
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ fontFamily: p.bodyFamily }}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
        <span style={{ fontFamily: p.displayFamily }} className="font-semibold">
          Display:
        </span>{" "}
        {p.display} —{" "}
        <span style={{ fontFamily: p.displayFamily }} className="font-semibold">
          Body:
        </span>{" "}
        {p.body}
      </div>
    </section>
  );
}

function FontsPreview() {
  return (
    <div className="min-h-screen bg-gradient-mesh px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Nolte Küchen · Typographie
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            6 propositions de typographie
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Chaque bloc simule un écran réel de l'application avec la paire proposée
            (titre + corps). Dis-moi laquelle te plaît et je l'applique à tout le site.
          </p>
        </header>

        <div className="space-y-8">
          {pairs.map((p) => (
            <Sample key={p.id} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
