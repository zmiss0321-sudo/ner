import { actTypeMeta, entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { getSecondaryCategories } from "@/lib/topic-config";
import type { ActType, EntityType, EventType } from "@/lib/types";
import type {
  AnalysisTemplate,
  ChartType,
  DimensionGroup,
  DimensionItem,
  DimensionKey,
  DimensionMeta,
  MetricId,
} from "./types";

const ENTITY_TYPES = Object.keys(entityTypeMeta) as EntityType[];
const EVENT_TYPES = Object.keys(eventTypeMeta) as EventType[];
const ACT_TYPES = Object.keys(actTypeMeta) as ActType[];

function normalizedSubtypeCode(type: EntityType, code: string): string {
  return code.startsWith(`${type}-`) ? code : `${type}-${code}`;
}

function entityItem(type: EntityType): DimensionItem {
  const parentKey = `entity_type:${type}` as DimensionKey;
  return {
    key: parentKey,
    label: `${entityTypeMeta[type].label}（${type}）`,
    children: getSecondaryCategories(type)
      // “收信人”已经作为独立维度放在时间组，避免出现两个同名入口。
      .filter((category) => !(type === "PER" && category.code === "PER-ADDRESSEE"))
      .map((category) => ({
        key: `entity_subtype:${normalizedSubtypeCode(type, category.code)}` as DimensionKey,
        label: category.label,
        parentKey,
      })),
  };
}

export const DIMENSION_GROUPS: DimensionGroup[] = [
  {
    category: "时间",
    items: [
      { key: "year", label: "年份" },
      { key: "period", label: "时期（晚清 / 民初）" },
      { key: "recipient", label: "收信人" },
    ],
  },
  {
    category: "实体类型",
    items: ENTITY_TYPES.map(entityItem),
  },
  {
    category: "事件类型",
    items: EVENT_TYPES.map((type) => ({
      key: `event_type:${type}` as DimensionKey,
      label: eventTypeMeta[type].label,
    })),
  },
  {
    category: "行为类型",
    items: ACT_TYPES.map((type) => ({
      key: `act_type:${type}` as DimensionKey,
      label: actTypeMeta[type].label,
    })),
  },
];

export const DIMENSION_ITEMS: DimensionItem[] = DIMENSION_GROUPS.flatMap((group) =>
  group.items.flatMap((item) => [item, ...(item.children ?? [])]),
);

const dimensionItemByKey = new Map(DIMENSION_ITEMS.map((item) => [item.key, item]));

export function getDimensionItem(key: DimensionKey): DimensionItem | undefined {
  return dimensionItemByKey.get(key);
}

export function getDimensionKeyLabel(key: DimensionKey): string {
  return getDimensionItem(key)?.label ?? key;
}

export function isTemporalDimension(key: DimensionKey): boolean {
  return key === "year" || key === "period";
}

export function isEntitySubtypeDimension(key: DimensionKey): boolean {
  return key.startsWith("entity_subtype:");
}

/**
 * V1-style dimensions are retained for explicit value filters.
 */
export const DIMENSIONS: DimensionMeta[] = [
  { id: "year", label: "年份", category: "时间" },
  { id: "period", label: "时期", category: "时间" },
  { id: "recipient", label: "收信人", category: "时间" },
  { id: "entity_type", label: "实体类型", category: "实体" },
  { id: "entity_subtype", label: "实体子类型", category: "实体" },
  { id: "entity_canonical", label: "具体实体", category: "实体" },
  { id: "loc_subtype", label: "地点子类型", category: "空间" },
  { id: "loc_canonical", label: "具体地点", category: "空间" },
  { id: "event_type", label: "事件类型", category: "事件" },
  { id: "act_type", label: "行为类型", category: "行为" },
  { id: "bok_subtype", label: "书籍子类型", category: "内容" },
  { id: "ver_subtype", label: "版本子类型", category: "内容" },
];

export const METRICS: { id: MetricId; label: string }[] = [
  { id: "letter_count", label: "书信数" },
  { id: "mention_count", label: "实体出现次数" },
  { id: "canonical_count", label: "规范实体数" },
  { id: "event_count", label: "事件数" },
  { id: "paragraph_count", label: "行为段落数" },
];

export const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "bar_stacked", label: "堆叠柱状图" },
  { id: "heatmap", label: "热力图" },
  { id: "line", label: "折线图" },
  { id: "pie_ring", label: "环形图" },
  { id: "pie_rose", label: "玫瑰图" },
  { id: "sankey", label: "桑基图" },
  { id: "radar", label: "雷达图" },
  { id: "scatter", label: "气泡图" },
];

export function getChartIncompatibilityReason(
  chartType: ChartType,
  rowKey: DimensionKey | null,
  columnKey: DimensionKey | null,
): string | null {
  if (!rowKey) return "请先选择行维度";
  if ((chartType === "pie_ring" || chartType === "pie_rose") && columnKey) {
    return "饼图仅支持单一行维度";
  }
  if (
    (chartType === "heatmap"
      || chartType === "line"
      || chartType === "sankey"
      || chartType === "scatter")
    && !columnKey
  ) {
    return "需要同时设置行维度和列维度";
  }
  return null;
}

function templateConfig(
  selectedDimensions: DimensionKey[],
  rowKey: DimensionKey,
  columnKey: DimensionKey | null,
  metric: MetricId,
  chartType: ChartType,
): AnalysisTemplate["config"] {
  return {
    selectedDimensions,
    rowKey,
    columnKey,
    metric,
    filters: [],
    chartType,
    excludeUnknownYear: false,
  };
}

export const TEMPLATES: AnalysisTemplate[] = [
  {
    id: "letters_by_year",
    name: "书信年代分布",
    icon: "年",
    config: templateConfig(["recipient", "year"], "recipient", "year", "letter_count", "bar_stacked"),
  },
  {
    id: "person_by_year",
    name: "人物提及年代趋势",
    icon: "人",
    config: templateConfig(
      ["entity_type:PER", "year"],
      "entity_type:PER",
      "year",
      "mention_count",
      "line",
    ),
  },
  {
    id: "book_by_year",
    name: "书籍提及年代趋势",
    icon: "书",
    config: templateConfig(
      ["entity_type:BOK", "year"],
      "entity_type:BOK",
      "year",
      "mention_count",
      "bar_stacked",
    ),
  },
  {
    id: "recipient_bibliography",
    name: "收信人文献活动",
    icon: "信",
    config: templateConfig(
      ["recipient", "event_type:BIB"],
      "recipient",
      "event_type:BIB",
      "event_count",
      "heatmap",
    ),
  },
  {
    id: "location_by_year",
    name: "地点提及变迁",
    icon: "地",
    config: templateConfig(
      ["entity_type:LOC", "year"],
      "entity_type:LOC",
      "year",
      "mention_count",
      "line",
    ),
  },
  {
    id: "edition_by_year",
    name: "版本讨论轨迹",
    icon: "本",
    config: templateConfig(
      ["entity_type:VER", "year"],
      "entity_type:VER",
      "year",
      "mention_count",
      "line",
    ),
  },
];
