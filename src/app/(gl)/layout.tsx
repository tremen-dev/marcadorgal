import type { ReactNode } from "react";
import { CompetitionNav } from "../../components/navigation/CompetitionNav";
import "../globals.css";
import { siteMetadata, siteViewport } from "../metadata";

export const metadata = siteMetadata("gl");
export const viewport = siteViewport;

export default function GlLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="gl">
      <body>
        <CompetitionNav locale="gl" />
        {children}
      </body>
    </html>
  );
}
