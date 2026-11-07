import type { ReactNode } from "react";
import { CompetitionNav } from "../../../components/navigation/CompetitionNav";
import "../../globals.css";
import { siteMetadata, siteViewport } from "../../metadata";

export const metadata = siteMetadata("es");
export const viewport = siteViewport;

export default function EsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <CompetitionNav locale="es" />
        {children}
      </body>
    </html>
  );
}
