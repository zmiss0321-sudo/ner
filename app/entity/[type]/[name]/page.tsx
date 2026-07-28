import { EntityDetailPage } from "@/components/EntityDetailPage";
import type { EntityType } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ type: string; name: string }> }) {
  const { type, name } = await params;
  return <EntityDetailPage type={type as EntityType} name={decodeURIComponent(name)} />;
}
