import { CompetitionCalendarPage } from "../../../../competition-page.tsx";

export const revalidate = 30;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompetitionCalendarPage id={id} locale="es" />;
}
