import { Badge } from "@/components/ui/badge";
import type { PaymentStatus, EntityStatus, ConnectionStatus } from "@/lib/types";

export function StatusBadge({
  status,
}: {
  status: PaymentStatus | EntityStatus | ConnectionStatus | string | undefined;
}) {
  const map: Record<string, string> = {
    paid: "bg-success/15 text-success border-success/30",
    active: "bg-success/15 text-success border-success/30",
    unpaid: "bg-destructive/15 text-destructive border-destructive/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
    suspended: "bg-destructive/15 text-destructive border-destructive/30",
    partial: "bg-warning/20 text-warning-foreground border-warning/40",
    disabled: "bg-muted text-muted-foreground border-border",
  };
  const cls = (status && map[status]) ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={`capitalize ${cls}`}>
      {status ?? "—"}
    </Badge>

  );
}
