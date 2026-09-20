import type { Metadata } from "next";
import { type Locale, t } from "@/i18n";

export function waitingMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, "common.title"),
    robots: { index: false, follow: false },
  };
}
