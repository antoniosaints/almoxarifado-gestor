import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { SystemBrandingSettings } from "@/components/domain/system-branding-settings";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type { FleetSettings, FleetStructure } from "@/lib/types";

type StructureDraft = {
  active: boolean;
  id?: string;
  name: string;
  notes: string;
  type: string;
};

function emptyStructure(): StructureDraft {
  return {
    active: true,
    name: "",
    notes: "",
    type: "",
  };
}

function draftFromStructure(structure: FleetStructure): StructureDraft {
  return {
    active: structure.active,
    id: structure.id,
    name: structure.name,
    notes: structure.notes ?? "",
    type: structure.type ?? "",
  };
}

export function FleetSettingsPage() {
  const settings = useApiResource<FleetSettings | null>("/fleet/settings", null);
  const structures = useApiResource<FleetStructure[]>("/fleet/structures", []);
  const [draftSettings, setDraftSettings] = useState<FleetSettings | null>(null);
  const [structureDraft, setStructureDraft] = useState<StructureDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftSettings) {
      return;
    }

    try {
      await api<FleetSettings>("/fleet/settings", {
        body: JSON.stringify({
          beltAlertPercent: draftSettings.beltAlertPercent,
          driverLicenseAlertDays: draftSettings.driverLicenseAlertDays,
          fuelTypes: draftSettings.fuelTypes,
          maintenanceAlertDays: draftSettings.maintenanceAlertDays,
          maintenanceTypes: draftSettings.maintenanceTypes,
          oilAlertPercent: draftSettings.oilAlertPercent,
          preventiveServiceTypes: draftSettings.preventiveServiceTypes,
          primaryControlUnit: draftSettings.primaryControlUnit,
          vehicleTypes: draftSettings.vehicleTypes,
        }),
        method: "PUT",
      });
      setDraftSettings(null);
      setMessage(null);
      await settings.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function saveStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!structureDraft) {
      return;
    }

    try {
      await api<FleetStructure>(
        structureDraft.id
          ? `/fleet/structures/${structureDraft.id}`
          : "/fleet/structures",
        {
          body: JSON.stringify({
            active: structureDraft.active,
            name: structureDraft.name,
            notes: structureDraft.notes || null,
            type: structureDraft.type || null,
          }),
          method: structureDraft.id ? "PUT" : "POST",
        },
      );
      setStructureDraft(null);
      setMessage(null);
      await structures.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  if (settings.loading || structures.loading) {
    return <LoadingLine label="Carregando configurações da frota..." />;
  }

  if (settings.error || structures.error || !settings.data) {
    return <ResourceError message={settings.error ?? structures.error ?? "Configuração indisponível."} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Parâmetros e estruturas</p>
          <h2 className="text-2xl font-semibold">Configurações da frota</h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDraftSettings(settings.data)} variant="outline">
            <Pencil className="h-4 w-4" />
            Alertas
          </Button>
          <Button onClick={() => setStructureDraft(emptyStructure())}>
            <Plus className="h-4 w-4" />
            Estrutura
          </Button>
        </div>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <SystemBrandingSettings
        description="Ajustes gerais compartilhados com a tela de login e o app administrativo."
        title="Aparencia, marca e login"
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Alerta CNH</p>
          <p className="text-2xl font-semibold">{settings.data.driverLicenseAlertDays} dias</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Alerta manutenção</p>
          <p className="text-2xl font-semibold">{settings.data.maintenanceAlertDays} dias</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Óleo</p>
          <p className="text-2xl font-semibold">{settings.data.oilAlertPercent}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Correia</p>
          <p className="text-2xl font-semibold">{settings.data.beltAlertPercent}%</p>
        </div>
      </div>

      <DataTable
        columns={[
          { cell: (structure) => structure.name, header: "Estrutura", key: "name" },
          { cell: (structure) => structure.type ?? "-", header: "Tipo", key: "type" },
          {
            cell: (structure) => (
              <Badge variant={structure.active ? "success" : "zero"}>
                {structure.active ? "Ativa" : "Inativa"}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (structure) => (
              <div className="flex justify-end">
                <Button
                  aria-label={`Editar ${structure.name}`}
                  onClick={() => setStructureDraft(draftFromStructure(structure))}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ),
            cellClassName: "text-right",
            header: "Ações",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={structures.data}
        emptyMessage="Nenhuma estrutura cadastrada."
        getRowId={(structure) => structure.id}
        searchText={(structure) => `${structure.name} ${structure.type ?? ""}`}
      />

      <Dialog onOpenChange={(open) => !open && setDraftSettings(null)} open={Boolean(draftSettings)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Parâmetros de frota</DialogTitle>
            <DialogDescription>Configure alertas, unidades e listas usadas nos cadastros.</DialogDescription>
          </DialogHeader>
          {draftSettings ? (
            <Form onSubmit={saveSettings}>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField><Label htmlFor="fleet-set-cnh">CNH (dias)</Label><Input id="fleet-set-cnh" min={1} onChange={(event) => setDraftSettings({ ...draftSettings, driverLicenseAlertDays: Number(event.target.value) })} type="number" value={draftSettings.driverLicenseAlertDays} /></FormField>
                <FormField><Label htmlFor="fleet-set-maint">Manutenção (dias)</Label><Input id="fleet-set-maint" min={1} onChange={(event) => setDraftSettings({ ...draftSettings, maintenanceAlertDays: Number(event.target.value) })} type="number" value={draftSettings.maintenanceAlertDays} /></FormField>
                <FormField><Label htmlFor="fleet-set-unit">Controle</Label><Select id="fleet-set-unit" onChange={(event) => setDraftSettings({ ...draftSettings, primaryControlUnit: event.target.value as FleetSettings["primaryControlUnit"] })} value={draftSettings.primaryControlUnit}><option value="KM">Km</option><option value="HOURS">Horas</option><option value="BOTH">Ambos</option></Select></FormField>
                <FormField><Label htmlFor="fleet-set-oil">Óleo (%)</Label><Input id="fleet-set-oil" min={1} max={100} onChange={(event) => setDraftSettings({ ...draftSettings, oilAlertPercent: Number(event.target.value) })} type="number" value={draftSettings.oilAlertPercent} /></FormField>
                <FormField><Label htmlFor="fleet-set-belt">Correia (%)</Label><Input id="fleet-set-belt" min={1} max={100} onChange={(event) => setDraftSettings({ ...draftSettings, beltAlertPercent: Number(event.target.value) })} type="number" value={draftSettings.beltAlertPercent} /></FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField><Label htmlFor="fleet-set-types">Tipos de veículo</Label><Textarea id="fleet-set-types" onChange={(event) => setDraftSettings({ ...draftSettings, vehicleTypes: event.target.value })} value={draftSettings.vehicleTypes} /></FormField>
                <FormField><Label htmlFor="fleet-set-fuels">Combustíveis</Label><Textarea id="fleet-set-fuels" onChange={(event) => setDraftSettings({ ...draftSettings, fuelTypes: event.target.value })} value={draftSettings.fuelTypes} /></FormField>
                <FormField><Label htmlFor="fleet-set-maint-types">Tipos de manutenção</Label><Textarea id="fleet-set-maint-types" onChange={(event) => setDraftSettings({ ...draftSettings, maintenanceTypes: event.target.value })} value={draftSettings.maintenanceTypes} /></FormField>
                <FormField><Label htmlFor="fleet-set-services">Serviços preventivos</Label><Textarea id="fleet-set-services" onChange={(event) => setDraftSettings({ ...draftSettings, preventiveServiceTypes: event.target.value })} value={draftSettings.preventiveServiceTypes} /></FormField>
              </div>
              <Button type="submit">Salvar configurações</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setStructureDraft(null)} open={Boolean(structureDraft)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{structureDraft?.id ? "Editar estrutura" : "Nova estrutura"}</DialogTitle>
            <DialogDescription>Secretarias, setores, obras, unidades ou departamentos.</DialogDescription>
          </DialogHeader>
          {structureDraft ? (
            <Form onSubmit={saveStructure}>
              <FormField><Label htmlFor="fleet-structure-name">Nome</Label><Input id="fleet-structure-name" onChange={(event) => setStructureDraft({ ...structureDraft, name: event.target.value })} required value={structureDraft.name} /></FormField>
              <FormField><Label htmlFor="fleet-structure-type">Tipo</Label><Input id="fleet-structure-type" onChange={(event) => setStructureDraft({ ...structureDraft, type: event.target.value })} value={structureDraft.type} /></FormField>
              <FormField><Label htmlFor="fleet-structure-notes">Observações</Label><Textarea id="fleet-structure-notes" onChange={(event) => setStructureDraft({ ...structureDraft, notes: event.target.value })} value={structureDraft.notes} /></FormField>
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input checked={structureDraft.active} onChange={(event) => setStructureDraft({ ...structureDraft, active: event.target.checked })} type="checkbox" />
                Estrutura ativa
              </label>
              <Button type="submit">Salvar estrutura</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
