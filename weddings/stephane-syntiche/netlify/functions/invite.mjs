// A guest's own invitation: open it, and answer it.
//
// The only credential is the signed link (CODE.SIG). It identifies exactly one
// invitation and returns only that invitation's fields — never another guest,
// never the list, never admin notes. Unknown and forged tokens get the same
// answer, so the endpoint cannot be used to discover which codes exist.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit, clamp,
  dbConfigured, db, verifyInvite, loadContent, rsvpClosed, newCode,
} from "./_lib.mjs";

const OPEN_RATE = new SlidingWindow({ windowMs: 60_000, max: 30 });
const RSVP_RATE = new SlidingWindow({ windowMs: 3_600_000, max: 20 });
const ONLINE_GROUP = "Online RSVP";
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/**
 * An RSVP from the open form — no personal link. The reply is filed as an
 * invitation in the "Online RSVP" group so the dashboard counts it like any
 * other. One reply per email address: answering again with the same email
 * updates the earlier reply instead of adding a second party.
 */
async function openReply(req, body, ip) {
  const content = await loadContent();
  if (content.rsvp?.enabled === false || content.rsvp?.open === false) return json(409, { error: "rsvp_disabled" });
  if (rsvpClosed(content)) return json(409, { error: "rsvp_closed" });

  // Silent bot filter: a honeypot and a minimum time on the form.
  const trapped = typeof body.website === "string" && body.website.trim() !== "";
  const tooFast = Number.isFinite(Number(body.elapsed)) && Number(body.elapsed) < 3000;
  if (trapped || tooFast) { audit("invite.open_bot_filtered", { ip }); return json(200, { ok: true, status: "attending" }); }

  const name = clamp(body.name, 120);
  const couple = body.party === "couple";
  const partner = couple ? clamp(body.partner, 120) : "";
  const email = clamp(body.email, 160).toLowerCase();
  if (!name) return json(400, { error: "name_required" });
  if (couple && !partner) return json(400, { error: "partner_required" });
  if (!looksLikeEmail(email)) return json(400, { error: "email_invalid" });
  if (typeof body.attending !== "boolean") return json(400, { error: "attending_required" });

  const names = couple ? [name, partner] : [name];
  const now = new Date().toISOString();
  const row = {
    label: names.join(" & "),
    greeting: name.split(/\s+/)[0],
    kind: couple ? "couple" : "individual",
    party: names,
    max_guests: names.length,
    lang: body.lang === "en" ? "en" : "fr",
    group_name: ONLINE_GROUP,
    email,
    rsvp_status: body.attending ? "attending" : "declined",
    rsvp_seats: body.attending ? names.length : 0,
    rsvp_attendees: body.attending ? names.map((n) => ({ name: n, meal: null, dietary: null })) : [],
    rsvp_message: clamp(body.message, 1000) || null,
    rsvp_at: now,
    opened_at: now,
    updated_at: now,
  };
  try {
    const existing = (await db.select("wed_invitations", `group_name=eq.${encodeURIComponent(ONLINE_GROUP)}&email=eq.${encodeURIComponent(email)}&select=id,rsvp_status&limit=1`))?.[0];
    if (existing && content.rsvp?.allow_update === false) return json(409, { error: "rsvp_locked" });
    if (existing) await db.update("wed_invitations", `id=eq.${existing.id}`, row);
    else await db.insert("wed_invitations", { ...row, code: newCode() });
    audit("invite.open_rsvp", { ip, status: row.rsvp_status, seats: row.rsvp_seats, updated: Boolean(existing) });
    return json(200, { ok: true, status: row.rsvp_status, seats: row.rsvp_seats, names, updated: Boolean(existing) });
  } catch {
    return json(503, { error: "unavailable" });
  }
}

/** The guest-visible projection of an invitation row. */
export function guestView(row) {
  return {
    label: row.label,
    greeting: row.greeting || null,
    kind: row.kind,
    party: Array.isArray(row.party) ? row.party : [],
    max_guests: row.max_guests,
    lang: row.lang,
    personal_message: row.personal_message || null,
    rsvp: {
      status: row.rsvp_status,
      seats: row.rsvp_seats,
      attendees: Array.isArray(row.rsvp_attendees) ? row.rsvp_attendees : [],
      message: row.rsvp_message || "",
      at: row.rsvp_at,
    },
  };
}

async function findByCode(code) {
  const rows = await db.select("wed_invitations", `code=eq.${code}&select=*&limit=1`);
  return rows?.[0] || null;
}

export default async (req) => {
  const ip = clientIp(req);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (originRejected(req)) { audit("invite.origin_rejected", { ip }); return json(403, { error: "forbidden" }); }
  if (!dbConfigured()) return json(501, { error: "not_configured" });

  const parsed = await readJson(req, 16 * 1024);
  if (parsed.tooLarge) return json(413, { error: "too_large" });
  if (parsed.invalid) return json(400, { error: "invalid_json" });
  const body = parsed.value || {};

  const limiter = body.action === "rsvp" || body.action === "reply" ? RSVP_RATE : OPEN_RATE;
  const wait = limiter.check(ip);
  if (wait) return json(429, { error: "rate_limited" }, { "retry-after": String(wait) });

  if (body.action === "reply") return openReply(req, body, ip);

  const code = verifyInvite(body.token);
  if (!code) { audit("invite.bad_token", { ip }); return json(404, { error: "invitation_not_found" }); }

  let row;
  try { row = await findByCode(code); } catch { return json(503, { error: "unavailable" }); }
  if (!row) return json(404, { error: "invitation_not_found" });

  if (body.action === "open") {
    if (!row.opened_at) {
      try { await db.update("wed_invitations", `id=eq.${row.id}`, { opened_at: new Date().toISOString() }); } catch { /* best effort */ }
    }
    return json(200, { invitation: guestView(row) });
  }

  if (body.action === "rsvp") {
    const content = await loadContent();
    if (content.rsvp?.enabled === false) return json(409, { error: "rsvp_disabled" });
    if (rsvpClosed(content)) return json(409, { error: "rsvp_closed" });
    if (row.rsvp_status !== "pending" && content.rsvp?.allow_update === false) return json(409, { error: "rsvp_locked" });

    const attending = body.attending === true;
    const meals = (content.rsvp?.meals || []).map((m) => m.id).filter(Boolean);
    let attendees = [];
    if (attending) {
      if (!Array.isArray(body.attendees) || body.attendees.length < 1) return json(400, { error: "attendees_required" });
      // Unauthorised additions are refused, not truncated: the guest must see it.
      if (body.attendees.length > row.max_guests) return json(400, { error: "too_many_guests", max: row.max_guests });
      for (const a of body.attendees) {
        const name = clamp(a?.name, 120);
        if (!name) return json(400, { error: "attendee_name_required" });
        const meal = clamp(a?.meal, 40) || null;
        if (meal && meals.length && !meals.includes(meal)) return json(400, { error: "invalid_meal" });
        attendees.push({ name, meal, dietary: clamp(a?.dietary, 200) || null });
      }
    }
    const patch = {
      rsvp_status: attending ? "attending" : "declined",
      rsvp_seats: attendees.length,
      rsvp_attendees: attendees,
      rsvp_message: clamp(body.message, 1000) || null,
      rsvp_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      opened_at: row.opened_at || new Date().toISOString(),
    };
    try {
      const out = await db.update("wed_invitations", `id=eq.${row.id}`, patch);
      audit("invite.rsvp", { ip, status: patch.rsvp_status, seats: patch.rsvp_seats });
      return json(200, { invitation: guestView(out?.[0] || { ...row, ...patch }) });
    } catch {
      return json(503, { error: "unavailable" });
    }
  }

  return json(400, { error: "unknown_action" });
};

export const config = { path: "/api/invite" };
