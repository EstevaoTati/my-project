// MWINDA DIGITAL — contact lead capture.
//
// Why this exists: the contact form hands off to WhatsApp. Until now, a
// visitor who filled the form and then abandoned that hop — popup blocked, no
// WhatsApp on the device, changed their mind — was lost with no trace. This
// records the lead server-side first, so the handoff becomes a convenience
// rather than the only channel.
//
// Personal data lives here (name, email, message), so: minimal fields, no IP
// stored, and the form states plainly that the details are recorded.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit,
  secretMatches, founderKeyUsable,
} from "./_security.mjs";
import { configured, insert, select, logEvent } from "./_db.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const RATE = new SlidingWindow({ windowMs: 3_600_000, max: 12 }); // 12/hour per IP

const clamp = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export default async (req) => {
  const ip = clientIp(req);

  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  if (originRejected(req)) {
    audit("lead.origin_rejected", { ip });
    return json(403, { error: "forbidden" });
  }
  if (!configured()) return json(501, { error: "storage not configured" });

  const parsed = await readJson(req, MAX_BODY_BYTES);
  if (parsed.tooLarge) return json(413, { error: "message too long" });
  if (parsed.invalid) return json(400, { error: "invalid JSON body" });
  const body = parsed.value || {};

  // Founder-only listing of recent leads.
  if (body.action === "list") {
    if (!founderKeyUsable() || !secretMatches(body.key, process.env.FOUNDER_KEY)) {
      audit("lead.list_denied", { ip });
      return json(403, { error: "forbidden" });
    }
    try {
      const rows = await select("leads", "select=id,created_at,name,email,topic,message,handed_off&order=created_at.desc&limit=50");
      return json(200, { leads: rows || [] });
    } catch {
      return json(503, { error: "storage temporarily unavailable" });
    }
  }

  const wait = RATE.check(ip);
  if (wait) {
    audit("lead.rate_limited", { ip });
    return json(429, { error: "too many submissions — please try again later" }, { "retry-after": String(wait) });
  }

  const name = clamp(body.name, 120);
  const email = clamp(body.email, 200);
  const message = clamp(body.message, 4000);
  const topic = clamp(body.topic, 80);

  if (!name || !email || !message) return json(400, { error: "name, email and message are required" });
  if (!looksLikeEmail(email)) return json(400, { error: "invalid email address" });

  try {
    const rows = await insert("leads", {
      name, email, topic, message,
      source: clamp(body.source, 40) || "website",
      handed_off: body.handedOff === true,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    await logEvent("lead_captured", null, { topic });
    audit("lead.captured", { ip, topic });
    return json(200, { ok: true, id: row?.id });
  } catch (error) {
    console.error("lead function error", error?.message);
    // The WhatsApp handoff still happens client-side, so the visitor is not
    // blocked by a storage failure.
    return json(503, { error: "storage temporarily unavailable" });
  }
};
