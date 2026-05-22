import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function SummaryCard({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        {icon ? <div className="rounded-lg bg-muted p-2 text-primary">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
