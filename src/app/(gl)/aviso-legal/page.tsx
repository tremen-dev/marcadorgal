import type { Metadata } from "next";
import { LegalPageView } from "@/components/legal/LegalPage";
import { LEGAL_DOCS_GL } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: `${LEGAL_DOCS_GL.avisoLegal.title} · marcador.gal`,
  description: LEGAL_DOCS_GL.avisoLegal.description,
};

export default function AvisoLegalPage() {
  return <LegalPageView document={LEGAL_DOCS_GL.avisoLegal} locale="gl" />;
}
