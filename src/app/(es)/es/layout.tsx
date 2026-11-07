import type { ReactNode } from "react";
import "../../globals.css";
import { siteMetadata, siteViewport } from "../../metadata";

export const metadata = siteMetadata("es");
export const viewport = siteViewport;

export default function EsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
