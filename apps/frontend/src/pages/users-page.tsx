import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
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
import { SearchSelect } from "@/components/ui/search-select";
import { api, useApiResource } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { ManagedUser, UserRole, Warehouse } from "@/lib/types";

type UserDraft = {
  active: boolean;
  email: string;
  id?: string;
  isDefaultAdmin: boolean;
  name: string;
  password: string;
  role: UserRole;
  warehouseIds: string[];
};

function emptyDraft(): UserDraft {
  return {
    active: true,
    email: "",
    isDefaultAdmin: false,
    name: "",
    password: "",
    role: "OPERATOR",
    warehouseIds: [],
  };
}

export function UsersPage() {
  const { session } = useSession();
  const users = useApiResource<ManagedUser[]>("/users", []);
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    const payload = {
      active: draft.isDefaultAdmin ? true : draft.active,
      email: draft.email,
      name: draft.name,
      ...(draft.password ? { password: draft.password } : {}),
      role: draft.isDefaultAdmin ? "ADMIN" : draft.role,
      warehouseIds:
        !draft.isDefaultAdmin && draft.role === "OPERATOR" ? draft.warehouseIds : [],
    };

    try {
      await api<ManagedUser>(draft.id ? `/users/${draft.id}` : "/users", {
        body: JSON.stringify(payload),
        method: draft.id ? "PUT" : "POST",
      });
      setDraft(null);
      setMessage(null);
      await users.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await api<void>(`/users/${id}`, { method: "DELETE" });
      await users.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao remover.");
    }
  }

  function toggleWarehouse(warehouseId: string) {
    if (!draft) {
      return;
    }

    setDraft({
      ...draft,
      warehouseIds: draft.warehouseIds.includes(warehouseId)
        ? draft.warehouseIds.filter((id) => id !== warehouseId)
        : [...draft.warehouseIds, warehouseId],
    });
  }

  function canRemove(user: ManagedUser) {
    return !user.isDefaultAdmin && user.id !== session?.user.id;
  }

  if (users.loading || warehouses.loading) {
    return <LoadingLine />;
  }

  if (users.error || warehouses.error) {
    return <ResourceError message={users.error ?? warehouses.error ?? ""} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Acessos</p>
          <h2 className="text-2xl font-semibold">Usuarios</h2>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4" />
          Novo usuario
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (user) => (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{user.name}</p>
                  {user.isDefaultAdmin ? <Badge variant="low">Padrao</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </>
            ),
            header: "Usuario",
            key: "user",
          },
          {
            cell: (user) => (
              <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                {user.role === "ADMIN" ? "Admin" : "Operador"}
              </Badge>
            ),
            header: "Permissao",
            key: "role",
          },
          {
            cell: (user) =>
              user.role === "ADMIN"
                ? "Todos"
                : user.warehouseAssignments
                    .map((assignment) => assignment.warehouse.name)
                    .join(", ") || "-",
            header: "Almoxarifados",
            key: "warehouses",
          },
          {
            cell: (user) => (
              <Badge variant={user.active ? "success" : "zero"}>
                {user.active ? "Ativo" : "Inativo"}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (user) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar ${user.name}`}
                  onClick={() =>
                    setDraft({
                      active: user.active,
                      email: user.email,
                      id: user.id,
                      isDefaultAdmin: user.isDefaultAdmin,
                      name: user.name,
                      password: "",
                      role: user.role,
                      warehouseIds: user.warehouseAssignments.map(
                        (assignment) => assignment.warehouseId,
                      ),
                    })
                  }
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Remover ${user.name}`}
                  disabled={!canRemove(user)}
                  onClick={() => void remove(user.id)}
                  size="icon"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
            cellClassName: "text-right",
            header: "Acoes",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={users.data}
        emptyMessage="Nenhum usuario cadastrado."
        getRowId={(user) => user.id}
        searchPlaceholder="Buscar usuario, email ou almoxarifado..."
        searchText={(user) =>
          [
            user.name,
            user.email,
            user.isDefaultAdmin ? "padrao" : "",
            user.role === "ADMIN" ? "admin" : "operador",
            user.active ? "ativo" : "inativo",
            ...user.warehouseAssignments.map((assignment) => assignment.warehouse.name),
          ].join(" ")
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar usuario" : "Novo usuario"}</DialogTitle>
            <DialogDescription>
              Admin acessa tudo. Operador trabalha apenas nos almoxarifados marcados.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="user-name">Nome</Label>
                  <Input
                    id="user-name"
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                    value={draft.name}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                    required
                    type="email"
                    value={draft.email}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="user-role">Permissao</Label>
                  <SearchSelect
                    ariaLabel="Permissao"
                    disabled={draft.isDefaultAdmin}
                    id="user-role"
                    onValueChange={(role) =>
                      setDraft({ ...draft, role: role as UserRole })
                    }
                    options={[
                      { label: "Admin", value: "ADMIN" },
                      { label: "Operador", value: "OPERATOR" },
                    ]}
                    placeholder="Selecione"
                    value={draft.role}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="user-password">
                    {draft.id ? "Nova senha" : "Senha"}
                  </Label>
                  <Input
                    id="user-password"
                    minLength={6}
                    onChange={(event) =>
                      setDraft({ ...draft, password: event.target.value })
                    }
                    placeholder={draft.id ? "Manter senha atual" : undefined}
                    required={!draft.id}
                    type="password"
                    value={draft.password}
                  />
                </FormField>
              </div>
              {draft.role === "OPERATOR" ? (
                <FormField>
                  <Label>Almoxarifados liberados</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {warehouses.data
                      .filter((warehouse) => !warehouse.isGeneral)
                      .map((warehouse) => (
                        <label
                          className="flex items-center gap-2 rounded-md border p-3 text-sm"
                          key={warehouse.id}
                        >
                          <input
                            checked={draft.warehouseIds.includes(warehouse.id)}
                            onChange={() => toggleWarehouse(warehouse.id)}
                            type="checkbox"
                          />
                          {warehouse.name}
                        </label>
                      ))}
                  </div>
                </FormField>
              ) : (
                <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <UsersRound className="h-4 w-4" />
                  Admin acessa inclusive o almoxarifado geral.
                </div>
              )}
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  checked={draft.active}
                  disabled={draft.isDefaultAdmin}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  type="checkbox"
                />
                Usuario ativo
              </label>
              <Button type="submit">Salvar usuario</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
