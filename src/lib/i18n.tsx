import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "fr" | "ar";
type Dict = Record<string, string>;

const fr: Dict = {
  app_name: "Nolte Küchen",
  app_tagline: "ERP Interne",
  // nav
  dashboard: "Tableau de bord",
  products: "Produits",
  stock: "Mouvements de stocks",
  sales: "Ventes",
  appointments: "Rendez-vous",
  suppliers: "Fournisseurs",
  customers: "Demandes clients",
  documents: "Documents",
  reports: "Rapports",
  logs: "Journal d'actions",
  users: "Utilisateurs",
  settings: "Paramètres",
  logout: "Déconnexion",
  // auth
  login: "Connexion",
  signup: "Créer un compte",
  email: "Adresse e-mail",
  password: "Mot de passe",
  full_name: "Nom complet",
  sign_in: "Se connecter",
  sign_up: "S'inscrire",
  no_account: "Pas encore de compte ?",
  has_account: "Déjà inscrit ?",
  welcome_back: "Heureux de vous revoir",
  create_account_title: "Créer votre compte",
  // dashboard
  total_stock: "Stock total",
  stock_in: "Entrées de stock",
  stock_out: "Sorties de stock",
  revenue: "Chiffre d'affaires",
  top_products: "Produits les plus actifs",
  low_stock_alerts: "Alertes stock faible",
  recent_activity: "Activité récente",
  movements_30d: "Mouvements (30 derniers jours)",
  period: "Période",
  period_month: "Mois",
  period_quarter: "Trimestre",
  period_semester: "6 mois",
  period_year: "Année",
  period_all: "Total",
  movements: "Mouvements",
  stock_total_hint: "Stock actuel (hors période)",
  // products
  add_product: "Ajouter un produit",
  edit_product: "Modifier produit",
  product_name: "Nom du produit",
  reference: "Référence",
  name: "Nom",
  sku: "Code produit / SKU",
  brand: "Marque",
  category: "Catégorie",
  supplier: "Fournisseur",
  warehouse: "Dépôt",
  select_warehouse: "Sélectionner un dépôt",
  purchase_price: "Prix d'achat",
  selling_price: "Prix de vente",
  margin: "Marge",
  quantity: "Quantité",
  min_stock: "Seuil minimum",
  dimensions: "Dimensions",
  description: "Description",
  images: "Images",
  image_url: "URL de l'image",
  actions: "Actions",
  save: "Enregistrer",
  cancel: "Annuler",
  delete: "Supprimer",
  search: "Rechercher",
  no_data: "Aucune donnée",
  // stock
  new_movement: "Nouveau mouvement",
  movement_in: "Entrée",
  movement_out: "Sortie",
  type: "Type",
  reason: "Motif",
  date: "Date",
  product: "Produit",
  by: "Par",
  // misc
  loading: "Chargement…",
  saved: "Enregistré",
  deleted: "Supprimé",
  error: "Erreur",
  confirm_delete: "Confirmer la suppression ?",
  units: "unités",
  // states of a list screen (1.1a)
  state_no_results_title: "Aucun résultat pour ces filtres",
  state_no_results_desc: "{total} éléments existent, mais aucun ne correspond à votre recherche.",
  state_reset_filters: "Réinitialiser les filtres",
  state_error_title: "Impossible de charger les données",
  state_error_desc: "La connexion au serveur a échoué. Vérifiez votre accès réseau.",
  state_error_retry: "Réessayer",
  state_error_details: "Détail technique",
  error_load_products: "Impossible de charger les produits",
  error_load_orders: "Impossible de charger les commandes",
  error_load_sales: "Impossible de charger les ventes",
  error_load_invoices: "Impossible de charger les factures",
  error_load_customers: "Impossible de charger les clients",
  error_load_suppliers: "Impossible de charger les fournisseurs",
  empty_products: "Aucun produit au catalogue",
  empty_products_desc: "Ajoutez un premier produit pour commencer à suivre votre stock.",
  empty_orders: "Aucune commande pour le moment",
  empty_orders_desc: "Créez une première commande pour la voir apparaître ici.",
  empty_sales: "Aucune vente enregistrée",
  empty_sales_desc: "Enregistrez une première vente pour la voir apparaître ici.",
  empty_invoices: "Aucune facture émise",
  empty_invoices_desc: "Créez une première facture pour la voir apparaître ici.",
  empty_customers: "Aucun client enregistré",
  empty_customers_desc: "Ajoutez un premier client à votre carnet d'adresses.",
  empty_suppliers: "Aucun fournisseur enregistré",
  empty_suppliers_desc: "Ajoutez un premier fournisseur à votre carnet de contacts.",
  // pagination (1.1a)
  pagination_label: "Pagination",
  pagination_range: "{from}–{to} sur {total}",
  pagination_page_of: "Page {page} sur {pageCount}",
  pagination_rows_per_page: "Lignes par page",
  pagination_first: "Première page",
  pagination_previous: "Page précédente",
  pagination_next: "Page suivante",
  pagination_last: "Dernière page",
};

const dicts = { fr };

type Ctx = { lang: Lang; t: (k: keyof typeof fr) => string; setLang: (l: Lang) => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = "fr";
    document.documentElement.dir = "ltr";
    localStorage.setItem("lang", "fr");
  }, []);

  const t = (k: keyof typeof fr) => dicts["fr"][k] ?? String(k);
  return <I18nContext.Provider value={{ lang: "fr", setLang: setLangState, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
