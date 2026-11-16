import {
  DirectosScreen,
  type DirectosSearchParams,
} from "@/app/directos-screen";

// SPEC-055, SPEC-087: one day of the explorer export, cached by the CDN.
export const dynamic = "force-dynamic";

export default function DirectosPage({
  searchParams,
}: {
  searchParams: DirectosSearchParams;
}) {
  return <DirectosScreen locale="es" searchParams={searchParams} />;
}
