// Private dashboard API — STEPHANE & SYNTICHE and their named organisers.
// Every action requires ADMIN_KEY (STAFF_KEY is refused here) and every
// action is audited, successes included: a stolen key must leave a trace.
import {
  json, clientIp, SlidingWindow, originRejected, readJson, audit, clamp, authorize,
  dbConfigured, db, isUuid, newCode, inviteToken, inviteSecretUsable, loadContent, defaults,
} from "./_lib.mjs";

const RATE = new SlidingWindow({ windowMs: 60_000, max: 120 });
const KINDS = new Set(["individual", "couple", "household"]);
const STATUSES = new Set(["pending", "attending", "declined"]);
// Netlify caps a synchronous request at 6 MB; base64 inflates by 4/3. The
// dashboard resizes photos to 2400 px before upload, so this is headroom.
const MAX_UPLOAD = 3.5 * 1024 * 1024;
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };

const siteUrl = (req) =>
  (process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/+$/, "");

/** Admin-supplied guest → a clean row. Unknown fields are dropped. */
function guestRow(g) {
  const party = Array.isArray(g.party) ? g.party.map((n) => clamp(n, 120)).filter(Boolean).slice(0, 20) : [];
  const row = {
    label: clamp(g.label, 160),
    greeting: clamp(g.greeting, 80) || null,
    kind: KINDS.has(g.kind) ? g.kind : "individual",
    party,
    max_guests: Math.min(20, Math.max(1, Math.round(Number(g.max_guests) || party.length || 1))),
    lang: g.lang === "en" ? "en" : "fr",
    group_name: clamp(g.group_name, 80) || null,
    email: clamp(g.email, 160) || null,
    phone: clamp(g.phone, 40) || null,
    notes: clamp(g.notes, 1000) || null,
    personal_message: clamp(g.personal_message, 600) || null,
    table_id: isUuid(g.table_id) ? g.table_id : null,
    updated_at: new Date().toISOString(),
  };
  // An organiser recording a phone or paper RSVP.
  if (STATUSES.has(g.rsvp_status)) {
    row.rsvp_status = g.rsvp_status;
    row.rsvp_seats = g.rsvp_status === "attending" ? Math.min(row.max_guests, Math.max(1, Math.round(Number(g.rsvp_seats) || 1))) : 0;
  }
  if (!row.label) throw Object.assign(new Error("label_required"), { status: 400 });
  return row;
}

function withLink(req, row) {
  const token = inviteSecretUsable() ? inviteToken(row.code) : null;
  return { ...row, token, link: token ? `${siteUrl(req)}/?invite=${token}` : null };
}

async function insertGuests(rows) {
  // Codes are random; a collision is astronomically rare but retried anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.insert("wed_invitations", rows.map((r) => ({ ...r, code: newCode() })));
    } catch (e) {
      if (e.status !== 409 || attempt === 2) throw e;
    }
  }
}

async function stats() {
  const rows = await db.select("wed_invitations", "select=rsvp_status,rsvp_seats,max_guests,sent_at,opened_at,checked_in_count");
  const gb = await db.select("wed_guestbook", "approved=eq.false&select=id");
  const s = { invitations: rows.length, invited_seats: 0, sent: 0, opened: 0, pending: 0, attending: 0, declined: 0, confirmed_seats: 0, checked_in: 0, guestbook_pending: gb.length };
  for (const r of rows) {
    s.invited_seats += r.max_guests;
    if (r.sent_at) s.sent++;
    if (r.opened_at) s.opened++;
    s[r.rsvp_status]++;
    if (r.rsvp_status === "attending") s.confirmed_seats += r.rsvp_seats;
    s.checked_in += r.checked_in_count;
  }
  return s;
}

async function sendEmails(req, ids, content) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { error: "email_not_configured" };
  const rows = await db.select("wed_invitations", `id=in.(${ids.join(",")})&select=*`);
  const results = [];
  for (const row of rows) {
    if (!row.email) { results.push({ id: row.id, ok: false, reason: "no_email" }); continue; }
    const { link } = withLink(req, row);
    const fr = row.lang === "fr";
    const names = `${content.couple.a} & ${content.couple.b}`;
    const when = new Intl.DateTimeFormat(fr ? "fr-FR" : "en-US", { timeZone: "UTC", dateStyle: "long" }).format(new Date(`${content.date}T12:00:00Z`));
    const where = `${content.city}, ${content.region}`;
    const hello = row.greeting || row.label;
    const subject = fr ? `Invitation — mariage de ${names}` : `You are invited — ${names}`;
    const text = fr
      ? `Bonjour ${hello},\n\n${names} ont la joie de vous inviter à célébrer leur mariage le ${when} à ${where}.\n\nVotre invitation personnelle et votre réponse :\n${link}\n\nCe lien vous est personnel — merci de ne pas le partager.`
      : `Dear ${hello},\n\n${names} joyfully invite you to celebrate their wedding on ${when} in ${where}.\n\nYour personal invitation and RSVP:\n${link}\n\nThis link is personal to you — please don't share it.`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [row.email], subject, text }),
      });
      const ok = res.ok;
      // Record only what the provider told us: "accepted", never "delivered".
      await db.update("wed_invitations", `id=eq.${row.id}`, ok
        ? { sent_at: new Date().toISOString(), sent_via: "email", send_status: "accepted_by_provider" }
        : { send_status: `email_failed_${res.status}` });
      results.push({ id: row.id, ok, status: res.status });
    } catch {
      results.push({ id: row.id, ok: false, reason: "network" });
    }
  }
  return { results };
}

const ACTIONS = {
  async stats() { return { stats: await stats() }; },

  async "guests.list"(req) {
    const [rows, tables] = await Promise.all([
      db.select("wed_invitations", "select=*&order=created_at.asc"),
      db.select("wed_tables", "select=*&order=sort.asc,name.asc"),
    ]);
    return { guests: rows.map((r) => withLink(req, r)), tables, links_enabled: inviteSecretUsable() };
  },

  async "guests.save"(req, b) {
    const row = guestRow(b.guest || {});
    if (b.guest?.id) {
      if (!isUuid(b.guest.id)) return { status: 400, error: "bad_id" };
      const out = await db.update("wed_invitations", `id=eq.${b.guest.id}`, row);
      return { guest: out?.[0] ? withLink(req, out[0]) : null };
    }
    const out = await insertGuests([row]);
    return { guest: withLink(req, out[0]) };
  },

  async "guests.import"(req, b) {
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 500) return { status: 400, error: "rows_1_to_500" };
    const rows = b.rows.map(guestRow);
    const out = await insertGuests(rows);
    return { imported: out.length };
  },

  async "guests.delete"(req, b) {
    if (!isUuid(b.id)) return { status: 400, error: "bad_id" };
    await db.remove("wed_invitations", `id=eq.${b.id}`);
    return { ok: true };
  },

  // Manual shares (WhatsApp / SMS / copy link / printed card). We record that
  // the couple SHARED it — not that it was delivered, which we cannot know.
  async "guests.mark"(req, b) {
    const ids = (b.ids || []).filter(isUuid).slice(0, 500);
    if (!ids.length) return { status: 400, error: "ids_required" };
    const via = ["whatsapp", "sms", "email", "link", "print"].includes(b.via) ? b.via : "link";
    await db.update("wed_invitations", `id=in.(${ids.join(",")})`, { sent_at: new Date().toISOString(), sent_via: via, send_status: "shared_manually" });
    return { ok: true };
  },

  async "settings.get"() {
    const rows = await db.select("wed_settings", "key=eq.content&select=value,updated_at");
    return { content: await loadContent(), defaults: defaults(), updated_at: rows?.[0]?.updated_at || null };
  },

  async "settings.save"(req, b) {
    if (!b.content || typeof b.content !== "object" || Array.isArray(b.content)) return { status: 400, error: "content_object_required" };
    if (JSON.stringify(b.content).length > 256 * 1024) return { status: 413, error: "content_too_large" };
    const { _readme, ...value } = b.content;
    await db.upsert("wed_settings", { key: "content", value, updated_at: new Date().toISOString() });
    return { ok: true };
  },

  async "guestbook.list"() {
    return { entries: await db.select("wed_guestbook", "select=*&order=created_at.desc&limit=500") };
  },
  async "guestbook.set"(req, b) {
    if (!isUuid(b.id)) return { status: 400, error: "bad_id" };
    await db.update("wed_guestbook", `id=eq.${b.id}`, { approved: b.approved === true });
    return { ok: true };
  },
  async "guestbook.delete"(req, b) {
    if (!isUuid(b.id)) return { status: 400, error: "bad_id" };
    await db.remove("wed_guestbook", `id=eq.${b.id}`);
    return { ok: true };
  },

  async "tables.save"(req, b) {
    const t = b.table || {};
    const row = { name: clamp(t.name, 60), capacity: Math.min(60, Math.max(1, Math.round(Number(t.capacity) || 8))), sort: Math.round(Number(t.sort) || 0) };
    if (!row.name) return { status: 400, error: "name_required" };
    const out = isUuid(t.id) ? await db.update("wed_tables", `id=eq.${t.id}`, row) : await db.insert("wed_tables", row);
    return { table: out?.[0] };
  },
  async "tables.delete"(req, b) {
    if (!isUuid(b.id)) return { status: 400, error: "bad_id" };
    await db.remove("wed_tables", `id=eq.${b.id}`);
    return { ok: true };
  },

  async "media.upload"(req, b) {
    const ext = IMAGE_TYPES[b.type];
    if (!ext || typeof b.data !== "string") return { status: 400, error: "jpeg_webp_or_png_required" };
    const bytes = Buffer.from(b.data, "base64");
    if (!bytes.length || bytes.length > MAX_UPLOAD) return { status: 413, error: "image_too_large" };
    const name = `${Date.now().toString(36)}-${newCode().toLowerCase()}.${ext}`;
    await db.upload("wedding-media", name, bytes, b.type);
    return { url: db.publicUrl("wedding-media", name) };
  },

  async "email.send"(req, b) {
    const ids = (b.ids || []).filter(isUuid).slice(0, 50);
    if (!ids.length) return { status: 400, error: "ids_required" };
    if (!inviteSecretUsable()) return { status: 501, error: "invite_secret_not_configured" };
    const out = await sendEmails(req, ids, await loadContent());
    return out.error ? { status: 501, ...out } : out;
  },

  async integrations() {
    return {
      database: dbConfigured(),
      invite_links: inviteSecretUsable(),
      email: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
      staff_key: typeof process.env.STAFF_KEY === "string" && process.env.STAFF_KEY.length >= 16,
    };
  },
};

export default async (req) => {
  const ip = clientIp(req);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (originRejected(req)) { audit("admin.origin_rejected", { ip }); return json(403, { error: "forbidden" }); }

  const parsed = await readJson(req, 5.8 * 1024 * 1024);
  if (parsed.tooLarge) return json(413, { error: "too_large" });
  if (parsed.invalid) return json(400, { error: "invalid_json" });
  const body = parsed.value || {};

  const wait = RATE.check(ip);
  if (wait) return json(429, { error: "rate_limited" }, { "retry-after": String(wait) });

  const auth = authorize(req, body.key, "admin");
  if (auth.response) return auth.response;
  if (auth.role !== "admin") { audit("admin.staff_refused", { ip }); return json(403, { error: "forbidden" }); }

  const fn = ACTIONS[body.action];
  if (!fn) return json(400, { error: "unknown_action" });
  if (!dbConfigured() && body.action !== "integrations") return json(501, { error: "database_not_configured" });

  try {
    const out = await fn(req, body);
    const { status = 200, ...rest } = out || {};
    audit("admin.action", { ip, action: body.action, status });
    return json(status, rest);
  } catch (e) {
    audit("admin.action_failed", { ip, action: body.action });
    if (e.status === 400) return json(400, { error: e.message });
    return json(503, { error: "unavailable" });
  }
};

export const config = { path: "/api/admin" };
