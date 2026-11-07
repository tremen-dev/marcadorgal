import type { Metadata } from "next";
import { LegalPageView } from "@/components/legal/LegalPage";
import { LEGAL_DOCS_ES } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: `${LEGAL_DOCS_ES.privacidade.title} · marcador.gal`,
  description: LEGAL_DOCS_ES.privacidade.description,
};

export default function PrivacidadPage() {
  return <LegalPageView document={LEGAL_DOCS_ES.privacidade} locale="es" />;
}
