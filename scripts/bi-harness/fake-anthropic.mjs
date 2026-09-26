// A stand-in for @anthropic-ai/sdk: streams a schema-shaped tool call built
// from realistic French business prose, at a controllable speed, with
// scriptable failures. Every request is logged for inspection.
import { readFileSync, appendFileSync } from "node:fs";

const HERE = new URL("./", import.meta.url);
const control = () => { try { return JSON.parse(readFileSync(new URL("control.json", HERE), "utf8")); } catch { return {}; } };
const once = globalThis.__fakeOnce || (globalThis.__fakeOnce = new Set());

const SENT = [
  "Le marché kinshasais de la restauration reste largement informel : les commandes passent par WhatsApp et le paiement se fait en espèces ou par M-Pesa, Orange Money et Airtel Money.",
  "Les restaurateurs de Gombe et de Limete perdent jusqu’à 20 % de leurs commandes aux heures de pointe, faute d’un outil qui centralise la prise de commande et la livraison.",
  "L’hypothèse centrale — que les restaurants paieront un abonnement mensuel — doit être vérifiée auprès d’au moins trente établissements avant tout développement lourd.",
  "La concurrence directe est faible, mais les agrégateurs régionaux (catégorie : plateformes de livraison panafricaines) peuvent entrer rapidement sur le marché.",
  "Le coût de l’internet mobile et les coupures d’électricité imposent une application légère, utilisable hors connexion et synchronisée dès que le réseau revient.",
  "Le risque de change entre le franc congolais (CDF) et le dollar américain doit être couvert en facturant en USD et en encaissant en monnaie locale au taux du jour.",
  "Une phase pilote de huit semaines avec dix restaurants partenaires permettra de mesurer le panier moyen, le taux de réachat et le délai de livraison réel.",
  "L’équipe fondatrice combine une expertise en logiciel et une connaissance fine de la restauration locale ; il lui manque encore un profil commercial terrain.",
  "Les livreurs à moto (« wewa ») constituent le maillon logistique le plus efficace, mais leur statut juridique et leur assurance doivent être clarifiés.",
  "À moyen terme, les données de commande ouvrent une seconde source de revenus : prévisions d’approvisionnement et crédit fournisseur adossé à l’historique des ventes…",
];
let seq = 0;
function prose(len) {
  let s = "";
  while (s.length < len) s += (s ? " " : "") + SENT[(seq++) % SENT.length];
  return s;
}
function paragraphs(len) {
  const per = Math.round(len / 3);
  return [prose(per), prose(per), "- Premier point concret à vérifier sur le terrain\n- Deuxième point : ≈ 15 % de marge → objectif réaliste ✓\n- Troisième point, chiffré en USD et en CDF"].join("\n\n");
}
const NUM = { initialInvestment: 25000, pricePerUnit: 45, variableCostPerUnit: 12, customersMonth1: 40,
  monthlyGrowthRate: 0.12, salariesMonthly: 3500, marketingMonthly: 800, technologyMonthly: 400,
  otherOpexMonthly: 600, pessimistic: 0.5, realistic: 1, optimistic: 1.6 };
const TITLES = { "executive-summary": "Résumé exécutif", "company-overview": "Présentation de l’entreprise",
  problem: "Problème", solution: "Solution", "market-analysis": "Analyse du marché", "target-customers": "Clients cibles",
  "competitive-analysis": "Analyse concurrentielle", "value-proposition": "Proposition de valeur",
  "business-model": "Modèle économique", "marketing-strategy": "Stratégie marketing", "sales-strategy": "Stratégie commerciale",
  "operations-plan": "Plan opérationnel", "management-plan": "Équipe et gouvernance", "technology-plan": "Plan technologique",
  "risk-analysis": "Analyse des risques", "implementation-roadmap": "Feuille de route", conclusion: "Conclusion" };

function gen(schema, key, ctx) {
  if (!schema) return null;
  if (schema.enum) return schema.enum[(seq++) % schema.enum.length];
  switch (schema.type) {
    case "number": return NUM[key] ?? 100;
    case "string":
      if (key === "body") return paragraphs(ctx.bodyLen || 1800);
      if (key === "currency") return "USD";
      if (key === "durationEstimate") return "4-6 semaines";
      return prose(key === "summary" || key === "jurisdictionNote" || key === "rationale" ? 420 : key === "title" || key === "name" || key === "segment" ? 30 : 170).slice(0, key === "title" || key === "name" || key === "segment" ? 40 : 10000);
    case "array": {
      const it = schema.items || { type: "string" };
      if (key === "sections") {
        const ids = it.properties.id.enum;
        return ids.map((id) => ({ id, title: TITLES[id] || id, body: gen({ type: "string" }, "body", ctx) }));
      }
      const n = key === "items" ? 10 : key === "phases" ? 4 : key === "tasks" ? 5 : key === "clarifyingQuestions" ? 3 : 4;
      return Array.from({ length: n }, () => gen(it, key === "tasks" ? "task" : "item", ctx));
    }
    case "object": {
      const o = {};
      for (const [k, v] of Object.entries(schema.properties || {})) o[k] = gen(v, k, ctx);
      return o;
    }
    default: return prose(80);
  }
}

class APIError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
class RateLimitError extends APIError { constructor() { super(429, "rate limited"); } }

export default class Anthropic {
  static RateLimitError = RateLimitError;
  static APIError = APIError;
  constructor() {
    this.messages = { stream: (params) => makeStream(params) };
  }
}

function makeStream(params) {
  const c = control();
  const tool = params.tools[0];
  const stage = (tool.description.match(/Deliver the (.+) as structured/) || [])[1] || "?";
  const user = params.messages[0].content;
  appendFileSync(new URL("requests.log", HERE), JSON.stringify({ t: Date.now(), stage, max_tokens: params.max_tokens, userChars: user.length, sectionIds: tool.input_schema?.properties?.sections?.items?.properties?.id?.enum?.length }) + "\n");

  const failKey = c.fail && c.fail[stage];
  const failNow = failKey && (c.failAlways || !once.has(stage + failKey));
  if (failNow) once.add(stage + failKey);

  let data = gen(tool.input_schema, "root", { bodyLen: c.bodyLen || 1800 });
  if (failNow && failKey === "stringify") {
    for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) { data[k] = JSON.stringify(v); break; }
  }
  if (failNow && failKey === "incomplete") { const k = Object.keys(data)[0]; delete data[k]; }
  const json = JSON.stringify(data);
  const cps = c.charsPerSec || 20000;
  const stop = failNow && failKey === "max_tokens" ? "max_tokens" : "tool_use";
  const outTokens = Math.round(json.length / 3.2);

  async function* events() {
    if (failNow && failKey === "error500") { await new Promise((r) => setTimeout(r, 200)); throw new APIError(500, "overloaded"); }
    if (failNow && failKey === "nokey") throw new APIError(401, "invalid x-api-key");
    const chunk = 400;
    for (let i = 0; i < json.length; i += chunk) {
      await new Promise((r) => setTimeout(r, (chunk / cps) * 1000));
      yield { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: json.slice(i, i + chunk) } };
    }
  }
  const it = events();
  let finished = null;
  return {
    [Symbol.asyncIterator]() { return { next: async () => { const r = await it.next(); if (r.done) finished = true; return r; } }; },
    async finalMessage() {
      return { stop_reason: stop, usage: { input_tokens: Math.round(user.length / 3.5), output_tokens: outTokens },
        content: [{ type: "tool_use", name: "deliver", input: data }] };
    },
  };
}
