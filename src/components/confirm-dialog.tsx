import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title: string;
  /** Ce que l'action va réellement faire, effets de bord compris. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Bouton rouge : réservé aux actions destructrices ou irréversibles. */
  destructive?: boolean;
};

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

/**
 * Confirmation partagée, en remplacement de `window.confirm`.
 *
 * Le natif bloquait le thread, ignorait la langue et le thème de
 * l'application, ne pouvait pas distinguer une action destructrice d'une
 * action anodine, et s'affiche sur mobile comme une alerte navigateur brute.
 *
 * Un seul dialogue est monté à la racine de la zone authentifiée et exposé
 * par contexte : les écrans appellent `confirm()` sans avoir à insérer de
 * JSX ni à gérer d'état local.
 *
 *     if (await confirm({ title: "Supprimer ?", destructive: true })) …
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setOpen(false);
    // Toujours résoudre : sans cela, fermer par Échap ou par clic extérieur
    // laisserait l'appelant suspendu indéfiniment.
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {opts?.cancelLabel ?? "Annuler"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={opts?.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined}
            >
              {opts?.confirmLabel ?? "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfirm doit être utilisé dans <ConfirmProvider>");
  return c;
}
