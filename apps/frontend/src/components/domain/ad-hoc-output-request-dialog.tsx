import { PackageMinus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Product, Stock, Warehouse } from "@/lib/types";
import { todayInputValue } from "@/lib/utils";

type DraftItem = {
  id: string;
  productId: string;
  quantity: string;
  unitId: string;
};

type AdHocOutputRequestDialogProps = {
  onCreated: () => Promise<void>;
  warehouse?: Warehouse | null;
};

function draftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function productBaseUnitId(product: Product) {
  return product.unitId || product.unit.id;
}

function createDraftItem(stock?: Stock): DraftItem {
  return {
    id: draftId(),
    productId: stock?.productId ?? "",
    quantity: "1",
    unitId: stock ? productBaseUnitId(stock.product) : "",
  };
}

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 6,
  });
}

function availableStocks(warehouse?: Warehouse | null) {
  return (warehouse?.stocks ?? [])
    .filter((stock) => stock.currentQuantity > 0 && stock.product.active !== false)
    .sort((left, right) => left.product.code.localeCompare(right.product.code));
}

function unitOptionsForProduct(product?: Product) {
  if (!product) {
    return [];
  }

  return [
    {
      label: `${product.unit.name} / ${product.unit.abbreviation}`,
      searchText: "unidade base",
      value: productBaseUnitId(product),
    },
    ...(product.unitConversions?.filter((conversion) => conversion.active) ?? []).map(
      (conversion) => ({
        label: `${conversion.fromUnit.name} / ${conversion.fromUnit.abbreviation}`,
        searchText: `${formatQuantity(Number(conversion.factorToBase))} ${product.unit.abbreviation}`,
        value: conversion.fromUnitId,
      }),
    ),
  ];
}

function convertedBaseQuantity(product: Product | undefined, item: DraftItem) {
  const quantity = Number(item.quantity);

  if (!product || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  if (!item.unitId || item.unitId === productBaseUnitId(product)) {
    return quantity;
  }

  const conversion = product.unitConversions?.find(
    (current) => current.active && current.fromUnitId === item.unitId,
  );
  const factor = Number(conversion?.factorToBase);

  if (!conversion || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }

  return quantity * factor;
}

function conversionPreview(product: Product | undefined, item: DraftItem) {
  const quantity = Number(item.quantity);
  const conversion = product?.unitConversions?.find(
    (current) => current.active && current.fromUnitId === item.unitId,
  );
  const factor = Number(conversion?.factorToBase);

  if (
    !product ||
    !conversion ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(factor)
  ) {
    return null;
  }

  return `${formatQuantity(quantity)} ${conversion.fromUnit.abbreviation} serão registradas como ${formatQuantity(quantity * factor)} ${product.unit.abbreviation}.`;
}

export function AdHocOutputRequestDialog({
  onCreated,
  warehouse,
}: AdHocOutputRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stocks = useMemo(() => availableStocks(warehouse), [warehouse]);
  const stockByProduct = useMemo(
    () => new Map(stocks.map((stock) => [stock.productId, stock])),
    [stocks],
  );
  const requestedByProduct = useMemo(() => {
    const totals = new Map<string, number>();

    for (const item of items) {
      const stock = stockByProduct.get(item.productId);
      const baseQuantity = convertedBaseQuantity(stock?.product, item);

      if (!stock || baseQuantity === null) {
        continue;
      }

      totals.set(item.productId, (totals.get(item.productId) ?? 0) + baseQuantity);
    }

    return totals;
  }, [items, stockByProduct]);
  const validItems = items
    .map((item) => {
      const stock = stockByProduct.get(item.productId);
      const quantity = Number(item.quantity);

      return {
        productId: item.productId,
        quantity,
        unitId: item.unitId || (stock ? productBaseUnitId(stock.product) : undefined),
      };
    })
    .filter(
      (item) =>
        item.productId &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0,
    );
  const hasInsufficientStock = items.some((item) => {
    const stock = stockByProduct.get(item.productId);
    const requested = requestedByProduct.get(item.productId) ?? 0;

    return Boolean(stock && requested > stock.currentQuantity);
  });

  function openDialog() {
    setItems([createDraftItem(stocks[0])]);
    setMovementDate(todayInputValue());
    setReason("");
    setObservation("");
    setMessage(null);
    setOpen(true);
  }

  function updateItem(
    itemId: string,
    field: "productId" | "quantity" | "unitId",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (field === "productId") {
          const stock = stockByProduct.get(value);

          return {
            ...item,
            productId: value,
            unitId: stock ? productBaseUnitId(stock.product) : "",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      }),
    );
    setMessage(null);
  }

  function addItem() {
    setItems((current) => [...current, createDraftItem(stocks[0])]);
  }

  function removeItem(itemId: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.id !== itemId) : current,
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!warehouse?.active) {
      setMessage("Almoxarifado indisponível para saída avulsa.");
      return;
    }

    if (!validItems.length) {
      setMessage("Informe ao menos um produto com quantidade maior que zero.");
      return;
    }

    if (!reason.trim()) {
      setMessage("Informe o motivo da solicitação.");
      return;
    }

    if (hasInsufficientStock) {
      setMessage(null);
      return;
    }

    const primaryItem = validItems[0];

    setSaving(true);
    setMessage(null);

    try {
      await api("/entry-requests/ad-hoc-output", {
        body: JSON.stringify({
          items: validItems,
          movementDate,
          reason,
          observation,
          productId: primaryItem.productId,
          quantity: primaryItem.quantity,
          warehouseId: warehouse.id,
        }),
        method: "POST",
      });
      await onCreated();
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao enviar solicitação.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button disabled={!stocks.length} onClick={openDialog} type="button" variant="outline">
        <PackageMinus className="h-4 w-4" />
        Solicitar saída avulsa
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saída avulsa</DialogTitle>
            <DialogDescription>
              {warehouse
                ? `A baixa em ${warehouse.name} será registrada somente depois da aprovação.`
                : "A baixa será registrada somente depois da aprovação."}
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceMessage message={message} /> : null}
            <div className="space-y-3">
              {items.map((item, index) => {
                const stock = stockByProduct.get(item.productId);
                const product = stock?.product;
                const requested = requestedByProduct.get(item.productId) ?? 0;
                const exceedsStock = Boolean(stock && requested > stock.currentQuantity);
                const preview = conversionPreview(product, item);

                return (
                  <div
                    className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]"
                    key={item.id}
                  >
                    <FormField>
                      <Label htmlFor={`ad-hoc-product-${item.id}`}>
                        {items.length === 1 ? "Produto" : `Produto ${index + 1}`}
                      </Label>
                      <SearchSelect
                        ariaLabel={
                          items.length === 1 ? "Produto" : `Produto ${index + 1}`
                        }
                        emptyMessage="Nenhum produto com saldo disponível."
                        id={`ad-hoc-product-${item.id}`}
                        onValueChange={(value) => updateItem(item.id, "productId", value)}
                        options={stocks.map((currentStock) => ({
                          label: `${currentStock.product.code} - ${currentStock.product.name}`,
                          searchText: `${currentStock.product.category.name} ${currentStock.currentQuantity} ${currentStock.product.unit.abbreviation}`,
                          value: currentStock.productId,
                        }))}
                        placeholder="Selecione"
                        value={item.productId}
                      />
                    </FormField>
                    <FormField>
                      <Label htmlFor={`ad-hoc-quantity-${item.id}`}>Quantidade</Label>
                      <Input
                        id={`ad-hoc-quantity-${item.id}`}
                        min="0.000001"
                        onChange={(event) =>
                          updateItem(item.id, "quantity", event.target.value)
                        }
                        required
                        step="any"
                        type="number"
                        value={item.quantity}
                      />
                    </FormField>
                    <FormField>
                      <Label htmlFor={`ad-hoc-unit-${item.id}`}>Unidade</Label>
                      <SearchSelect
                        ariaLabel={`Unidade ${index + 1}`}
                        disabled={!product}
                        id={`ad-hoc-unit-${item.id}`}
                        onValueChange={(value) => updateItem(item.id, "unitId", value)}
                        options={unitOptionsForProduct(product)}
                        placeholder="Selecione"
                        value={item.unitId || (product ? productBaseUnitId(product) : "")}
                      />
                    </FormField>
                    <div className="flex items-end">
                      <Button
                        aria-label={`Remover item ${index + 1}`}
                        disabled={items.length === 1}
                        onClick={() => removeItem(item.id)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {stock ? (
                      <div className="space-y-1 rounded-md border bg-background p-2 text-sm text-muted-foreground sm:col-span-4">
                        <p>
                          Saldo disponível: {formatQuantity(stock.currentQuantity)}{" "}
                          {stock.product.unit.abbreviation}
                        </p>
                        {preview ? <p>{preview}</p> : null}
                        {exceedsStock ? (
                          <p className="font-medium text-rose-700">
                            Quantidade solicitada excede o saldo disponível.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <Button disabled={!stocks.length} onClick={addItem} type="button" variant="outline">
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
            </div>
            <FormField>
              <Label htmlFor="ad-hoc-date">Data da movimentação</Label>
              <Input
                id="ad-hoc-date"
                onChange={(event) => setMovementDate(event.target.value)}
                required
                type="datetime-local"
                value={movementDate}
              />
            </FormField>
            <FormField>
              <Label htmlFor="ad-hoc-reason">Motivo da solicitação</Label>
              <Textarea
                id="ad-hoc-reason"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Descreva o motivo desta saída avulsa."
                required
                value={reason}
              />
            </FormField>
            <FormField>
              <Label htmlFor="ad-hoc-observation">Observação</Label>
              <Textarea
                id="ad-hoc-observation"
                onChange={(event) => setObservation(event.target.value)}
                value={observation}
              />
            </FormField>
            <Button disabled={!validItems.length || !reason.trim() || saving} type="submit">
              <PackageMinus className="h-4 w-4" />
              {saving ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResourceMessage({ message }: { message: string }) {
  return (
    <Alert className="border-rose-200 bg-rose-50 text-rose-950">
      <AlertTitle>Atenção</AlertTitle>
      <AlertDescription className="text-current">{message}</AlertDescription>
    </Alert>
  );
}
