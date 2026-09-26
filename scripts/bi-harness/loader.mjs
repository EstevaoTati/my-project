// Redirect the two platform packages to in-process fakes.
const here = new URL("./", import.meta.url);
export async function resolve(specifier, context, next) {
  if (specifier === "@anthropic-ai/sdk") return { url: new URL("fake-anthropic.mjs", here).href, shortCircuit: true };
  if (specifier === "@netlify/blobs") return { url: new URL("fake-blobs.mjs", here).href, shortCircuit: true };
  return next(specifier, context);
}
