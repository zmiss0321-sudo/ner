import { LetterDetailPage } from "@/components/LetterDetailPage";
import type { SearchScope } from "@/lib/types";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; scope?: string; at?: string }> }) {
  const { id } = await params;
  const search = await searchParams;
  const scope: SearchScope = search.scope === "recipient" || search.scope === "source" ? search.scope : "fulltext";
  const parsedStart = search.at === undefined ? undefined : Number.parseInt(search.at, 10);
  return <LetterDetailPage id={decodeURIComponent(id)} query={search.q ?? ""} scope={scope} matchStart={Number.isFinite(parsedStart) ? parsedStart : undefined} />;
}
