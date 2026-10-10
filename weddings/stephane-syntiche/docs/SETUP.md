# Setup & deployment

About 20 minutes, once. Nothing here needs code changes.

## 1. Database (Supabase)

Use the existing MWINDA Supabase project (tables are prefixed `wed_`) or a
new one.

1. SQL editor → paste `supabase/migrations/0001_wedding.sql` → Run.
   It creates the tables with RLS on and **no policies** (only the server key
   can read them), and a public `wedding-media` storage bucket for photos
   uploaded from the dashboard.
2. Settings → API: copy the **Project URL** and the **service_role** key.
   The service key goes into Netlify only. It never reaches a browser.

## 2. Netlify site

Add a **new site** from this same GitHub repository:

| Setting | Value |
|---|---|
| Base directory | `weddings/stephane-syntiche` |
| Build command | *(empty)* |
| Publish directory | `weddings/stephane-syntiche` |
| Branch | `main` |

The MWINDA company site is not affected: it 404s everything under `/weddings/*`.

## 3. Environment variables (Netlify → Site settings → Environment)

| Variable | Required | What |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_KEY` | yes | service_role key |
| `INVITE_SECRET` | yes | 32+ random characters. Signs every invitation link. **Changing it invalidates every link and QR code already sent.** |
| `ADMIN_KEY` | yes | 16+ characters, ≥ 8 distinct. For the couple and named organisers. |
| `STAFF_KEY` | for the day | 16+ characters. Door staff: check-in only, no guest list. |
| `SITE_URL` | recommended | e.g. `https://stephane-syntiche.com` — used in invitation links. |
| `ALLOWED_ORIGINS` | with a custom domain | e.g. `stephane-syntiche.com,www.stephane-syntiche.com` |
| `RESEND_API_KEY`, `MAIL_FROM` | optional | Automatic invitation emails. `MAIL_FROM` must be on a domain verified in Resend. |

Generate keys with `openssl rand -base64 32`. Store them in a password
manager; they are never in the repository.

## 4. Custom domain (optional)

Netlify → Domain management → add the domain, then set `SITE_URL` and
`ALLOWED_ORIGINS` and redeploy.

## 5. First run

1. Open `/admin`, sign in with `ADMIN_KEY`. The *Setup* list on the
   Overview should be all ✓ (email is optional).
2. **Content** tab: venues, times, deadline, dress code, contacts, story,
   program, FAQ answers, gift links → **Save & publish**.
3. **Guests** tab: add invitations or import a CSV, then share each one by
   WhatsApp / SMS / email / link / printed QR code.

## Messaging — what is and isn't automatic

| Channel | How | What the dashboard records |
|---|---|---|
| WhatsApp, SMS, email app, copy link | Opens the couple's own app with a prefilled personal message | "shared via …" — the couple sent it; delivery is not known |
| Email (Resend) | Sent by the server when configured | "accepted by provider" — only when Resend returns 2xx |
| Printed card | QR code PNG from the dashboard | — |

Scheduled reminders and the official WhatsApp Business API are **not**
built: they need a verified business account and message templates, and
for ~100 households the couple's own WhatsApp is faster and more personal.
The send path in `netlify/functions/admin.mjs` (`sendEmails`) is where a
provider would plug in.

## Payments

None are processed here. Gift links point to the couple's own registry or
fund page (e.g. Zola, Honeyfund, PayPal). Add them in *Content → Gifts*.

## Music

Off by default. Set *Content → Music → Audio file URL* to a track the couple
holds a licence for (upload it to the `wedding-media` bucket). It never
autoplays; guests press the sound button.

## After the wedding

Export the guest list (CSV), then in the Supabase SQL editor:

```sql
select public.wed_purge_guest_data();
```

It clears emails, phone numbers, private notes, dietary details and
unapproved guestbook entries. The site says publicly that this happens.

## Security model, in one paragraph

The browser never holds a database credential. Guests are identified only by
their signed link (`CODE.SIG`, 72-bit HMAC), which returns that one
invitation and nothing else. Forged and unknown links get the same 404.
Admin and staff keys are compared in constant time, locked out after 5
failures, and every privileged action is logged, successes included. All
writes are origin-checked, size-capped and rate-limited. The page runs under
a CSP of `script-src 'self'` with no inline scripts and no CDN.
