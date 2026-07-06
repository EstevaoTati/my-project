import { Resend } from "resend";

export interface LeadEmailData {
  name: string;
  email: string;
  phone: string | null;
  firmName: string;
  profession: string;
  weeklyInquiries: string;
  averageTicket: number | null;
  preferredLanguage: string;
  message: string | null;
  locale: string;
}

const MAX_RETRIES = 2;

/**
 * Envoie la notification de nouveau lead via Resend, avec retry simple.
 * Sans RESEND_API_KEY, log seulement (le lead reste enregistré en base).
 */
export async function sendLeadNotification(lead: LeadEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_EMAIL;
  const from =
    process.env.LEAD_FROM_EMAIL ?? "Mwinda Digital <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.warn(
      "[email] RESEND_API_KEY ou LEAD_NOTIFICATION_EMAIL absent — notification non envoyée.",
      { lead: lead.email },
    );
    return;
  }

  const resend = new Resend(apiKey);
  const rows: [string, string][] = [
    ["Nom", lead.name],
    ["Email", lead.email],
    ["Téléphone", lead.phone ?? "—"],
    ["Cabinet", lead.firmName],
    ["Métier", lead.profession],
    ["Demandes / semaine", lead.weeklyInquiries],
    ["Panier moyen", lead.averageTicket != null ? `$${lead.averageTicket}` : "—"],
    ["Langue clients", lead.preferredLanguage],
    ["Langue du site", lead.locale],
    ["Message", lead.message ?? "—"],
  ];

  const html = `
    <h2>Nouveau lead — Réserver mon diagnostic</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="border:1px solid #ddd;font-weight:600">${k}</td><td style="border:1px solid #ddd">${v}</td></tr>`,
        )
        .join("")}
    </table>`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from,
        to,
        replyTo: lead.email,
        subject: `[Mwinda] Nouveau lead : ${lead.firmName} (${lead.profession})`,
        html,
      });
      if (error) throw error;
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  // Ne pas faire échouer la requête pour un email : le lead est déjà en base.
  console.error("[email] Échec d'envoi après retries :", lastError);
}
