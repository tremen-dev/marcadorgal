import { HomeXornada, homeMetadata } from "../../xornada-home";

// SPEC-030 (H-1 a): rendered per request, never ISR nor prerendered at build;
// the CDN caches it with the directives of ADR-014 §6 (next.config.ts).
export const dynamic = "force-dynamic";

export const metadata = homeMetadata("es");

export default function Page() {
  return <HomeXornada locale="es" />;
}
