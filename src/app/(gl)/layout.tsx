import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";
import { siteMetadata, siteViewport } from "../metadata";

export const metadata = siteMetadata("gl");
export const viewport = siteViewport;

export default function GlLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="gl">
      <body>
        <div className="appShell">{children}</div>
        <Footer locale="gl" />
      </body>
    </html>
  );
}
