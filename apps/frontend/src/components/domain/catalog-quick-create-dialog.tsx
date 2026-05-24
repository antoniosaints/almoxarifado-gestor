import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
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
import { api } from "@/lib/api";
import type { ProductCategory, UnitOfMeasure } from "@/lib/types";

export function CategoryCreateDialog({
  onCreated,
}: {
  onCreated: (category: ProductCategory) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setName("");
      setMessage(null);
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const category = await api<ProductCategory>("/product-categories", {
        body: JSON.stringify({ description: "", name }),
        method: "POST",
      });

      await onCreated(category);
      closeDialog(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao criar categoria.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <Plus className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={closeDialog} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>Categoria usada no catalogo de produtos.</DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceError message={message} /> : null}
            {saving ? <LoadingLine label="Salvando categoria..." /> : null}
            <FormField>
              <Label htmlFor="quick-category-name">Nome</Label>
              <Input
                id="quick-category-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </FormField>
            <Button disabled={!name.trim() || saving} type="submit">
              Salvar categoria
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UnitCreateDialog({
  onCreated,
}: {
  onCreated: (unit: UnitOfMeasure) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setName("");
      setAbbreviation("");
      setMessage(null);
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const unit = await api<UnitOfMeasure>("/units", {
        body: JSON.stringify({
          abbreviation,
          name,
        }),
        method: "POST",
      });

      await onCreated(unit);
      closeDialog(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao criar unidade.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <Plus className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={closeDialog} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova unidade</DialogTitle>
            <DialogDescription>Nome e sigla usados no catalogo de produtos.</DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceError message={message} /> : null}
            {saving ? <LoadingLine label="Salvando unidade..." /> : null}
            <FormField>
              <Label htmlFor="quick-unit-name">Nome</Label>
              <Input
                id="quick-unit-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </FormField>
            <FormField>
              <Label htmlFor="quick-unit-abbreviation">Sigla</Label>
              <Input
                id="quick-unit-abbreviation"
                onChange={(event) =>
                  setAbbreviation(event.target.value.toLocaleUpperCase("pt-BR"))
                }
                required
                value={abbreviation}
              />
            </FormField>
            <Button disabled={!name.trim() || !abbreviation.trim() || saving} type="submit">
              Salvar unidade
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
