import { IdCard, Pencil, Plus, Power } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
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
import { MaskedInput } from "@/components/ui/masked-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import { dateInputValue, driverCnhLabel, driverStatusLabels } from "@/lib/fleet";
import type { FleetDriver, FleetDriverStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DriverDraft = {
  cpf: string;
  email: string;
  id?: string;
  licenseCategory: string;
  licenseExpiresAt: string;
  licenseIssuedAt: string;
  licenseNumber: string;
  licenseStatus: string;
  name: string;
  notes: string;
  phone: string;
  status: FleetDriverStatus;
};

function emptyDraft(): DriverDraft {
  return {
    cpf: "",
    email: "",
    licenseCategory: "",
    licenseExpiresAt: "",
    licenseIssuedAt: "",
    licenseNumber: "",
    licenseStatus: "",
    name: "",
    notes: "",
    phone: "",
    status: "ACTIVE",
  };
}

function draftFromDriver(driver: FleetDriver): DriverDraft {
  return {
    cpf: driver.cpf ?? "",
    email: driver.email ?? "",
    id: driver.id,
    licenseCategory: driver.licenseCategory ?? "",
    licenseExpiresAt: dateInputValue(driver.licenseExpiresAt),
    licenseIssuedAt: dateInputValue(driver.licenseIssuedAt),
    licenseNumber: driver.licenseNumber ?? "",
    licenseStatus: driver.licenseStatus ?? "",
    name: driver.name,
    notes: driver.notes ?? "",
    phone: driver.phone ?? "",
    status: driver.status,
  };
}

function payloadFromDraft(draft: DriverDraft) {
  return {
    cpf: draft.cpf || null,
    email: draft.email || null,
    licenseCategory: draft.licenseCategory || null,
    licenseExpiresAt: draft.licenseExpiresAt || null,
    licenseIssuedAt: draft.licenseIssuedAt || null,
    licenseNumber: draft.licenseNumber || null,
    licenseStatus: draft.licenseStatus || null,
    name: draft.name,
    notes: draft.notes || null,
    phone: draft.phone || null,
    status: draft.status,
  };
}

function cnhVariant(driver: FleetDriver) {
  if (driver.cnhHealth === "EXPIRED") {
    return "zero" as const;
  }

  if (driver.cnhHealth === "EXPIRING" || driver.cnhHealth === "UNKNOWN") {
    return "low" as const;
  }

  return "success" as const;
}

export function FleetDriversPage() {
  const drivers = useApiResource<FleetDriver[]>("/fleet/drivers", []);
  const [draft, setDraft] = useState<DriverDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    try {
      await api<FleetDriver>(draft.id ? `/fleet/drivers/${draft.id}` : "/fleet/drivers", {
        body: JSON.stringify(payloadFromDraft(draft)),
        method: draft.id ? "PUT" : "POST",
      });
      setDraft(null);
      setMessage(null);
      await drivers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function inactivate(id: string) {
    try {
      await api<FleetDriver>(`/fleet/drivers/${id}`, { method: "DELETE" });
      await drivers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao inativar.");
    }
  }

  if (drivers.loading) {
    return <LoadingLine label="Carregando motoristas..." />;
  }

  if (drivers.error) {
    return <ResourceError message={drivers.error} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">CNH e alocação</p>
          <h2 className="text-2xl font-semibold">Motoristas</h2>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4" />
          Novo motorista
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (driver) => (
              <>
                <p className="font-medium">{driver.name}</p>
                <p className="text-xs text-muted-foreground">{driver.cpf || driver.email || "-"}</p>
              </>
            ),
            header: "Motorista",
            key: "driver",
          },
          {
            cell: (driver) => (
              <>
                <p>{driver.licenseNumber || "-"}</p>
                <p className="text-xs text-muted-foreground">
                  Categoria {driver.licenseCategory || "-"}
                </p>
              </>
            ),
            header: "CNH",
            key: "license",
          },
          {
            cell: (driver) => formatDate(driver.licenseExpiresAt),
            header: "Vencimento",
            key: "expires",
          },
          {
            cell: (driver) => (
              <Badge variant={cnhVariant(driver)}>{driverCnhLabel(driver)}</Badge>
            ),
            header: "CNH",
            key: "cnh",
          },
          {
            cell: (driver) => (
              <Badge variant={driver.status === "ACTIVE" ? "success" : "zero"}>
                {driverStatusLabels[driver.status]}
              </Badge>
            ),
            header: "Situação",
            key: "status",
          },
          {
            cell: (driver) => driver.currentVehicles?.map((vehicle) => vehicle.plate).join(", ") || "-",
            header: "Veículos",
            key: "vehicles",
          },
          {
            cell: (driver) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar ${driver.name}`}
                  onClick={() => setDraft(draftFromDriver(driver))}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Inativar ${driver.name}`}
                  disabled={driver.status === "INACTIVE"}
                  onClick={() => void inactivate(driver.id)}
                  size="icon"
                  variant="outline"
                >
                  <Power className="h-4 w-4" />
                </Button>
              </div>
            ),
            cellClassName: "text-right",
            header: "Ações",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={drivers.data}
        emptyMessage="Nenhum motorista cadastrado."
        getRowId={(driver) => driver.id}
        searchPlaceholder="Buscar motorista, CPF, CNH ou status..."
        searchText={(driver) =>
          [
            driver.name,
            driver.cpf,
            driver.email,
            driver.licenseNumber,
            driver.licenseCategory,
            driverCnhLabel(driver),
            driverStatusLabels[driver.status],
          ]
            .filter(Boolean)
            .join(" ")
        }
        toolbar={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IdCard className="h-4 w-4" />
            CNHs monitoradas
          </div>
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar motorista" : "Novo motorista"}</DialogTitle>
            <DialogDescription>
              Cadastro com controle de CNH e situação operacional.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="fleet-driver-name">Nome</Label>
                  <Input
                    id="fleet-driver-name"
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                    value={draft.name}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-driver-cpf">CPF</Label>
                  <MaskedInput
                    id="fleet-driver-cpf"
                    mask="cpf"
                    onChange={(event) => setDraft({ ...draft, cpf: event.target.value })}
                    value={draft.cpf}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="fleet-driver-phone">Telefone</Label>
                  <MaskedInput
                    id="fleet-driver-phone"
                    mask="phone"
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                    value={draft.phone}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-driver-email">E-mail</Label>
                  <Input
                    id="fleet-driver-email"
                    onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                    type="email"
                    value={draft.email}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField>
                  <Label htmlFor="fleet-driver-license">Número da CNH</Label>
                  <Input
                    id="fleet-driver-license"
                    onChange={(event) => setDraft({ ...draft, licenseNumber: event.target.value })}
                    value={draft.licenseNumber}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-driver-category">Categoria</Label>
                  <Input
                    id="fleet-driver-category"
                    onChange={(event) => setDraft({ ...draft, licenseCategory: event.target.value.toUpperCase() })}
                    value={draft.licenseCategory}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-driver-status">Situação</Label>
                  <Select
                    id="fleet-driver-status"
                    onChange={(event) => setDraft({ ...draft, status: event.target.value as FleetDriverStatus })}
                    value={draft.status}
                  >
                    {Object.entries(driverStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="fleet-driver-issued">Emissão</Label>
                  <Input
                    id="fleet-driver-issued"
                    onChange={(event) => setDraft({ ...draft, licenseIssuedAt: event.target.value })}
                    type="date"
                    value={draft.licenseIssuedAt}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-driver-expires">Vencimento</Label>
                  <Input
                    id="fleet-driver-expires"
                    onChange={(event) => setDraft({ ...draft, licenseExpiresAt: event.target.value })}
                    type="date"
                    value={draft.licenseExpiresAt}
                  />
                </FormField>
              </div>
              <FormField>
                <Label htmlFor="fleet-driver-license-status">Status da CNH</Label>
                <Input
                  id="fleet-driver-license-status"
                  onChange={(event) => setDraft({ ...draft, licenseStatus: event.target.value })}
                  placeholder="Ex.: regular, suspensa, renovando"
                  value={draft.licenseStatus}
                />
              </FormField>
              <FormField>
                <Label htmlFor="fleet-driver-notes">Observações</Label>
                <Textarea
                  id="fleet-driver-notes"
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  value={draft.notes}
                />
              </FormField>
              <Button type="submit">Salvar motorista</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
