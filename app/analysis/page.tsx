import type { Metadata } from "next";
import { AnalysisPage } from "@/components/analysis/AnalysisPage";

export const metadata: Metadata = {
  title: "自选维度分析｜叶德辉书信数字人文",
  description: "自选维度交叉分析叶德辉书信中的实体、事件与行为标注数据。",
};

export default function AnalysisRoute() {
  return <AnalysisPage />;
}
