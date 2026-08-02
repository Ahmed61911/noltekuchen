import { useState } from "react";
import { AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The state no list screen had.
 *
 * Until now a failed query rendered exactly like an empty table: the screen
 * said "Aucune commande" while the server was unreachable. That is not a
 * missing nicety, it is the screen lying about the data.
 *
 * The icon deliberately sits inside a flex row instead of being a direct child
 * of `Alert`: the primitive absolutely positions `> svg` at `left-4`, which
 * would land on the wrong side in Arabic.
 */
export function ErrorState({
  title,
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className={cn("p-4", className)}>
      <Alert variant="destructive" className="text-start">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <AlertTitle>{title ?? t("state_error_title")}</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {t("state_error_desc")}
            </AlertDescription>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("state_error_retry")}
                </Button>
              ) : null}
              {error?.message ? (
                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="min-w-0">
                  <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
                    {t("state_error_details")}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-(--dur-fast)",
                        detailsOpen && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs break-words text-muted-foreground">
                    {error.message}
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </div>
          </div>
        </div>
      </Alert>
    </div>
  );
}
