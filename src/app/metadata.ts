import type { Metadata } from "next";
import { ICON_FILES } from "@/design/icon";
import { type Locale, t } from "@/i18n";

// SPEC-033 CA-6: the icons of every page (/, /es, /xornada/[fecha], demos),
// from the root layouts; pages set their title and inherit these.
const ICONS: Metadata["icons"] = {
  icon: [
    { url: `/${ICON_FILES.favicon.path}`, sizes: "16x16 32x32" },
    { url: `/${ICON_FILES.icon.path}`, sizes: "32x32", type: "image/png" },
  ],
  apple: [
    { url: `/${ICON_FILES.apple.path}`, sizes: "180x180", type: "image/png" },
  ],
};

export function siteMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, "common.title"),
    robots: { index: false, follow: false },
    icons: ICONS,
  };
}
