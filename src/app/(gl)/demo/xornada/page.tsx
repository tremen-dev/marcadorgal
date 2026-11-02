import { DemoXornada, demoMetadata } from "../../../demo-xornada";

// SPEC-041 CA-6: rendered per request, so its recent goals are relative to
// the render (never prerendered at build).
export const dynamic = "force-dynamic";

export const metadata = demoMetadata("gl");

export default function Page() {
  return <DemoXornada locale="gl" />;
}
