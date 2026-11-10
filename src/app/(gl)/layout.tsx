import type { ReactNode } from "react";
import { SiteAnalytics } from "@/analytics/SiteAnalytics";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";
import { siteMetadata, siteViewport } from "../metadata";

export const metadata = siteMetadata("gl");
export const viewport = siteViewport;

export default function GlLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="gl">
      <body>
        {children}
        <Footer locale="gl" />
        <SiteAnalytics />
      </body>
    </html>
  );
}
