// Words from the heart. Anyone may write; nothing is published until the
// couple approves it from the dashboard. Only name, message and date of
// APPROVED entries are ever returned publicly.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit, clamp,
  dbConfigured, db, verifyInvite,
} from "./_lib.mjs";

// Generous on purpose: on the day, a whole reception shares one venue Wi-Fi IP.
// Spam is stopped by the honeypot, the link ban and moderation, not by this.
const RATE = new SlidingWindow({ windowMs: 3_600_000, max: 40 });
const LINKS = /(https?:\/\/|www\.)/i;

export default async (req) => {
  const ip = clientIp(req);
  if (!dbConfigured()) return json(req.method === "GET" ? 200 : 501, req.method === "GET" ? { entries: [] } : { error: "not_configured" });

  if (req.method === "GET") {
    try {
      const rows = await db.select("wed_guestbook", "approved=eq.true&select=name,message,created_at&order=created_at.desc&limit=80");
      return json(200, { entries: rows || [] }, { "cache-control": "public, max-age=60" });
    } catch {
      return json(200, { entries: [] });
    }
  }

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (originRejected(req)) { audit("guestbook.origin_rejected", { ip }); return json(403, { error: "forbidden" }); }

  const parsed = await readJson(req, 8 * 1024);
  if (parsed.tooLarge) return json(413, { error: "too_large" });
  if (parsed.invalid) return json(400, { error: "invalid_json" });
  const body = parsed.value || {};

  const wait = RATE.check(ip);
  if (wait) return json(429, { error: "rate_limited" }, { "retry-after": String(wait) });

  // Silent bot filter: a honeypot and a minimum time on the form.
  const trapped = typeof body.website === "string" && body.website.trim() !== "";
  const tooFast = Number.isFinite(Number(body.elapsed)) && Number(body.elapsed) < 3000;
  if (trapped || tooFast) { audit("guestbook.bot_filtered", { ip }); return json(200, { ok: true }); }

  const name = clamp(body.name, 80);
  const message = clamp(body.message, 600);
  if (!name || message.length < 2) return json(400, { error: "name_and_message_required" });
  // Links are the spam payload; a wedding wish does not need one.
  if (LINKS.test(message) || LINKS.test(name)) return json(400, { error: "no_links" });

  let invitation_id = null;
  const code = verifyInvite(body.token);
  if (code) {
    try { invitation_id = (await db.select("wed_invitations", `code=eq.${code}&select=id&limit=1`))?.[0]?.id || null; } catch { /* optional */ }
  }
  try {
    await db.insert("wed_guestbook", { name, message, invitation_id, lang: body.lang === "en" ? "en" : "fr", approved: false });
    audit("guestbook.submitted", { ip, verified: Boolean(invitation_id) });
    return json(200, { ok: true });
  } catch {
    return json(503, { error: "unavailable" });
  }
};

export const config = { path: "/api/guestbook" };
