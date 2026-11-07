import type { Metadata } from "next";
import { LegalPageView } from "@/components/legal/LegalPage";
import { LEGAL_DOCS_ES } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: `${LEGAL_DOCS_ES.cookies.title} · marcador.gal`,
  description: LEGAL_DOCS_ES.cookies.description,
};

export default function CookiesPage() {
  return <LegalPageView document={LEGAL_DOCS_ES.cookies} locale="es" />;
}
