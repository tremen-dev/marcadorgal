import type { ReactNode } from "react";
import "../../globals.css";
import { waitingMetadata } from "../../metadata";

export const metadata = waitingMetadata("es");

export default function EsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
