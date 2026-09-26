// In-memory Netlify Blobs. One process = one store, like strong consistency.
const stores = globalThis.__blobStores || (globalThis.__blobStores = new Map());
export function getStore({ name }) {
  if (process.env.FAKE_BLOBS_DOWN === "1") throw new Error("MissingBlobsEnvironmentError");
  if (!stores.has(name)) stores.set(name, new Map());
  const m = stores.get(name);
  return {
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async get(k, opts = {}) { const v = m.get(k); if (v === undefined) return null; return opts.type === "json" ? JSON.parse(v) : v; },
    async delete(k) { m.delete(k); },
    async list() { return { blobs: [...m.keys()].map((key) => ({ key, etag: "x" })), directories: [] }; },
  };
}
export const __stores = stores;
