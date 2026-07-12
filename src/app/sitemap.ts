import type { MetadataRoute } from "next";

const PATHS = [
  "",
  "/comment-ca-marche",
  "/tarifs",
  "/metiers/impots",
  "/metiers/immigration",
  "/metiers/assurance",
  "/sandbox",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mwinda.digital";
  const now = new Date();

  return PATHS.flatMap((path) => [
    {
      url: `${base}${path || "/"}`,
      lastModified: now,
      alternates: {
        languages: { fr: `${base}${path || "/"}`, en: `${base}/en${path}` },
      },
    },
    { url: `${base}/en${path}`, lastModified: now },
  ]);
}
