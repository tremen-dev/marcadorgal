import type { ReactNode } from "react";
import "../globals.css";
import { waitingMetadata } from "../metadata";

export const metadata = waitingMetadata("gl");

export default function GlLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="gl">
      <body>{children}</body>
    </html>
  );
}
