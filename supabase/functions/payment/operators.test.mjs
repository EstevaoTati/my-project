/**
 * Tests for operators.ts — the payment function's operator adapters — run by
 * Node directly on the TypeScript source, against a fake MTN and Airtel:
 *
 *   node --experimental-strip-types supabase/functions/payment/operators.test.mjs
 */
import { configured, msisdn, OperatorError, readStatus, requestToPay } from "./operators.ts";

let pass = 0;
const fails = [];
const check = async (label, fn) => {
  try {
    if (!(await fn())) throw new Error("falsy");
    console.log("  ✓ " + label);
    pass++;
  } catch (e) {
    console.log("  ✗ " + label + " — " + e.message);
    fails.push(label);
  }
};

const MTN = { MTN_MOMO_SUBSCRIPTION_KEY: "sub", MTN_MOMO_API_USER: "user", MTN_MOMO_API_KEY: "key" };
const AIRTEL = { AIRTEL_CLIENT_ID: "cid", AIRTEL_CLIENT_SECRET: "secret" };
const envOf = (vars) => (k) => vars[k];

/** A fake operator: records every call, answers from `routes` by "METHOD path". */
function operator(routes) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const key = `${init.method ?? "GET"} ${pathname}`;
    calls.push({ key, headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null });
    const route = Object.entries(routes).find(([k]) => key.startsWith(k));
    if (!route) return new Response("{}", { status: 404 });
    const [status, body] = typeof route[1] === "function" ? route[1]() : route[1];
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchFn };
}
const mtnToken = { "POST /collection/token/": [200, { access_token: "T" }] };
const airtelToken = { "POST /auth/oauth2/token": [200, { access_token: "A" }] };
const input = { id: "11111111-2222-4333-8444-555555555555", msisdn: "242061234567", amount: 9000, label: "242Konnect · ABC123" };

console.log("Numbers");
await check("a national MTN number gets the country code", () => msisdn("06 123 45 67") === "242061234567");
await check("an international Airtel number is kept", () => msisdn("+242 05 123 45 67") === "242051234567");
await check("a foreign or short number is refused", () => msisdn("+33612345678") === null && msisdn("0612") === null && msisdn(42) === null);

console.log("Configuration");
await check("with no credentials, neither operator is configured", () => !configured("mtn", envOf({})) && !configured("airtel", envOf({})));
await check("credentials enable only their operator", () => configured("mtn", envOf(MTN)) && !configured("airtel", envOf(MTN)));
await check("an unconfigured operator is refused before any network call", async () => {
  const op = operator({});
  try {
    await requestToPay("mtn", input, envOf({}), op.fetchFn);
    return false;
  } catch (e) {
    return e instanceof OperatorError && op.calls.length === 0;
  }
});

console.log("MTN MoMo");
await check("request to pay sends our id as X-Reference-Id and the exact amount", async () => {
  const op = operator({ ...mtnToken, "POST /collection/v1_0/requesttopay": [202, {}] });
  await requestToPay("mtn", input, envOf(MTN), op.fetchFn);
  const call = op.calls.find((c) => c.key === "POST /collection/v1_0/requesttopay");
  return call.headers["X-Reference-Id"] === input.id && call.body.amount === "9000" && call.body.payer.partyId === "242061234567" && call.body.currency === "XAF";
});
await check("anything but 202 is a refusal", async () => {
  const op = operator({ ...mtnToken, "POST /collection/v1_0/requesttopay": [400, {}] });
  return requestToPay("mtn", input, envOf(MTN), op.fetchFn).then(() => false, (e) => e instanceof OperatorError);
});
await check("SUCCESSFUL reports the operator reference and amount", async () => {
  const op = operator({ ...mtnToken, "GET /collection/v1_0/requesttopay/": [200, { status: "SUCCESSFUL", financialTransactionId: "987654", amount: "9000" }] });
  const o = await readStatus("mtn", input.id, envOf(MTN), op.fetchFn);
  return o.status === "successful" && o.operatorRef === "987654" && o.amount === 9000;
});
await check("a short payment reports the amount actually collected", async () => {
  const op = operator({ ...mtnToken, "GET /collection/v1_0/requesttopay/": [200, { status: "SUCCESSFUL", financialTransactionId: "1", amount: "100" }] });
  return (await readStatus("mtn", input.id, envOf(MTN), op.fetchFn)).amount === 100;
});
await check("FAILED gives the reason in French", async () => {
  const op = operator({ ...mtnToken, "GET /collection/v1_0/requesttopay/": [200, { status: "FAILED", reason: "NOT_ENOUGH_FUNDS" }] });
  const o = await readStatus("mtn", input.id, envOf(MTN), op.fetchFn);
  return o.status === "failed" && /Solde insuffisant/.test(o.reason);
});
await check("an expired prompt reads as expired", async () => {
  const op = operator({ ...mtnToken, "GET /collection/v1_0/requesttopay/": [200, { status: "FAILED", reason: { code: "EXPIRED" } }] });
  return (await readStatus("mtn", input.id, envOf(MTN), op.fetchFn)).status === "expired";
});
await check("an unreadable status stays pending, never failed", async () => {
  const op = operator({ ...mtnToken, "GET /collection/v1_0/requesttopay/": [500, {}] });
  return (await readStatus("mtn", input.id, envOf(MTN), op.fetchFn)).status === "pending";
});
await check("a refused token is an operator error", async () => {
  const op = operator({ "POST /collection/token/": [401, {}] });
  return requestToPay("mtn", input, envOf(MTN), op.fetchFn).then(() => false, (e) => e instanceof OperatorError);
});
await check("a network failure is an operator error, not a crash", async () => {
  const fetchFn = async () => {
    throw new TypeError("network down");
  };
  return requestToPay("mtn", input, envOf(MTN), fetchFn).then(() => false, (e) => e instanceof OperatorError);
});

console.log("Airtel Money");
await check("request to pay sends the national number and our id", async () => {
  const op = operator({ ...airtelToken, "POST /merchant/v1/payments/": [200, { status: { success: true } }] });
  await requestToPay("airtel", { ...input, msisdn: "242051234567" }, envOf(AIRTEL), op.fetchFn);
  const call = op.calls.find((c) => c.key === "POST /merchant/v1/payments/");
  return call.body.subscriber.msisdn === "051234567" && call.body.transaction.id === input.id && call.body.transaction.amount === 9000;
});
await check("success:false is a refusal", async () => {
  const op = operator({ ...airtelToken, "POST /merchant/v1/payments/": [200, { status: { success: false } }] });
  return requestToPay("airtel", input, envOf(AIRTEL), op.fetchFn).then(() => false, (e) => e instanceof OperatorError);
});
await check("TS is success with the Airtel Money id", async () => {
  const op = operator({ ...airtelToken, "GET /standard/v1/payments/": [200, { data: { transaction: { status: "TS", airtel_money_id: "AM42" } } }] });
  const o = await readStatus("airtel", input.id, envOf(AIRTEL), op.fetchFn);
  return o.status === "successful" && o.operatorRef === "AM42" && o.amount === undefined;
});
await check("TF is failed, TE expired, TIP pending", async () => {
  const at = (s) => operator({ ...airtelToken, "GET /standard/v1/payments/": [200, { data: { transaction: { status: s } } }] }).fetchFn;
  const [f, e, p] = await Promise.all(["TF", "TE", "TIP"].map((s) => readStatus("airtel", input.id, envOf(AIRTEL), at(s))));
  return f.status === "failed" && e.status === "expired" && p.status === "pending";
});

console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
