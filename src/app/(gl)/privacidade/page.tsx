import type { Metadata } from "next";
import { LegalPageView } from "@/components/legal/LegalPage";
import { LEGAL_DOCS_GL } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: `${LEGAL_DOCS_GL.privacidade.title} · marcador.gal`,
  description: LEGAL_DOCS_GL.privacidade.description,
};

export default function PrivacidadePage() {
  return <LegalPageView document={LEGAL_DOCS_GL.privacidade} locale="gl" />;
}
