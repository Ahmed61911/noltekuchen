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
};

const ar: Dict = {
  app_name: "نولتي كوشن",
  app_tagline: "نظام إدارة داخلي",
  dashboard: "لوحة التحكم",
  products: "المنتجات",
  stock: "المخزون",
  sales: "المبيعات والطلبات",
  appointments: "المواعيد",
  suppliers: "الموردون",
  customers: "طلبات العملاء",
  documents: "الوثائق",
  reports: "التقارير",
  logs: "سجل العمليات",
  users: "المستخدمون",
  settings: "الإعدادات",
  logout: "تسجيل الخروج",
  login: "تسجيل الدخول",
  signup: "إنشاء حساب",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  full_name: "الاسم الكامل",
  sign_in: "دخول",
  sign_up: "تسجيل",
  no_account: "ليس لديك حساب؟",
  has_account: "لديك حساب بالفعل؟",
  welcome_back: "مرحباً بعودتك",
  create_account_title: "أنشئ حسابك",
  total_stock: "إجمالي المخزون",
  stock_in: "الإدخالات",
  stock_out: "الإخراجات",
  revenue: "المبيعات",
  top_products: "أكثر المنتجات حركة",
  low_stock_alerts: "تنبيهات المخزون المنخفض",
  recent_activity: "النشاط الأخير",
  movements_30d: "الحركات (آخر ٣٠ يوماً)",
  add_product: "إضافة منتج",
  edit_product: "تعديل منتج",
  product_name: "اسم المنتج",
  reference: "المرجع",
  name: "الاسم",
  sku: "رمز المنتج / SKU",
  brand: "العلامة التجارية",
  category: "التصنيف",
  supplier: "المورد",
  warehouse: "المستودع",
  select_warehouse: "اختر مستودعاً",
  purchase_price: "سعر الشراء",
  selling_price: "سعر البيع",
  margin: "الهامش",
  quantity: "الكمية",
  min_stock: "الحد الأدنى",
  dimensions: "الأبعاد",
  description: "الوصف",
  images: "الصور",
  image_url: "رابط الصورة",
  actions: "إجراءات",
  save: "حفظ",
  cancel: "إلغاء",
  delete: "حذف",
  search: "بحث",
  no_data: "لا توجد بيانات",
  new_movement: "حركة جديدة",
  movement_in: "إدخال",
  movement_out: "إخراج",
  type: "النوع",
  reason: "السبب",
  date: "التاريخ",
  product: "المنتج",
  by: "بواسطة",
  loading: "جاري التحميل…",
  saved: "تم الحفظ",
  deleted: "تم الحذف",
  error: "خطأ",
  confirm_delete: "تأكيد الحذف؟",
  units: "وحدة",
};

const dicts = { fr, ar };

type Ctx = { lang: Lang; t: (k: keyof typeof fr) => string; setLang: (l: Lang) => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    return (localStorage.getItem("lang") as Lang) || "fr";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", lang);
  }, [lang]);

  const t = (k: keyof typeof fr) => dicts[lang][k] ?? String(k);
  return <I18nContext.Provider value={{ lang, setLang: setLangState, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
