import type { MetadataRoute } from "next";
import { ICON_FILES } from "@/design/icon";
import { COLORS } from "@/design/tokens";
import { t } from "@/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("gl", "common.title"),
    short_name: t("gl", "common.title"),
    description: t("gl", "common.description"),
    start_url: "/",
    display: "standalone",
    background_color: COLORS.bg.value,
    theme_color: COLORS.bg.value,
    icons: [
      {
        src: `/${ICON_FILES.icon.path}`,
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: `/${ICON_FILES.apple.path}`,
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: `/${ICON_FILES.pwa192.path}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/${ICON_FILES.pwa512.path}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
