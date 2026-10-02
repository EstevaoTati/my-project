# 242Konnect — the shared marketplace backend

Date: 2026-10-01
Migration: `supabase/migrations/20261001010000_marketplace.sql` (applied live)

## Problem

Every request, mission and message lived on one phone. A prestataire could not
receive what a client sent, so the order cycle in the V1 specifications existed
only as a simulation with "Simuler l'acceptation" buttons.

## Decision

Four Supabase tables and one function:

| Object | Rule it carries |
|---|---|
| `provider_listings` | Directory, readable by signed-in users, no phone/e-mail. `status` (pending / approved / refused) can only be set by 242Konnect: the app has no column privilege on it. Editing a refused listing sends it back to pending. |
| `service_requests` | Inserted by the client as a **draft** only; a trigger overwrites every lifecycle field and refuses a pending prestataire, self-booking, and long projects without the contract. No UPDATE, no DELETE for the app. |
| `service_request_private` | The exact address. The prestataire can read it only once the request is accepted. |
| `request_messages` | Chat per request, both parties only, while it is open. |
| `request_action(id, action, payload)` | The **only** way a request moves. Client: `pay`, `cancel`, `validate`, `dispute`. Prestataire: `accept`, `decline`, `advance`. Each checks the caller and the current state. |

Why a SECURITY DEFINER function rather than UPDATE + RLS: RLS can say *who*
may write a row, not *which transition* is legal. "Only a paid request can be
accepted", "only a completed mission can be approved", "a dispute freezes the
funds" are state-machine rules; putting them in one function makes them hold
against a modified client. The Supabase advisor flags the function as callable
by signed-in users — that is intended; `anon` cannot call it.

## Proof

- `242konnect-app/tools/verify-marketplace.sql` — 25 checks against the live
  database as three real users (client, prestataire, stranger), inside a
  transaction that rolls back. All pass.
- `242konnect-app/tools/verify-marketplace-journey.js` — two browsers, two
  accounts, the whole journey through the real app against a local stand-in
  (`tools/lib/fake-supabase.js`), because supabase.co is unreachable from the
  build environment. 14/14.

## Known limits — be clear about these

1. **Payment is not verified by the server.** `pay` records the method and
   reference the app reports. Before real money moves, `pay` must be removed
   from the client and performed by the API (service role) after the MTN /
   Airtel / card callback confirms the collection.
2. **No realtime.** Screens poll (15 s lists, 5 s chat). Supabase Realtime or
   push notifications are the next step.
3. **Quote-based prestataires cannot be booked yet** — there is no quote flow;
   the listing says so.
4. **Approval is manual** (SQL below). A reviewer console is still to build.
5. The design's catalogue prestataires remain demo records; the real directory
   is the "Prestataires inscrits" section on Accueil.

## Approving a prestataire (242Konnect staff)

Supabase → SQL editor:

```sql
-- see who is waiting
select id, full_name, trade_id, city, created_at from public.provider_listings where status = 'pending';

-- approve
update public.provider_listings set status = 'approved' where id = '<uuid>';

-- refuse, with the reason the prestataire will see
update public.provider_listings set status = 'refused', refusal_reason = 'Pièce d''identité illisible' where id = '<uuid>';
```
