import { HomeXornada, homeMetadata } from "../../xornada-home";

// ISR: rendered on the server at most once every 10 s (ADR-014 §6, CA-7).
export const revalidate = 10;

export const metadata = homeMetadata("es");

export default function Page() {
  return <HomeXornada locale="es" />;
}
