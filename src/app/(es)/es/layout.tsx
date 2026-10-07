import type { ReactNode } from "react";
import "../../globals.css";
import { siteMetadata } from "../../metadata";

export const metadata = siteMetadata("es");

export default function EsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
