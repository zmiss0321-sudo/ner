import type { ActType, EntityType, EventType } from "@/lib/types";

/**
 * Filter dimensions intentionally remain broader than the V2 checkbox keys.
 * A filter chooses a value within one of these dimensions, while a selected
 * V2 key represents one concrete analysis dimension or annotation category.
 */
export type DimensionId =
  | "year"
  | "period"
  | "recipient"
  | "entity_type"
  | "entity_subtype"
  | "entity_canonical"
  | "loc_subtype"
  | "loc_canonical"
  | "event_type"
  | "act_type"
  | "bok_subtype"
  | "ver_subtype";

export type DimensionKey =
  | "year"
  | "period"
  | "recipient"
  | `entity_type:${EntityType}`
  | `entity_subtype:${string}`
  | `event_type:${EventType}`
  | `act_type:${ActType}`;

export type MetricId =
  | "letter_count"
  | "mention_count"
  | "canonical_count"
  | "event_count"
  | "paragraph_count";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "between";

export type ChartType =
  | "bar_stacked"
  | "heatmap"
  | "line"
  | "pie_ring"
  | "pie_rose"
  | "sankey"
  | "radar"
  | "scatter";

export interface Filter {
  id: string;
  dimension: DimensionId;
  operator: FilterOperator;
  value: string | string[] | [string, string];
}

export interface AnalysisConfig {
  selectedDimensions: DimensionKey[];
  rowKey: DimensionKey | null;
  columnKey: DimensionKey | null;
  metric: MetricId;
  filters: Filter[];
  chartType: ChartType;
  excludeUnknownYear: boolean;
}

export interface PivotResult {
  rowHeaders: { label: string; children?: { label: string }[] }[];
  columnHeaders: { label: string; children?: { label: string }[] }[];
  cells: number[][];
  rowTotals: number[];
  columnTotals: number[];
  grandTotal: number;
}

export interface PivotRowData {
  mainLabel: string;
  subLabel: string | null;
  values: number[];
  total: number;
}

export interface DimensionMeta {
  id: DimensionId;
  label: string;
  category: "时间" | "人物" | "实体" | "空间" | "事件" | "行为" | "内容";
}

export interface DimensionItem {
  key: DimensionKey;
  label: string;
  parentKey?: DimensionKey;
  children?: DimensionItem[];
}

export interface DimensionGroup {
  category: "时间" | "人物" | "实体类型" | "事件类型" | "行为类型";
  items: DimensionItem[];
}

export interface AnalysisTemplate {
  id: string;
  name: string;
  icon: string;
  config: AnalysisConfig;
}
