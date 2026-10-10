// Public site content: bundled defaults deep-merged with the dashboard edits.
// Contains no guest data — safe to cache briefly at the edge.
import { json, loadContent } from "./_lib.mjs";

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });
  const content = await loadContent();
  return json(200, content, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
};

export const config = { path: "/api/content" };
