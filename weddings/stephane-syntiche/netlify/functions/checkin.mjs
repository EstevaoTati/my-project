// Wedding-day door check-in. STAFF_KEY or ADMIN_KEY.
// Staff see one invitation at a time — the one whose QR code they scanned —
// never the guest list. A second check-in is refused with the time of the
// first; only an admin can correct (undo) a check-in.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit, authorize,
  dbConfigured, db, verifyInvite,
} from "./_lib.mjs";

const RATE = new SlidingWindow({ windowMs: 60_000, max: 90 });

function doorView(row, table) {
  return {
    label: row.label,
    party: row.party,
    max_guests: row.max_guests,
    rsvp_status: row.rsvp_status,
    rsvp_seats: row.rsvp_seats,
    attendees: (row.rsvp_attendees || []).map((a) => ({ name: a.name, dietary: a.dietary || null })),
    table: table?.name || null,
    checked_in_at: row.checked_in_at,
    checked_in_count: row.checked_in_count,
  };
}

/** Accepts a bare token, or the full invitation URL a QR code encodes. */
function tokenFrom(input) {
  if (typeof input !== "string") return null;
  const s = input.trim();
  try { return new URL(s).searchParams.get("invite"); } catch { /* not a URL */ }
  // Typed by hand: the code half is case-insensitive, the signature is not.
  const [code, sig] = s.split(".");
  return sig ? `${code.toUpperCase()}.${sig}` : s;
}

export default async (req) => {
  const ip = clientIp(req);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (originRejected(req)) return json(403, { error: "forbidden" });
  if (!dbConfigured()) return json(501, { error: "not_configured" });

  const parsed = await readJson(req, 8 * 1024);
  if (parsed.tooLarge || parsed.invalid) return json(400, { error: "bad_request" });
  const body = parsed.value || {};

  const wait = RATE.check(ip);
  if (wait) return json(429, { error: "rate_limited" }, { "retry-after": String(wait) });

  const auth = authorize(req, body.key, "checkin");
  if (auth.response) return auth.response;

  if (body.action === "stats") {
    const rows = await db.select("wed_invitations", "select=rsvp_status,rsvp_seats,checked_in_count,checked_in_at");
    const expected = rows.filter((r) => r.rsvp_status === "attending").reduce((n, r) => n + r.rsvp_seats, 0);
    const arrived = rows.reduce((n, r) => n + r.checked_in_count, 0);
    return json(200, { expected, arrived, parties_arrived: rows.filter((r) => r.checked_in_at).length });
  }

  const code = verifyInvite(tokenFrom(body.code));
  if (!code) { audit("checkin.bad_code", { ip }); return json(404, { error: "invalid_invitation" }); }

  try {
    const row = (await db.select("wed_invitations", `code=eq.${code}&select=*&limit=1`))?.[0];
    if (!row) return json(404, { error: "invalid_invitation" });
    const table = row.table_id ? (await db.select("wed_tables", `id=eq.${row.table_id}&select=name&limit=1`))?.[0] : null;

    if (body.action === "lookup") return json(200, { guest: doorView(row, table) });

    if (body.action === "checkin") {
      if (row.checked_in_at) return json(409, { error: "already_checked_in", guest: doorView(row, table) });
      const count = Math.min(row.max_guests, Math.max(1, Math.round(Number(body.count) || row.rsvp_seats || 1)));
      // Conditional update: two phones scanning the same card at once cannot
      // both succeed — the second matches no row.
      const out = await db.update("wed_invitations", `id=eq.${row.id}&checked_in_at=is.null`, { checked_in_at: new Date().toISOString(), checked_in_count: count });
      if (!out?.length) return json(409, { error: "already_checked_in", guest: doorView(row, table) });
      audit("checkin.ok", { ip, role: auth.role, count });
      return json(200, { guest: doorView(out[0], table) });
    }

    if (body.action === "undo") {
      if (auth.role !== "admin") return json(403, { error: "admin_only" });
      const out = await db.update("wed_invitations", `id=eq.${row.id}`, { checked_in_at: null, checked_in_count: 0 });
      audit("checkin.undo", { ip });
      return json(200, { guest: doorView(out[0], table) });
    }
    return json(400, { error: "unknown_action" });
  } catch {
    return json(503, { error: "unavailable" });
  }
};

export const config = { path: "/api/checkin" };
