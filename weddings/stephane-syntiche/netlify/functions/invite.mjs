// A guest's own invitation: open it, and answer it.
//
// The only credential is the signed link (CODE.SIG). It identifies exactly one
// invitation and returns only that invitation's fields — never another guest,
// never the list, never admin notes. Unknown and forged tokens get the same
// answer, so the endpoint cannot be used to discover which codes exist.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit, clamp,
  dbConfigured, db, verifyInvite, loadContent, rsvpClosed,
} from "./_lib.mjs";

const OPEN_RATE = new SlidingWindow({ windowMs: 60_000, max: 30 });
const RSVP_RATE = new SlidingWindow({ windowMs: 3_600_000, max: 20 });

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

  const limiter = body.action === "rsvp" ? RSVP_RATE : OPEN_RATE;
  const wait = limiter.check(ip);
  if (wait) return json(429, { error: "rate_limited" }, { "retry-after": String(wait) });

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
