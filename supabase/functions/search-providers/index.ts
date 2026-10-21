/**
 * search-providers — approved prestataires for the Dify assistant.
 *
 * Called server to server by Dify with a shared key in `x-api-key`
 * (DIFY_SEARCH_TOKEN, a function secret). Returns at most 20 approved
 * listings, public fields only; the response is unchanged from v4.
 *
 * Hardened 2026-10-20 (risk R-06):
 *  - the key is compared in constant time, over SHA-256 digests, so the
 *    response time does not reveal how many leading characters matched;
 *  - a key shorter than 32 characters counts as not configured, so a weak
 *    secret cannot be deployed by mistake;
 *  - bodies over 4 KB are refused before anything is read;
 *  - responses are never cached.
 *
 * Deploy with verify_jwt = false: Dify sends the shared key, not a user JWT.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const MIN_KEY_LENGTH = 32;
const MAX_BODY_BYTES = 4096;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/** Equal-length digests, compared without an early exit. */
async function sameKey(supplied: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(supplied), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") return reply({ error: "Méthode non autorisée" }, 405);

    const length = Number(req.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) return reply({ error: "Requête trop volumineuse" }, 413);

    const expected = Deno.env.get("DIFY_SEARCH_TOKEN") ?? "";
    if (expected.length < MIN_KEY_LENGTH) return reply({ error: "Service non configuré" }, 503);
    const supplied = req.headers.get("x-api-key") ?? "";
    if (!(await sameKey(supplied, expected))) return reply({ error: "Non autorisé" }, 401);

    const { data, error } = await ctx.supabaseAdmin
      .from("provider_listings")
      .select("full_name,avatar_url,trade_id,zone,city,bio")
      .eq("status", "approved")
      .limit(20);

    if (error) return reply({ error: "La recherche a échoué" }, 500);
    return reply({ providers: data ?? [] });
  }),
};
