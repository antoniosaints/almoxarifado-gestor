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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import { permissionDefinitions } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import type {
  AppPermission,
  ManagedUser,
  PermissionProfile,
  UserRole,
  Warehouse,
} from "@/lib/types";

type UserDraft = {
  active: boolean;
  email: string;
  id?: string;
  isDefaultAdmin: boolean;
  name: string;
  password: string;
  permissionProfileId: string;
  role: UserRole;
  warehouseIds: string[];
};

type ProfileDraft = {
  active: boolean;
  description: string;
  id?: string;
  name: string;
  permissions: AppPermission[];
};

function emptyDraft(profileId = ""): UserDraft {
  return {
    active: true,
    email: "",
    isDefaultAdmin: false,
    name: "",
    password: "",
    permissionProfileId: profileId,
    role: "OPERATOR",
    warehouseIds: [],
  };
}

function emptyProfileDraft(): ProfileDraft {
  return {
    active: true,
    description: "",
    name: "",
    permissions: [],
  };
}

function profilePermissionKeys(profile?: PermissionProfile | null) {
  return profile?.permissions.map((permission) => permission.key) ?? [];
}

function permissionLabel(permission: AppPermission) {
  return (
    permissionDefinitions.find((definition) => definition.key === permission)?.label ??
    permission
  );
}

function PermissionBadges({ permissions }: { permissions: AppPermission[] }) {
  if (!permissions.length) {
    return <span className="text-muted-foreground">Sem permissoes administrativas</span>;
  }

  return (
    <div className="flex max-w-xl flex-wrap gap-1">
      {permissions.map((permission) => (
        <Badge key={permission} variant="outline">
          {permissionLabel(permission)}
        </Badge>
      ))}
    </div>
  );
}

function PermissionProfilesPanel({
  onReload,
  profiles,
}: {
  onReload: () => Promise<void>;
  profiles: PermissionProfile[];
}) {
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function togglePermission(permission: AppPermission) {
    if (!draft) {
      return;
    }

    setDraft({
      ...draft,
      permissions: draft.permissions.includes(permission)
        ? draft.permissions.filter((item) => item !== permission)
        : [...draft.permissions, permission],
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    try {
      await api<PermissionProfile>(
        draft.id ? `/permission-profiles/${draft.id}` : "/permission-profiles",
        {
          body: JSON.stringify(draft),
          method: draft.id ? "PUT" : "POST",
        },
      );
      setDraft(null);
      setMessage(null);
      await onReload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await api<void>(`/permission-profiles/${id}`, { method: "DELETE" });
      await onReload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao remover.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Perfis de permissoes</h2>
          <p className="text-sm text-muted-foreground">
            Crie conjuntos reutilizaveis para vincular aos usuarios operadores.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyProfileDraft())}>
          <Plus className="h-4 w-4" />
          Novo perfil
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (profile) => (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{profile.name}</p>
                  <Badge variant={profile.active ? "success" : "zero"}>
                    {profile.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {profile.description ? (
                  <p className="text-xs text-muted-foreground">{profile.description}</p>
                ) : null}
              </>
            ),
            header: "Perfil",
            key: "profile",
          },
          {
            cell: (profile) => (
              <PermissionBadges permissions={profilePermissionKeys(profile)} />
            ),
            header: "Permissoes",
            key: "permissions",
          },
          {
            cell: (profile) => profile.userCount ?? 0,
            header: "Usuarios",
            key: "users",
          },
          {
            cell: (profile) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar ${profile.name}`}
                  onClick={() =>
                    setDraft({
                      active: profile.active,
                      description: profile.description ?? "",
                      id: profile.id,
                      name: profile.name,
                      permissions: profilePermissionKeys(profile),
                    })
                  }
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Remover ${profile.name}`}
                  disabled={Boolean(profile.userCount)}
                  onClick={() => void remove(profile.id)}
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
        data={profiles}
        emptyMessage="Nenhum perfil cadastrado."
        getRowId={(profile) => profile.id}
        searchPlaceholder="Buscar perfil ou permissao..."
        searchText={(profile) =>
          [
            profile.name,
            profile.description,
            profile.active ? "ativo" : "inativo",
            ...profilePermissionKeys(profile).map(permissionLabel),
          ].join(" ")
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar perfil" : "Novo perfil"}</DialogTitle>
            <DialogDescription>
              Marque apenas as acoes que operadores deste perfil poderao executar.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="profile-name">Nome</Label>
                  <Input
                    id="profile-name"
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                    value={draft.name}
                  />
                </FormField>
                <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <input
                    checked={draft.active}
                    onChange={(event) =>
                      setDraft({ ...draft, active: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Perfil ativo
                </label>
              </div>
              <FormField>
                <Label htmlFor="profile-description">Descricao</Label>
                <Textarea
                  id="profile-description"
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
                />
              </FormField>
              <div className="grid gap-3 md:grid-cols-2">
                {permissionDefinitions.map((permission) => (
                  <label
                    className="flex min-h-24 items-start gap-3 rounded-md border p-3 text-sm"
                    key={permission.key}
                  >
                    <input
                      checked={draft.permissions.includes(permission.key)}
                      className="mt-1"
                      onChange={() => togglePermission(permission.key)}
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-medium">{permission.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <Button type="submit">Salvar perfil</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function UsersPage() {
  const { session } = useSession();
  const users = useApiResource<ManagedUser[]>("/users", []);
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const profiles = useApiResource<PermissionProfile[]>("/permission-profiles", []);
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canCreateAdmins = session?.user.role === "ADMIN";

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
      permissionProfileId:
        !draft.isDefaultAdmin && draft.role === "OPERATOR"
          ? draft.permissionProfileId || null
          : null,
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

  if (users.loading || warehouses.loading || profiles.loading) {
    return <LoadingLine />;
  }

  if (users.error || warehouses.error || profiles.error) {
    return (
      <ResourceError
        message={users.error ?? warehouses.error ?? profiles.error ?? ""}
      />
    );
  }

  const activeProfileOptions = profiles.data
    .filter((profile) => profile.active)
    .map((profile) => ({
      label: profile.name,
      searchText: `${profile.description ?? ""} ${profilePermissionKeys(profile)
        .map(permissionLabel)
        .join(" ")}`,
      value: profile.id,
    }));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Acessos</p>
          <h2 className="text-2xl font-semibold">Usuarios e permissoes</h2>
        </div>
        <Button onClick={() => setDraft(emptyDraft(activeProfileOptions[0]?.value))}>
          <Plus className="h-4 w-4" />
          Novo usuario
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="profiles">Perfis</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
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
                header: "Tipo",
                key: "role",
              },
              {
                cell: (user) =>
                  user.role === "ADMIN" ? (
                    "Acesso total"
                  ) : (
                    <div>
                      <p>{user.permissionProfile?.name ?? "Perfil padrao"}</p>
                      <PermissionBadges permissions={user.permissions ?? []} />
                    </div>
                  ),
                header: "Perfil",
                key: "profile",
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
                      disabled={!canCreateAdmins && user.role === "ADMIN"}
                      onClick={() =>
                        setDraft({
                          active: user.active,
                          email: user.email,
                          id: user.id,
                          isDefaultAdmin: user.isDefaultAdmin,
                          name: user.name,
                          password: "",
                          permissionProfileId: user.permissionProfileId ?? "",
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
                      disabled={!canRemove(user) || (!canCreateAdmins && user.role === "ADMIN")}
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
            searchPlaceholder="Buscar usuario, email, perfil ou almoxarifado..."
            searchText={(user) =>
              [
                user.name,
                user.email,
                user.isDefaultAdmin ? "padrao" : "",
                user.role === "ADMIN" ? "admin" : "operador",
                user.permissionProfile?.name,
                ...(user.permissions ?? []).map(permissionLabel),
                user.active ? "ativo" : "inativo",
                ...user.warehouseAssignments.map((assignment) => assignment.warehouse.name),
              ].join(" ")
            }
          />
        </TabsContent>
        <TabsContent value="profiles">
          <PermissionProfilesPanel onReload={profiles.reload} profiles={profiles.data} />
        </TabsContent>
      </Tabs>

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar usuario" : "Novo usuario"}</DialogTitle>
            <DialogDescription>
              Admin acessa tudo. Operador usa o perfil de permissoes vinculado.
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
                  <Label htmlFor="user-email">E-mail</Label>
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
                  <Label htmlFor="user-role">Tipo</Label>
                  <SearchSelect
                    ariaLabel="Tipo"
                    disabled={draft.isDefaultAdmin}
                    id="user-role"
                    onValueChange={(role) =>
                      setDraft({
                        ...draft,
                        permissionProfileId:
                          role === "OPERATOR"
                            ? draft.permissionProfileId || activeProfileOptions[0]?.value || ""
                            : "",
                        role: role as UserRole,
                        warehouseIds: role === "OPERATOR" ? draft.warehouseIds : [],
                      })
                    }
                    options={[
                      ...(canCreateAdmins ? [{ label: "Admin", value: "ADMIN" }] : []),
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
                <>
                  <FormField>
                    <Label htmlFor="user-permission-profile">Perfil de permissoes</Label>
                    <SearchSelect
                      ariaLabel="Perfil de permissoes"
                      disabled={draft.isDefaultAdmin}
                      id="user-permission-profile"
                      onValueChange={(permissionProfileId) =>
                        setDraft({ ...draft, permissionProfileId })
                      }
                      options={activeProfileOptions}
                      placeholder="Selecione"
                      value={draft.permissionProfileId}
                    />
                  </FormField>
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
                </>
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
