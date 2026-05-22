import { Badge } from "@/components/ui/badge";
import type { Stock } from "@/lib/types";

export function StockBadge({ stock }: { stock: Pick<Stock, "currentQuantity" | "minimumQuantity"> }) {
  if (stock.currentQuantity === 0) {
    return <Badge variant="zero">Sem estoque</Badge>;
  }

  if (stock.currentQuantity <= stock.minimumQuantity) {
    return <Badge variant="low">Baixo estoque</Badge>;
  }

  return <Badge variant="success">Em estoque</Badge>;
}
