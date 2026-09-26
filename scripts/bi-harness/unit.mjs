import assert from "node:assert/strict";
const R = new URL("../../netlify/functions/", import.meta.url).href;
const S = await import(R + "_bi_stages.mjs");
const { normalize, STAGES, missingFields, PLAN_PARTS, PLAN_IDS } = S;
// normalize
const fin = normalize(STAGES.financials.schema, { currency: "CDF", assumptions: { initialInvestment: "25 000", pricePerUnit: "45,5", variableCostPerUnit: 12, customersMonth1: "40", monthlyGrowthRate: "12%", salariesMonthly: "1.500", marketingMonthly: 800, technologyMonthly: 400, otherOpexMonthly: "600 USD" }, assumptionNotes: "- a\n- b", scenarioMultipliers: '{"pessimistic":0.5,"realistic":1,"optimistic":1.6}' });
assert.equal(fin.assumptions.initialInvestment, 25000); assert.equal(fin.assumptions.pricePerUnit, 45.5);
assert.equal(fin.assumptions.monthlyGrowthRate, 0.12); assert.equal(fin.assumptions.salariesMonthly, 1500);
assert.equal(fin.assumptions.otherOpexMonthly, 600); assert.deepEqual(fin.assumptionNotes, ["a", "b"]);
assert.equal(fin.scenarioMultipliers.optimistic, 1.6); assert.deepEqual(missingFields("financials", fin), []);
const an = normalize(STAGES.analyze.schema, { targetCustomers: JSON.stringify([{ segment: "A", description: "d" }]), risks: [{ risk: "r", severity: "HIGH", mitigation: "m" }, "Just a string risk"], revenueModelOptions: [{ name: "n", why: "w", fit: "Medium fit" }] });
assert.equal(an.targetCustomers[0].segment, "A"); assert.equal(an.risks[0].severity, "high");
assert.equal(an.risks[1].risk, "Just a string risk"); assert.equal(an.risks[1].severity, "low");
assert.equal(an.revenueModelOptions[0].fit, "medium");
assert.ok(missingFields("analyze", an).includes("summary"));
assert.equal(PLAN_PARTS[0].length + PLAN_PARTS[1].length, 17); assert.equal(PLAN_IDS.length, 17);
const fz = normalize(STAGES.financials.schema, { currency: "USD", assumptions: { pricePerUnit: "n/a" }, assumptionNotes: [], scenarioMultipliers: {} });
assert.ok(missingFields("financials", fz).some((m) => m.startsWith("assumptions.")));
console.log("normalize + missingFields: ok");
// jobs
const J = await import(R + "_jobs.mjs");
const id = J.newJobId(); assert.match(id, /^[0-9a-f]{36}$/);
assert.ok(Math.abs(parseInt(id.slice(0, 8), 16) * 1000 - Date.now()) < 5000);
console.log("job id: ok", id);
