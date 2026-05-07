import { redirect } from "next/navigation";

// `/route/[eventId]` was the dedicated event explorer. After merging into
// `/nearby?focus=...` the route remains as a permanent redirect so any
// previously shared links keep working.
export default async function LegacyRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ lng?: string }>;
}) {
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);
  const lng = sp.lng === "ko" ? "&lng=ko" : "";
  redirect(`/nearby?focus=${encodeURIComponent(eventId)}${lng}`);
}
