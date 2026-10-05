/**
 * A local stand-in for the Supabase endpoints 242Konnect calls, for browser
 * tests that need two real users talking through the server.
 *
 * Why it exists: the build environment cannot reach supabase.co, so the
 * marketplace journey — a client paying, a prestataire accepting, the address
 * released, the mission validated — could otherwise only be checked one half
 * at a time. This speaks the same HTTP (GoTrue `/auth/v1`, PostgREST
 * `/rest/v1`, the `pin` function, `rpc/request_action`) and mirrors the rules of
 * `supabase/migrations/20261001010000_marketplace.sql`.
 *
 * It is NOT the proof of those rules — `tools/verify-marketplace.sql` is, run
 * against the real database as three users. This proves the app drives them.
 *
 * Codes are written to OUTBOX the way the API's console mailer does
 * ("… est : 123456"), so the same mailedCode() reader works.
 */
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

function createFakeSupabase({ port = 8990, outbox = "/tmp/242konnect-fake-supabase.log" } = {}) {
  fs.writeFileSync(outbox, "");
  const users = new Map(); // email -> { id, code }
  const pins = new Map(); // uid -> pin
  const profiles = new Map();
  const listings = new Map();
  const requests = new Map();
  const addresses = new Map();
  const messages = [];
  const consents = [];
  let messageId = 0;

  const STAGES = ["accepted", "on_the_way", "arrived", "in_progress", "completed"];
  const now = () => new Date().toISOString();

  const send = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, prefer, x-client-info",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const fail = (res, status, message) => send(res, status, { message, code: String(status) });
  const session = (id) => ({
    access_token: `tok-${id}`,
    refresh_token: `ref-${id}`,
    expires_in: 3600,
    token_type: "bearer",
    user: { id },
  });
  const uidOf = (req) => {
    const m = /^Bearer tok-(.+)$/.exec(req.headers.authorization || "");
    return m ? m[1] : null;
  };
  const eq = (q, key) => {
    const v = q.get(key);
    return v && v.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null;
  };

  function action(uid, p) {
    const r = requests.get(p.p_request);
    if (!r) throw [404, "request not found"];
    const isClient = r.client_id === uid;
    const isProvider = r.provider_id === uid && r.status !== "draft";
    if (!isClient && !isProvider) throw [404, "request not found"];
    const expired = r.status === "sent" && Date.parse(r.response_deadline) < Date.now();
    const a = p.p_action;
    const pl = p.p_payload || {};
    const set = (patch) => Object.assign(r, patch, { updated_at: now() });

    if (isClient && a === "pay") {
      if (r.status === "sent" && r.payment_ref === pl.payment_ref) return r;
      if (r.status !== "draft") throw [400, "this request is already paid"];
      if (!["mtn", "airtel", "carte", "virement"].includes(pl.method)) throw [400, "unknown payment method"];
      set({
        status: "sent",
        payment_method: pl.method,
        payment_ref: pl.payment_ref,
        paid_at: now(),
        response_deadline: new Date(Date.now() + 24 * 3600e3).toISOString(),
      });
    } else if (isClient && a === "cancel") {
      if (r.status === "draft") set({ status: "cancelled", refund_status: "none" });
      else if (["sent", "refused"].includes(r.status)) set({ status: "cancelled", refund_status: "full" });
      else if (r.status === "accepted") set({ status: "cancelled", refund_status: "under_review" });
      else throw [400, "this request can no longer be cancelled"];
    } else if (isClient && a === "validate") {
      if (r.status !== "accepted" || r.stage !== "completed") throw [400, "only a completed mission can be approved"];
      set({ status: "validated", validated_at: now() });
    } else if (isClient && a === "dispute") {
      if (r.status !== "accepted") throw [400, "only an accepted mission can be disputed"];
      set({ status: "disputed", dispute: { reason: pl.reason, outcome: pl.outcome, details: pl.details || "" } });
    } else if (isProvider && a === "accept") {
      if (r.status !== "sent" || expired) throw [400, "this request can no longer be accepted"];
      if (listings.get(uid)?.status !== "approved") throw [400, "your profile is not approved yet"];
      set({ status: "accepted", stage: "accepted", accepted_at: now(), stage_at: { accepted: now() } });
    } else if (isProvider && a === "decline") {
      if (r.status !== "sent") throw [400, "this request can no longer be declined"];
      set({ status: "refused" });
    } else if (isProvider && a === "advance") {
      if (r.status !== "accepted" || r.stage === "completed") throw [400, "nothing to advance"];
      const next = STAGES[STAGES.indexOf(r.stage) + 1];
      set({ stage: next, stage_at: { ...r.stage_at, [next]: now() } });
    } else {
      throw [403, "action not allowed"];
    }
    return r;
  }

  const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") return send(res, 204);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const q = url.searchParams;
      const body = raw ? JSON.parse(raw) : {};
      const uid = uidOf(req);
      const path = url.pathname;
      try {
        // ---- GoTrue
        if (path === "/auth/v1/otp" && req.method === "POST") {
          const email = String(body.email).toLowerCase();
          // GoTrue refuses to create a user when asked not to.
          if (body.create_user === false && !users.has(email))
            return send(res, 422, { error_code: "otp_disabled", msg: "Signups not allowed for otp" });
          const user = users.get(email) || { id: crypto.randomUUID() };
          user.code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
          users.set(email, user);
          fs.appendFileSync(outbox, `Votre code 242Konnect pour ${email} est : ${user.code}\n`);
          return send(res, 200, {});
        }
        if (path === "/auth/v1/verify" && req.method === "POST") {
          const user = users.get(String(body.email).toLowerCase());
          if (!user || user.code !== body.token) return fail(res, 403, "Token has expired or is invalid");
          user.code = null; // single use
          return send(res, 200, session(user.id));
        }
        if (path === "/auth/v1/token" && q.get("grant_type") === "password") {
          const user = users.get(String(body.email || "").toLowerCase());
          if (!user || !user.password || user.password !== body.password)
            return send(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
          return send(res, 200, session(user.id));
        }
        if (path === "/auth/v1/token") {
          const m = /^ref-(.+)$/.exec(body.refresh_token || "");
          return m ? send(res, 200, session(m[1])) : fail(res, 400, "invalid refresh token");
        }
        if (path === "/auth/v1/user" && req.method === "PUT") {
          const user = [...users.values()].find((u) => u.id === uid);
          if (!user) return send(res, 401, { msg: "JWT expected" });
          if (typeof body.password === "string") user.password = body.password;
          return send(res, 200, { id: uid });
        }
        // ---- pin function
        if (path === "/functions/v1/pin") {
          if (!uid) return send(res, 401, { error: "missing_token" });
          if (body.action === "status") return send(res, 200, { hasPin: pins.has(uid), lockedUntil: null });
          if (body.action === "set") {
            if (pins.has(uid) && pins.get(uid) !== body.current) return send(res, 400, { error: "current_pin_incorrect" });
            pins.set(uid, body.pin);
            return send(res, 200, {});
          }
          if (body.action === "verify")
            return pins.get(uid) === body.pin ? send(res, 200, {}) : send(res, 401, { error: "pin_incorrect", attemptsLeft: 4 });
        }
        if (!path.startsWith("/rest/v1/")) return fail(res, 404, "not found");
        if (!uid) return fail(res, 401, "JWT expected");
        const table = path.slice("/rest/v1/".length);

        // ---- profiles / consents
        if (table === "profiles") {
          if (req.method === "POST") {
            profiles.set(uid, { ...body, id: uid, created_at: profiles.get(uid)?.created_at ?? now() });
            return send(res, 201);
          }
          const row = profiles.get(eq(q, "id"));
          return send(res, 200, row && row.id === uid ? [row] : []);
        }
        if (table === "consent_records") {
          if (req.method === "POST") {
            for (const c of [].concat(body)) consents.push({ ...c, user_id: uid, accepted_at: now() });
            return send(res, 201);
          }
          return send(res, 200, consents.filter((c) => c.user_id === uid));
        }
        if (table === "data_requests") return send(res, 201);

        // ---- directory
        if (table === "provider_listings") {
          if (req.method === "POST") {
            if (body.id !== uid) return fail(res, 403, "new row violates row-level security policy");
            const prev = listings.get(uid);
            listings.set(uid, {
              ...prev,
              ...body,
              status: prev?.status ?? "pending",
              refusal_reason: prev?.refusal_reason ?? null,
              updated_at: now(),
            });
            return send(res, 201);
          }
          const id = eq(q, "id");
          const rows = [...listings.values()].filter((l) => !id || l.id === id);
          rows.sort((a, b) => (a.status < b.status ? -1 : 1));
          return send(res, 200, rows);
        }

        // ---- requests
        if (table === "service_requests") {
          if (req.method === "POST") {
            const listing = listings.get(body.provider_id);
            if (body.provider_id === uid) return fail(res, 400, "a prestataire cannot book themselves");
            if (!listing || listing.status !== "approved") return fail(res, 400, "this prestataire cannot be booked yet");
            if (["weeks", "months", "recurring"].includes(body.duration) && !body.contract_accepted_at)
              return fail(res, 400, "a long project needs the signed project contract");
            const row = {
              ...body,
              id: crypto.randomUUID(),
              client_id: uid,
              client_name: profiles.get(uid)?.full_name ?? "",
              trade_id: listing.trade_id,
              status: "draft",
              stage: null,
              stage_at: {},
              refund_status: "none",
              created_at: now(),
            };
            requests.set(row.id, row);
            return send(res, 201, [row]);
          }
          const client = eq(q, "client_id");
          const provider = eq(q, "provider_id");
          const rows = [...requests.values()].filter(
            (r) =>
              (r.client_id === uid || (r.provider_id === uid && r.status !== "draft")) &&
              (!client || r.client_id === client) &&
              (!provider || r.provider_id === provider)
          );
          return send(res, 200, rows.reverse());
        }
        if (table === "service_request_private") {
          if (req.method === "POST") {
            const r = requests.get(body.request_id);
            if (!r || r.client_id !== uid || r.status !== "draft") return fail(res, 403, "rls");
            addresses.set(body.request_id, body.address);
            return send(res, 201);
          }
          const r = requests.get(eq(q, "request_id"));
          const visible =
            r && (r.client_id === uid || (r.provider_id === uid && ["accepted", "validated", "disputed"].includes(r.status)));
          return send(res, 200, visible ? [{ address: addresses.get(r.id) }] : []);
        }
        if (table === "request_messages") {
          if (req.method === "POST") {
            const r = requests.get(body.request_id);
            if (!r || ![r.client_id, r.provider_id].includes(uid) || !["sent", "accepted", "disputed"].includes(r.status))
              return fail(res, 403, "rls");
            messages.push({ id: ++messageId, request_id: r.id, sender_id: uid, body: body.body, created_at: now() });
            return send(res, 201);
          }
          const r = requests.get(eq(q, "request_id"));
          if (!r || r.status === "draft" || ![r.client_id, r.provider_id].includes(uid)) return send(res, 200, []);
          return send(res, 200, messages.filter((m) => m.request_id === r.id));
        }
        if (table === "rpc/request_action") return send(res, 200, action(uid, body));
        return fail(res, 404, `unknown table ${table}`);
      } catch (e) {
        if (Array.isArray(e)) return fail(res, e[0], e[1]);
        return fail(res, 500, String(e));
      }
    });
  });

  return {
    listen: () => new Promise((r) => server.listen(port, "127.0.0.1", r)),
    close: () => server.close(),
    /** What 242Konnect's reviewers would do from the dashboard. */
    approveAll: () => listings.forEach((l) => (l.status = "approved")),
    /** An account from before the password moved to Supabase. */
    forgetServerPassword: (email) => {
      const u = users.get(email);
      if (u) delete u.password;
    },
    serverPassword: (email) => users.get(email)?.password,
    pinOf: (email) => {
      const u = users.get(email);
      return u ? pins.get(u.id) : undefined;
    },
    hasPin: (email) => {
      const u = users.get(email);
      return !!u && pins.has(u.id);
    },
    profiles,
    consents,
    listings,
    requests,
    outbox,
  };
}

module.exports = { createFakeSupabase };
