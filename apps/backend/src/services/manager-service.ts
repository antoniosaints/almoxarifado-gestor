import {
  ManagerBillingStatus,
  ManagerLicenseStatus,
  type ManagerLicenseType,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AppError } from "../lib/errors.js";

const subscriberInclude = {
  billings: {
    orderBy: { dueDate: "desc" },
  },
  licenses: {
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.ManagerSubscriberInclude;

const licenseInclude = {
  subscriber: true,
} satisfies Prisma.ManagerLicenseInclude;

const billingInclude = {
  license: true,
  subscriber: true,
} satisfies Prisma.ManagerBillingInclude;

type SubscriberInput = {
  active: boolean;
  city: string | null;
  document: string | null;
  email: string;
  name: string;
  notes: string | null;
  phone: string | null;
  state: string | null;
};

type LicenseInput = {
  expiresAt?: Date | null;
  licenseKey?: string | null;
  monthlyValue: number;
  seats: number;
  startsAt: Date;
  subscriberId: string;
  systemKey: string;
  type: ManagerLicenseType;
};

type BillingInput = {
  amount: number;
  description: string | null;
  dueDate: Date;
  licenseId?: string | null;
  paidAt?: Date | null;
  reference: string;
  status: ManagerBillingStatus;
  subscriberId: string;
  systemKey: string;
};

function normalizeSystemKey(value: string) {
  return value.trim();
}

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function licenseStatusLabel(status: ManagerLicenseStatus) {
  const labels = {
    [ManagerLicenseStatus.ACTIVE]: "Ativas",
    [ManagerLicenseStatus.CANCELLED]: "Canceladas",
    [ManagerLicenseStatus.EXPIRED]: "Expiradas",
    [ManagerLicenseStatus.LINKED]: "Vinculadas",
    [ManagerLicenseStatus.PENDING]: "Pendentes",
  };

  return labels[status];
}

function billingStatusLabel(status: ManagerBillingStatus) {
  const labels = {
    [ManagerBillingStatus.CANCELLED]: "Canceladas",
    [ManagerBillingStatus.OPEN]: "Abertas",
    [ManagerBillingStatus.OVERDUE]: "Vencidas",
    [ManagerBillingStatus.PAID]: "Pagas",
  };

  return labels[status];
}

function licenseKeyPrefix(systemKey: string) {
  const prefix = systemKey
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 4);

  return prefix || "SYS";
}

async function generateLicenseKey(prisma: PrismaClient, systemKey: string) {
  const prefix = licenseKeyPrefix(systemKey);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const key = `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const existing = await prisma.managerLicense.findUnique({
      select: { id: true },
      where: { licenseKey: key },
    });

    if (!existing) {
      return key;
    }
  }

  throw new AppError(500, "NÃ£o foi possÃ­vel gerar uma chave de licenÃ§a.");
}

async function assertSubscriberExists(prisma: PrismaClient, subscriberId: string) {
  const subscriber = await prisma.managerSubscriber.findUnique({
    select: { id: true },
    where: { id: subscriberId },
  });

  if (!subscriber) {
    throw new AppError(404, "Assinante nÃ£o encontrado.");
  }
}

async function assertLicenseBelongsToSubscriber(
  prisma: PrismaClient,
  licenseId: string | null | undefined,
  subscriberId: string,
) {
  if (!licenseId) {
    return null;
  }

  const license = await prisma.managerLicense.findUnique({
    where: { id: licenseId },
  });

  if (!license) {
    throw new AppError(404, "LicenÃ§a nÃ£o encontrada.");
  }

  if (license.subscriberId !== subscriberId) {
    throw new AppError(400, "A licenÃ§a nÃ£o pertence ao assinante informado.");
  }

  return license;
}

async function refreshOverdueBillings(prisma: PrismaClient) {
  await prisma.managerBilling.updateMany({
    data: { status: ManagerBillingStatus.OVERDUE },
    where: {
      dueDate: { lt: new Date() },
      status: ManagerBillingStatus.OPEN,
    },
  });
}

export async function listManagerSubscribers(prisma: PrismaClient) {
  return prisma.managerSubscriber.findMany({
    include: subscriberInclude,
    orderBy: { name: "asc" },
  });
}

export async function createManagerSubscriber(
  prisma: PrismaClient,
  input: SubscriberInput,
) {
  return prisma.managerSubscriber.create({
    data: input,
    include: subscriberInclude,
  });
}

export async function updateManagerSubscriber(
  prisma: PrismaClient,
  id: string,
  input: SubscriberInput,
) {
  return prisma.managerSubscriber.update({
    data: input,
    include: subscriberInclude,
    where: { id },
  });
}

export async function deactivateManagerSubscriber(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.managerSubscriber.update({
    data: { active: false },
    include: subscriberInclude,
    where: { id },
  });
}

export async function listManagerLicenses(prisma: PrismaClient) {
  return prisma.managerLicense.findMany({
    include: licenseInclude,
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
  });
}

export async function createManagerLicense(
  prisma: PrismaClient,
  input: LicenseInput,
) {
  await assertSubscriberExists(prisma, input.subscriberId);

  return prisma.managerLicense.create({
    data: {
      expiresAt: input.expiresAt ?? null,
      licenseKey:
        input.licenseKey?.trim() ||
        (await generateLicenseKey(prisma, input.systemKey)),
      monthlyValue: input.monthlyValue,
      seats: input.seats,
      startsAt: input.startsAt,
      status: ManagerLicenseStatus.ACTIVE,
      subscriberId: input.subscriberId,
      systemKey: normalizeSystemKey(input.systemKey),
      type: input.type,
    },
    include: licenseInclude,
  });
}

export async function updateManagerLicense(
  prisma: PrismaClient,
  id: string,
  input: LicenseInput,
) {
  await assertSubscriberExists(prisma, input.subscriberId);

  return prisma.managerLicense.update({
    data: {
      expiresAt: input.expiresAt ?? null,
      licenseKey: input.licenseKey?.trim() || undefined,
      monthlyValue: input.monthlyValue,
      seats: input.seats,
      startsAt: input.startsAt,
      subscriberId: input.subscriberId,
      systemKey: normalizeSystemKey(input.systemKey),
      type: input.type,
    },
    include: licenseInclude,
    where: { id },
  });
}

export async function validateManagerLicense(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.managerLicense.update({
    data: {
      cancelledAt: null,
      cancellationReason: null,
      status: ManagerLicenseStatus.ACTIVE,
      validatedAt: new Date(),
    },
    include: licenseInclude,
    where: { id },
  });
}

export async function linkManagerLicense(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.managerLicense.update({
    data: {
      cancelledAt: null,
      cancellationReason: null,
      linkedAt: new Date(),
      status: ManagerLicenseStatus.LINKED,
    },
    include: licenseInclude,
    where: { id },
  });
}

export async function cancelManagerLicense(
  prisma: PrismaClient,
  id: string,
  reason: string | null,
) {
  return prisma.managerLicense.update({
    data: {
      cancelledAt: new Date(),
      cancellationReason: reason,
      status: ManagerLicenseStatus.CANCELLED,
    },
    include: licenseInclude,
    where: { id },
  });
}

export async function listManagerBillings(prisma: PrismaClient) {
  await refreshOverdueBillings(prisma);

  return prisma.managerBilling.findMany({
    include: billingInclude,
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function createManagerBilling(
  prisma: PrismaClient,
  input: BillingInput,
) {
  await assertSubscriberExists(prisma, input.subscriberId);
  const license = await assertLicenseBelongsToSubscriber(
    prisma,
    input.licenseId,
    input.subscriberId,
  );

  return prisma.managerBilling.create({
    data: {
      amount: input.amount,
      description: input.description,
      dueDate: input.dueDate,
      licenseId: input.licenseId ?? null,
      paidAt:
        input.status === ManagerBillingStatus.PAID
          ? input.paidAt ?? new Date()
          : input.paidAt ?? null,
      reference: input.reference,
      status: input.status,
      subscriberId: input.subscriberId,
      systemKey: normalizeSystemKey(license?.systemKey ?? input.systemKey),
    },
    include: billingInclude,
  });
}

export async function updateManagerBilling(
  prisma: PrismaClient,
  id: string,
  input: BillingInput,
) {
  await assertSubscriberExists(prisma, input.subscriberId);
  const license = await assertLicenseBelongsToSubscriber(
    prisma,
    input.licenseId,
    input.subscriberId,
  );

  return prisma.managerBilling.update({
    data: {
      amount: input.amount,
      description: input.description,
      dueDate: input.dueDate,
      licenseId: input.licenseId ?? null,
      paidAt:
        input.status === ManagerBillingStatus.PAID
          ? input.paidAt ?? new Date()
          : input.paidAt ?? null,
      reference: input.reference,
      status: input.status,
      subscriberId: input.subscriberId,
      systemKey: normalizeSystemKey(license?.systemKey ?? input.systemKey),
    },
    include: billingInclude,
    where: { id },
  });
}

export async function markManagerBillingPaid(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.managerBilling.update({
    data: {
      paidAt: new Date(),
      status: ManagerBillingStatus.PAID,
    },
    include: billingInclude,
    where: { id },
  });
}

export async function cancelManagerBilling(prisma: PrismaClient, id: string) {
  return prisma.managerBilling.update({
    data: {
      status: ManagerBillingStatus.CANCELLED,
    },
    include: billingInclude,
    where: { id },
  });
}

export async function getManagerDashboard(prisma: PrismaClient) {
  await refreshOverdueBillings(prisma);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextThirtyDays = addDays(now, 30);
  const [subscribers, licenses, billings] = await Promise.all([
    prisma.managerSubscriber.findMany(),
    prisma.managerLicense.findMany({
      include: licenseInclude,
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.managerBilling.findMany({
      include: billingInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  const paidBillings = billings.filter(
    (billing) => billing.status === ManagerBillingStatus.PAID,
  );
  const activeLicenses = licenses.filter(
    (license) =>
      (license.status === ManagerLicenseStatus.ACTIVE ||
        license.status === ManagerLicenseStatus.LINKED) &&
      (!license.expiresAt || license.expiresAt >= now),
  );
  const expiredLicenses = licenses.filter(
    (license) =>
      license.status !== ManagerLicenseStatus.CANCELLED &&
      license.expiresAt &&
      license.expiresAt < now,
  );
  const overdueBillings = billings.filter(
    (billing) => billing.status === ManagerBillingStatus.OVERDUE,
  );
  const revenueBySystem = new Map<string, number>();
  const revenueByLicenseType = new Map<string, number>();
  const licenseStatusBreakdown = new Map<string, number>();
  const billingStatusBreakdown = new Map<string, number>();

  for (const license of licenses) {
    const label = licenseStatusLabel(license.status);
    licenseStatusBreakdown.set(label, (licenseStatusBreakdown.get(label) ?? 0) + 1);
  }

  for (const billing of billings) {
    const label = billingStatusLabel(billing.status);
    billingStatusBreakdown.set(label, (billingStatusBreakdown.get(label) ?? 0) + 1);
  }

  for (const billing of paidBillings) {
    revenueBySystem.set(
      billing.systemKey,
      (revenueBySystem.get(billing.systemKey) ?? 0) + money(billing.amount),
    );
    revenueByLicenseType.set(
      billing.license?.type ?? "Sem licenÃ§a",
      (revenueByLicenseType.get(billing.license?.type ?? "Sem licenÃ§a") ?? 0) +
        money(billing.amount),
    );
  }

  const monthlyRevenue = new Map<string, { name: string; value: number }>();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    monthlyRevenue.set(monthKey(date), {
      name: monthLabel(date),
      value: 0,
    });
  }

  for (const billing of paidBillings) {
    if (!billing.paidAt) {
      continue;
    }

    const key = monthKey(new Date(billing.paidAt));
    const current = monthlyRevenue.get(key);

    if (current) {
      current.value += money(billing.amount);
    }
  }

  const openBillings = billings.filter(
    (billing) =>
      billing.status === ManagerBillingStatus.OPEN ||
      billing.status === ManagerBillingStatus.OVERDUE,
  );
  const openAmount = openBillings.reduce(
    (total, billing) => total + money(billing.amount),
    0,
  );
  const overdueAmount = overdueBillings.reduce(
    (total, billing) => total + money(billing.amount),
    0,
  );
  const linkedLicenses = licenses.filter(
    (license) => license.status === ManagerLicenseStatus.LINKED,
  );
  const upcomingExpirations = licenses
    .filter(
      (license) =>
        license.status !== ManagerLicenseStatus.CANCELLED &&
        license.expiresAt &&
        license.expiresAt >= now &&
        license.expiresAt <= nextThirtyDays,
    )
    .slice(0, 10);

  return {
    billingStatusBreakdown: [...billingStatusBreakdown.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value),
    licenseStatusBreakdown: [...licenseStatusBreakdown.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value),
    monthlyRevenueTrend: [...monthlyRevenue.values()],
    overdueBillings: overdueBillings.slice(0, 8),
    revenueByLicenseType: [...revenueByLicenseType.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value),
    revenueBySystem: [...revenueBySystem.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value),
    totals: {
      activeLicenses: activeLicenses.length,
      activeSubscribers: subscribers.filter((subscriber) => subscriber.active).length,
      averageTicket: activeLicenses.length
        ? activeLicenses.reduce(
            (total, license) => total + money(license.monthlyValue),
            0,
          ) / activeLicenses.length
        : 0,
      cancelledLicenses: licenses.filter(
        (license) => license.status === ManagerLicenseStatus.CANCELLED,
      ).length,
      currentMonthRevenue: paidBillings
        .filter((billing) => billing.paidAt && billing.paidAt >= monthStart)
        .reduce((total, billing) => total + money(billing.amount), 0),
      expiredLicenses: expiredLicenses.length,
      expiringLicenses: upcomingExpirations.length,
      linkedLicenses: linkedLicenses.length,
      monthlyRecurring: activeLicenses.reduce(
        (total, license) => total + money(license.monthlyValue),
        0,
      ),
      openAmount,
      openBillings: openBillings.length,
      overdueAmount,
      overdueBillings: overdueBillings.length,
      pendingLicenses: licenses.filter(
        (license) => license.status === ManagerLicenseStatus.PENDING,
      ).length,
      totalRevenue: paidBillings.reduce(
        (total, billing) => total + money(billing.amount),
        0,
      ),
      totalLicenses: licenses.length,
      totalSubscribers: subscribers.length,
    },
    upcomingExpirations,
  };
}
