import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Stock par produit et par dépôt, calculé depuis les mouvements.
 *
 * Le dépôt n'est plus une propriété de la fiche produit : un produit « est »
 * dans un dépôt tant qu'il y reste du stock. Les écrans devis / commandes /
 * ventes / retours n'affichent donc que les dépôts réellement approvisionnés,
 * au lieu de laisser choisir n'importe lequel.
 */
export type DepotStock = { warehouse_id: string; quantity: number };

export function useStockByWarehouse() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-by-warehouse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_stock_by_warehouse")
        .select("product_id,warehouse_id,quantity");
      if (error) throw error;
      return data ?? [];
    },
  });

  const byProduct = new Map<string, DepotStock[]>();
  for (const row of data as { product_id: string | null; warehouse_id: string | null; quantity: number | null }[]) {
    if (!row.product_id || !row.warehouse_id) continue;
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue; // un dépôt vide n'est plus un dépôt du produit
    const list = byProduct.get(row.product_id) ?? [];
    list.push({ warehouse_id: row.warehouse_id, quantity: qty });
    byProduct.set(row.product_id, list);
  }

  /** Dépôts où ce produit a du stock, du mieux fourni au moins fourni. */
  function depotsFor(productId: string | null | undefined): DepotStock[] {
    if (!productId) return [];
    return (byProduct.get(productId) ?? []).slice().sort((a, b) => b.quantity - a.quantity);
  }

  /** Stock de ce produit dans ce dépôt précis. */
  function qtyIn(productId: string | null | undefined, warehouseId: string | null | undefined): number {
    if (!productId || !warehouseId) return 0;
    return depotsFor(productId).find((d) => d.warehouse_id === warehouseId)?.quantity ?? 0;
  }

  return { depotsFor, qtyIn, isLoading };
}
