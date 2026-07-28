import { TopicDetailPage } from "@/components/TopicDetailPage";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TopicDetailPage slug={slug} />;
}
