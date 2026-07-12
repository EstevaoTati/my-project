import type { ReactNode } from "react";

// Le layout racine délègue tout à app/[locale]/layout.tsx (next-intl).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
