import { homeMetadata } from "../../../xornada-home";
import { WeekXornada } from "../../../xornada-week";

// SPEC-027 CA-4 (ADR-014 §6): ISR of 10 s, rendered on demand the first
// time a week is visited; nothing is prerendered at build.
export const revalidate = 10;

export function generateStaticParams(): { fecha: string }[] {
  return [];
}

export const metadata = homeMetadata("gl");

export default async function Page({
  params,
}: {
  params: Promise<{ fecha: string }>;
}) {
  const { fecha } = await params;
  return <WeekXornada locale="gl" fecha={fecha} />;
}
