"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  getSession,
  isAdminCode,
} from "@/lib/auth";
import { generateMonthlyReport } from "@/lib/reports";

/** Préfixe de chemin selon la locale (localePrefix: "as-needed", fr par défaut). */
function localePath(locale: string, path: string): string {
  return locale === "fr" ? path : `/${locale}${path}`;
}

// ─── Connexion / déconnexion ────────────────────────────────

export interface LoginState {
  error?: "invalid" | "unconfigured";
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  const locale = String(formData.get("locale") ?? "fr");
  if (!code) return { error: "invalid" };
  if (!process.env.AUTH_SECRET) return { error: "unconfigured" };

  if (isAdminCode(code)) {
    await createSession({ role: "admin" });
    redirect(localePath(locale, "/admin"));
  }

  const prisma = getPrisma();
  if (prisma) {
    const org = await prisma.organization.findUnique({
      where: { dashboardToken: code },
      select: { id: true, active: true },
    });
    if (org?.active) {
      await createSession({ role: "client", organizationId: org.id });
      redirect(localePath(locale, "/dashboard"));
    }
  }
  return { error: "invalid" };
}

export async function logout(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "fr");
  await destroySession();
  redirect(localePath(locale, "/connexion"));
}

// ─── Garde-fous d'autorisation des actions ──────────────────

async function requireClient(): Promise<{ organizationId: string }> {
  const session = await getSession();
  if (!session || (session.role === "client" && !session.organizationId)) {
    throw new Error("unauthorized");
  }
  if (session.role === "admin") {
    // L'admin peut agir sur toute organisation via les pages admin dédiées ;
    // les actions client exigent un orgId explicite en session.
    throw new Error("unauthorized");
  }
  const organizationId = session.organizationId!;
  // Révocation immédiate : une organisation désactivée ne peut plus agir,
  // même si le cookie de session signé n'a pas encore expiré.
  const prisma = getPrisma();
  if (prisma) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { active: true },
    });
    if (!org?.active) throw new Error("unauthorized");
  }
  return { organizationId };
}

async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (session?.role !== "admin") throw new Error("unauthorized");
}

// ─── Dashboard client : validation des brouillons ───────────

export async function reviewDraft(formData: FormData): Promise<void> {
  const { organizationId } = await requireClient();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const id = String(formData.get("messageId") ?? "");
  const action = String(formData.get("action") ?? "");
  const edited = String(formData.get("editedContent") ?? "").trim();

  const draft = await prisma.message.findFirst({
    where: {
      id,
      status: "DRAFT",
      role: "AGENT",
      conversation: { organizationId },
    },
  });
  if (!draft) throw new Error("draft_not_found");

  if (action === "approve") {
    await prisma.message.update({
      where: { id },
      data: {
        status: "APPROVED",
        ...(edited && edited !== draft.content ? { content: edited } : {}),
      },
    });
  } else if (action === "reject") {
    await prisma.message.update({ where: { id }, data: { status: "REJECTED" } });
  }
  revalidatePath("/", "layout");
}

/** « Reprendre la main » : l'humain répond lui-même et prend le relais. */
export async function takeOver(formData: FormData): Promise<void> {
  const { organizationId } = await requireClient();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
  });
  if (!conversation) throw new Error("conversation_not_found");

  if (content) {
    await prisma.message.create({
      data: { conversationId, role: "HUMAN", content, status: "SENT" },
    });
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "ESCALATED" },
  });
  revalidatePath("/", "layout");
}

export async function closeConversation(formData: FormData): Promise<void> {
  const { organizationId } = await requireClient();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  const conversationId = String(formData.get("conversationId") ?? "");
  await prisma.conversation.updateMany({
    where: { id: conversationId, organizationId },
    data: { status: "CLOSED" },
  });
  revalidatePath("/", "layout");
}

// ─── Dashboard client : paramètres ──────────────────────────

const settingsSchema = z.object({
  tone: z.enum(["PROFESSIONAL", "FORMAL", "CONCISE"]),
  languages: z.enum(["FR", "EN", "BOTH"]),
  draftMode: z.boolean(),
  averageTicket: z.number().int().min(0).max(1_000_000).nullable(),
  customRules: z.string().max(4000).nullable(),
  businessHours: z.string().max(500).nullable(),
  calendarUrl: z.string().url().max(500).nullable().or(z.literal("").transform(() => null)),
});

export async function updateSettings(formData: FormData): Promise<void> {
  const { organizationId } = await requireClient();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const parsed = settingsSchema.parse({
    tone: formData.get("tone"),
    languages: formData.get("languages"),
    draftMode: formData.get("draftMode") === "on",
    averageTicket: formData.get("averageTicket")
      ? Number(formData.get("averageTicket"))
      : null,
    customRules: String(formData.get("customRules") ?? "").trim() || null,
    businessHours: String(formData.get("businessHours") ?? "").trim() || null,
    calendarUrl: String(formData.get("calendarUrl") ?? "").trim(),
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      draftMode: parsed.draftMode,
      averageTicket: parsed.averageTicket,
      agentConfig: {
        update: {
          tone: parsed.tone,
          languages: parsed.languages,
          customRules: parsed.customRules,
          businessHours: parsed.businessHours,
          calendarUrl: parsed.calendarUrl,
        },
      },
    },
  });
  revalidatePath("/", "layout");
}

// ─── Admin : CRUD organisations + onboarding ────────────────

const orgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug: minuscules, chiffres et tirets"),
  contactEmail: z.string().email(),
  profession: z.enum(["TAX", "IMMIGRATION", "INSURANCE"]),
  tone: z.enum(["PROFESSIONAL", "FORMAL", "CONCISE"]),
  languages: z.enum(["FR", "EN", "BOTH"]),
  draftMode: z.boolean(),
  customRules: z.string().max(4000).nullable(),
});

export async function createOrganization(formData: FormData): Promise<void> {
  await requireAdmin();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const locale = String(formData.get("locale") ?? "fr");
  const parsed = orgSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    contactEmail: formData.get("contactEmail"),
    profession: formData.get("profession"),
    tone: formData.get("tone"),
    languages: formData.get("languages"),
    draftMode: formData.get("draftMode") === "on",
    customRules: String(formData.get("customRules") ?? "").trim() || null,
  });

  const org = await prisma.organization.create({
    data: {
      name: parsed.name,
      slug: parsed.slug,
      contactEmail: parsed.contactEmail,
      draftMode: parsed.draftMode,
      agentConfig: {
        create: {
          profession: parsed.profession,
          tone: parsed.tone,
          languages: parsed.languages,
          customRules: parsed.customRules,
        },
      },
    },
  });
  revalidatePath("/", "layout");
  redirect(localePath(locale, `/admin/organisations/${org.id}`));
}

export async function updateOrganization(formData: FormData): Promise<void> {
  await requireAdmin();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");

  const id = String(formData.get("organizationId") ?? "");
  const parsed = orgSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    contactEmail: formData.get("contactEmail"),
    profession: formData.get("profession"),
    tone: formData.get("tone"),
    languages: formData.get("languages"),
    draftMode: formData.get("draftMode") === "on",
    customRules: String(formData.get("customRules") ?? "").trim() || null,
  });

  await prisma.organization.update({
    where: { id },
    data: {
      name: parsed.name,
      slug: parsed.slug,
      contactEmail: parsed.contactEmail,
      draftMode: parsed.draftMode,
      active: formData.get("active") === "on",
      agentConfig: {
        upsert: {
          create: {
            profession: parsed.profession,
            tone: parsed.tone,
            languages: parsed.languages,
            customRules: parsed.customRules,
          },
          update: {
            profession: parsed.profession,
            tone: parsed.tone,
            languages: parsed.languages,
            customRules: parsed.customRules,
          },
        },
      },
    },
  });
  revalidatePath("/", "layout");
}

export async function regenerateDashboardToken(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  const id = String(formData.get("organizationId") ?? "");
  const token = `mw_${crypto.randomUUID().replaceAll("-", "")}`;
  await prisma.organization.update({
    where: { id },
    data: { dashboardToken: token },
  });
  revalidatePath("/", "layout");
}

export async function generateReportNow(formData: FormData): Promise<void> {
  await requireAdmin();
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  const organizationId = String(formData.get("organizationId") ?? "");
  const now = new Date();
  // Rapport du mois écoulé
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  await generateMonthlyReport(
    prisma,
    organizationId,
    target.getFullYear(),
    target.getMonth() + 1,
  );
  revalidatePath("/", "layout");
}
