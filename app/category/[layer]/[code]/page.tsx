import { CategoryIndexPage } from "@/components/CategoryIndexPage";

export default async function Page({ params }: { params: Promise<{ layer: string; code: string }> }) {
  const { layer, code } = await params;
  return <CategoryIndexPage layer={layer} code={code} />;
}
