import type { Metadata } from "next";
import { LegalPageView } from "@/components/legal/LegalPage";
import { LEGAL_DOCS_ES } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: `${LEGAL_DOCS_ES.avisoLegal.title} · marcador.gal`,
  description: LEGAL_DOCS_ES.avisoLegal.description,
};

export default function AvisoLegalPage() {
  return <LegalPageView document={LEGAL_DOCS_ES.avisoLegal} locale="es" />;
}
