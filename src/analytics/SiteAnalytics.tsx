import { MeasuredAnalytics } from "./MeasuredAnalytics";

/** SPEC-077 CA-1 (ADR-033 §4): Preview and local never send anything. */
export function shouldMeasure(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}

/** The single mount point of Web Analytics, used by both layouts. */
export function SiteAnalytics({
  vercelEnv = process.env.VERCEL_ENV,
}: {
  vercelEnv?: string;
}) {
  return shouldMeasure(vercelEnv) ? <MeasuredAnalytics /> : null;
}
