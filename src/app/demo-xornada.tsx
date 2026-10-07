import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { XornadaScreen } from "@/components/xornada/XornadaScreen";
import { type Locale, t } from "@/i18n";
import { DEMO_MATCHES, isDemoAvailable } from "@/xornada/demo";
import { buildXornada } from "@/xornada/view";

// /demo/xornada and /es/demo/xornada (SPEC-019 CA-5): server content only,
// never in production, never indexed.
export const DEMO_PATHS: Readonly<Record<Locale, string>> = {
  gl: "/demo/xornada",
  es: "/es/demo/xornada",
};

export function demoMetadata(locale: Locale): Metadata {
  return {
    title: `${t(locale, "xornada.title")} · ${t(locale, "common.title")}`,
    robots: { index: false, follow: false },
  };
}

export function DemoXornada({ locale }: { locale: Locale }) {
  if (!isDemoAvailable({ VERCEL_ENV: process.env.VERCEL_ENV })) notFound();
  return (
    <XornadaScreen
      locale={locale}
      competitions={buildXornada([...DEMO_MATCHES])}
      paths={DEMO_PATHS}
    />
  );
}
