import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  sub?: string;
  onClick?: () => void;
}

const TONES = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/15 text-warning-foreground",
  info: "bg-info/10 text-info",
};

export function StatCard({ title, value, icon: Icon, tone = "default", sub, onClick }: Props) {
  return (
    <Card className={onClick ? "cursor-pointer hover:bg-accent transition-colors" : ""} onClick={onClick}>
      <CardContent className="p-3 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm text-muted-foreground">{title}</div>
            <div className="text-base sm:text-xl lg:text-2xl font-semibold mt-1 break-words">{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
          </div>
          <div
            className={`size-9 sm:size-11 shrink-0 rounded-lg grid place-items-center ${TONES[tone]}`}
          >
            <Icon className="size-4 sm:size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
