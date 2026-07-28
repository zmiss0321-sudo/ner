# 自选维度分析 — Codex 实现规范

> 本文档是给 Codex 的完整实现规范。请严格按照本文档的顺序和细节创建/修改所有文件。

---

## 一、项目环境

| 项目 | 值 |
|------|-----|
| 项目路径 | `ye-annotation-site/` |
| 框架 | Next.js 16.2.6（App Router） |
| UI | React 19.2.6 + Tailwind CSS 4.2.1 |
| 语言 | TypeScript 5.9.3 |
| 包管理 | npm |
| 数据 | 静态 JSON（约 8MB），通过 `@/lib/data-adapter` 加载，纯客户端计算 |
| 图表库 | ECharts 5 + echarts-for-react |

---

## 二、数据模型速览

数据通过 `import { dataset } from "@/lib/data-adapter"` 访问。`Dataset` 类型定义在 `lib/types.ts`：

```typescript
interface Dataset {
  generatedAt: string;
  letters: Letter[];                              // 306 封
  entitiesByLetter: Record<string, EntityMention[]>;  // letterId → mentions[]
  eventsByLetter: Record<string, EventMention[]>;
  actsByLetter: Record<string, ActMention[]>;
  entityCatalog: EntityCatalogEntry[];            // 3,378 个规范实体
  entityStats: Record<EntityType, { canonicalCount: number; mentionCount: number; letterCount: number }>;
  eventStats: Record<EventType, { eventCount: number; letterCount: number }>;
  actStats: Record<ActType, { paragraphCount: number; letterCount: number }>;
}

interface Letter {
  id: string;          // 如 "001_1923_易培基"
  number: string;
  year: string | null; // "1894"–"1926" 或 null（76 封无年份）
  recipient: string;   // 58 个不同收信人
  text: string;
  dateLabel: string | null;
  ganzhiDate: string | null;
  source: string | null;
  summary: string | null;
}

type EntityType = "PER" | "LOC" | "BOK" | "VER" | "TIM" | "OFF" | "ORG" | "KIN" | "AST";
type EventType = "BIB" | "ACA" | "SOC" | "POL" | "FAM";
type ActType = "REQ" | "DSP" | "INF" | "PRS" | "MNT" | "INS" | "NEG";

interface EntityCatalogEntry {
  type: EntityType;
  canonical: string;       // 规范实体名
  aliases: string[];
  subtypes: string[];      // 如 "PER-CONTEMPORARY"、"LOC-ADM1"、"BOK-CLASSICS"
  count: number;           // 出现次数
  letterIds: string[];
}

interface EntityMention { type: EntityType; surface: string; canonical: string; subtype: string | null; start: number; end: number; }
interface EventMention { id: string; type: EventType; subtype: string | null; /* … */ start: number; end: number; }
interface ActMention { id: string; letterId: string; type: ActType; subtype: string | null; /* … */ }
```

### 关键数据访问函数（`lib/data-adapter.ts` 中已有）

- `dataset.letters` — 所有书信
- `dataset.entityCatalog` — 所有规范实体
- `dataset.entityStats` — 实体类型统计
- `dataset.eventStats` — 事件类型统计
- `dataset.actStats` — 行为类型统计
- `dataset.entitiesByLetter[letterId]` — 某书信的实体标注
- `dataset.eventsByLetter[letterId]` — 某书信的事件标注
- `dataset.actsByLetter[letterId]` — 某书信的行为标注
- `getSecondaryCategories(entityCode)` — 来自 `lib/topic-config.ts`，返回某实体类型的二级分类列表

### 关键配置（`lib/config.ts` 中已有）

- `entityTypeMeta` — `Record<EntityType, { label, prompt }>`：PER→"人物", LOC→"地点", …
- `eventTypeMeta` — `Record<EventType, { label, definition }>`：BIB→"文献活动", …
- `actTypeMeta` — `Record<ActType, { label, definition }>`：REQ→"请求", …
- `annotationStyles` — `{ entity: Record<EntityType, {...}>, event: Record<EventType, {...}>, action: Record<ActType, {...}> }>`，每个类型都有颜色定义

---

## 三、执行步骤

### Step 1：安装依赖

```bash
cd ye-annotation-site && npm install echarts echarts-for-react
```

### Step 2：创建 `lib/analysis/types.ts`

```typescript
// 维度 ID
export type DimensionId =
  | "year" | "period" | "recipient"
  | "entity_type" | "entity_subtype" | "entity_canonical"
  | "loc_subtype" | "loc_canonical"
  | "event_type" | "act_type"
  | "bok_subtype" | "ver_subtype";

// 度量指标
export type MetricId = "letter_count" | "mention_count" | "canonical_count" | "event_count" | "paragraph_count";

// 筛选运算符
export type FilterOperator = "equals" | "not_equals" | "in" | "not_in" | "between";

// 图表类型
export type ChartType = "bar_stacked" | "heatmap" | "line" | "pie_ring" | "pie_rose" | "sankey" | "radar" | "scatter";

// 单条筛选
export interface Filter {
  id: string;
  dimension: DimensionId;
  operator: FilterOperator;
  value: string | string[] | [string, string];
}

// 完整分析配置
export interface AnalysisConfig {
  rowDimension: DimensionId | null;
  rowNested: DimensionId | null;
  columnDimension: DimensionId | null;
  columnNested: DimensionId | null;
  metric: MetricId;
  filters: Filter[];
  chartType: ChartType;
  excludeUnknownYear: boolean;
}

// 透视表结果
export interface PivotResult {
  rowHeaders: { label: string; children?: { label: string }[] }[];
  columnHeaders: { label: string; children?: { label: string }[] }[];
  cells: number[][];
  rowTotals: number[];
  columnTotals: number[];
  grandTotal: number;
}

// 扁平化的行数据（方便渲染）
export interface PivotRowData {
  mainLabel: string;
  subLabel: string | null;
  values: number[];
  total: number;
}

// 维度元数据
export interface DimensionMeta {
  id: DimensionId;
  label: string;
  category: "时间" | "人物" | "实体" | "空间" | "事件" | "行为" | "内容";
  nestableWith: DimensionId | null;
  supportsNesting: boolean;
}

// 预设模板
export interface AnalysisTemplate {
  id: string;
  name: string;
  icon: string;
  config: AnalysisConfig;
}
```

### Step 3：创建 `lib/analysis/dimensions.ts`

```typescript
import type { DimensionMeta, MetricId, ChartType, AnalysisTemplate } from "./types";

export const DIMENSIONS: DimensionMeta[] = [
  { id: "year", label: "年份", category: "时间", nestableWith: null, supportsNesting: false },
  { id: "period", label: "时期", category: "时间", nestableWith: null, supportsNesting: false },
  { id: "recipient", label: "收信人", category: "人物", nestableWith: null, supportsNesting: false },
  { id: "entity_type", label: "实体类型", category: "实体", nestableWith: "entity_subtype", supportsNesting: true },
  { id: "entity_subtype", label: "实体子类型", category: "实体", nestableWith: null, supportsNesting: false },
  { id: "entity_canonical", label: "具体实体", category: "实体", nestableWith: null, supportsNesting: false },
  { id: "loc_subtype", label: "地点子类型", category: "空间", nestableWith: null, supportsNesting: false },
  { id: "loc_canonical", label: "具体地点", category: "空间", nestableWith: null, supportsNesting: false },
  { id: "event_type", label: "事件类型", category: "事件", nestableWith: null, supportsNesting: false },
  { id: "act_type", label: "行为类型", category: "行为", nestableWith: null, supportsNesting: false },
  { id: "bok_subtype", label: "书籍子类型", category: "内容", nestableWith: null, supportsNesting: false },
  { id: "ver_subtype", label: "版本子类型", category: "内容", nestableWith: null, supportsNesting: false },
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

export const TEMPLATES: AnalysisTemplate[] = [
  {
    id: "letters_by_year",
    name: "📅 书信年代分布",
    icon: "📅",
    config: {
      rowDimension: "recipient", rowNested: null,
      columnDimension: "year", columnNested: null,
      metric: "letter_count", filters: [],
      chartType: "bar_stacked", excludeUnknownYear: false,
    },
  },
  {
    id: "entity_by_year",
    name: "🏷️ 实体类型年代趋势",
    icon: "🏷️",
    config: {
      rowDimension: "entity_type", rowNested: null,
      columnDimension: "year", columnNested: null,
      metric: "mention_count", filters: [],
      chartType: "heatmap", excludeUnknownYear: false,
    },
  },
  {
    id: "book_event",
    name: "📚 书籍与事件关联",
    icon: "📚",
    config: {
      rowDimension: "bok_subtype", rowNested: null,
      columnDimension: "event_type", columnNested: null,
      metric: "letter_count", filters: [],
      chartType: "sankey", excludeUnknownYear: false,
    },
  },
  {
    id: "recipient_event",
    name: "👤 收信人关注画像",
    icon: "👤",
    config: {
      rowDimension: "recipient", rowNested: null,
      columnDimension: "event_type", columnNested: null,
      metric: "event_count", filters: [],
      chartType: "heatmap", excludeUnknownYear: false,
    },
  },
  {
    id: "loc_by_year",
    name: "🗺️ 地点提及变迁",
    icon: "🗺️",
    config: {
      rowDimension: "loc_subtype", rowNested: null,
      columnDimension: "year", columnNested: null,
      metric: "mention_count", filters: [],
      chartType: "line", excludeUnknownYear: false,
    },
  },
  {
    id: "ver_by_year",
    name: "📖 版本讨论轨迹",
    icon: "📖",
    config: {
      rowDimension: "ver_subtype", rowNested: null,
      columnDimension: "year", columnNested: null,
      metric: "letter_count", filters: [],
      chartType: "line", excludeUnknownYear: false,
    },
  },
];
```

### Step 4：创建 `lib/analysis/dimension-values.ts`

这个文件负责从 dataset 中提取每个维度的所有可选值（供筛选器使用）。

```typescript
import { dataset } from "@/lib/data-adapter";
import { entityTypeMeta, eventTypeMeta, actTypeMeta } from "@/lib/config";
import { getSecondaryCategories } from "@/lib/topic-config";
import type { DimensionId, FilterOperator } from "./types";
import type { EntityType } from "@/lib/types";

export interface DimensionValue {
  value: string;       // 内部值（传给 aggregator）
  label: string;       // 展示文字
  count?: number;      // 出现次数，用于排序
}

export function getDimensionValues(dimension: DimensionId): DimensionValue[] {
  switch (dimension) {
    case "year": {
      const years = new Set<string>();
      dataset.letters.forEach(l => { if (l.year) years.add(l.year); });
      const sorted = [...years].sort();
      return [...sorted.map(y => ({ value: y, label: `${y}年` })), { value: "__unknown__", label: "未知年份" }];
    }
    case "period": {
      return [
        { value: "late_qing", label: "晚清 (1894–1911)" },
        { value: "early_republic", label: "民初 (1912–1926)" },
        { value: "__unknown_period__", label: "未知时期" },
      ];
    }
    case "recipient": {
      const map = new Map<string, number>();
      dataset.letters.forEach(l => {
        map.set(l.recipient, (map.get(l.recipient) ?? 0) + 1);
      });
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([r, c]) => ({ value: r, label: r, count: c }));
    }
    case "entity_type": {
      return (Object.keys(dataset.entityStats) as EntityType[]).map(code => ({
        value: code,
        label: entityTypeMeta[code].label,
        count: dataset.entityStats[code].mentionCount,
      }));
    }
    case "entity_subtype": {
      const map = new Map<string, number>();
      dataset.entityCatalog.forEach(entry => {
        entry.subtypes.forEach(st => {
          map.set(st, (map.get(st) ?? 0) + entry.count);
        });
      });
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([st, c]) => ({ value: st, label: st, count: c }));
    }
    case "entity_canonical": {
      return dataset.entityCatalog
        .map(entry => ({ value: `${entry.type}:${entry.canonical}`, label: `${entityTypeMeta[entry.type].label} · ${entry.canonical}`, count: entry.count }))
        .sort((a, b) => b.count - a.count);
    }
    case "loc_subtype": {
      return getSecondaryCategories("LOC").map(sc => ({ value: sc.code, label: sc.label }));
    }
    case "loc_canonical": {
      return dataset.entityCatalog
        .filter(e => e.type === "LOC")
        .map(entry => ({ value: `${entry.type}:${entry.canonical}`, label: entry.canonical, count: entry.count }))
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    }
    case "event_type": {
      return (Object.keys(dataset.eventStats) as Array<keyof typeof dataset.eventStats>).map(code => ({
        value: code,
        label: eventTypeMeta[code as keyof typeof eventTypeMeta]?.label ?? code,
        count: dataset.eventStats[code as keyof typeof dataset.eventStats].eventCount,
      }));
    }
    case "act_type": {
      return (Object.keys(dataset.actStats) as Array<keyof typeof dataset.actStats>).map(code => ({
        value: code,
        label: actTypeMeta[code as keyof typeof actTypeMeta]?.label ?? code,
        count: dataset.actStats[code as keyof typeof dataset.actStats].paragraphCount,
      }));
    }
    case "bok_subtype": {
      return getSecondaryCategories("BOK").map(sc => ({ value: sc.code, label: sc.label }));
    }
    case "ver_subtype": {
      return getSecondaryCategories("VER").map(sc => ({ value: sc.code, label: sc.label }));
    }
    default:
      return [];
  }
}

export function getDimensionLabel(dimension: DimensionId): string {
  const dim = [
    { id: "year" as DimensionId, label: "年份" },
    // … 简短查找表
  ].find(d => d.id === dimension);
  return dim?.label ?? dimension;
}

export function getOperatorsForDimension(dimension: DimensionId): FilterOperator[] {
  if (dimension === "year") return ["equals", "not_equals", "between"];
  return ["equals", "not_equals", "in", "not_in"];
}
```

请自行补全维度标签查找表和边界情况。

### Step 5：创建 `lib/analysis/aggregator.ts`

这是核心计算引擎。导出一个函数：

```typescript
import type { AnalysisConfig, PivotResult, PivotRowData } from "./types";
import type { Dataset, Letter, EntityType } from "@/lib/types";
import { getSecondaryCategories } from "@/lib/topic-config";

export function computePivot(config: AnalysisConfig, ds: Dataset): PivotResult {
  // —— 1. 过滤书信 ——
  let letters = ds.letters;
  if (config.excludeUnknownYear) {
    letters = letters.filter(l => l.year !== null);
  }
  for (const f of config.filters) {
    letters = letters.filter(l => matchesFilter(l, f, ds));
  }

  if (!config.rowDimension || !config.columnDimension) {
    return { rowHeaders: [], columnHeaders: [], cells: [], rowTotals: [], columnTotals: [], grandTotal: 0 };
  }

  // —— 2. 获取行列维度值 ——
  const [rowMainValues, rowSubMap] = getDimensionValuesForAxis(config.rowDimension, letters, ds);
  const [colMainValues, colSubMap] = getDimensionValuesForAxis(config.columnDimension, letters, ds);

  const rowNested = config.rowNested;
  const colNested = config.columnNested;
  const rowSubValues = rowNested ? getNestedValues(rowNested, letters, ds) : null;
  const colSubValues = colNested ? getNestedValues(colNested, letters, ds) : null;

  // —— 3. 构建行头和列头 ——
  const rowHeaders = buildHeaders(rowMainValues, rowSubValues, rowSubMap);
  const columnHeaders = buildHeaders(colMainValues, colSubValues, colSubMap);

  const totalRows = rowSubValues ? rowMainValues.length * rowSubValues.length : rowMainValues.length;
  const totalCols = colSubValues ? colMainValues.length * colSubValues.length : colMainValues.length;

  // —— 4. 计算交叉值 ——
  const cells: number[][] = Array.from({ length: totalRows }, () => Array(totalCols).fill(0));

  for (const letter of letters) {
    const rowIndices = getCellIndices(config.rowDimension, letter, ds, rowMainValues, rowSubValues, rowSubMap);
    const colIndices = getCellIndices(config.columnDimension, letter, ds, colMainValues, colSubValues, colSubMap);

    for (const ri of rowIndices) {
      for (const ci of colIndices) {
        cells[ri][ci] += getMetricValue(config.metric, letter, ds);
      }
    }
  }

  // —— 5. 合计 ——
  const rowTotals = cells.map(row => row.reduce((a, b) => a + b, 0));
  const columnTotals = Array.from({ length: totalCols }, (_, ci) => cells.reduce((sum, row) => sum + row[ci], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  return { rowHeaders, columnHeaders, cells, rowTotals, columnTotals, grandTotal };
}

export function flattenPivot(result: PivotResult): PivotRowData[] {
  const rows: PivotRowData[] = [];
  for (let i = 0; i < result.rowHeaders.length; i++) {
    const main = result.rowHeaders[i];
    if (main.children && main.children.length > 0) {
      for (let j = 0; j < main.children.length; j++) {
        rows.push({
          mainLabel: main.label,
          subLabel: main.children[j].label,
          values: result.cells[i * main.children.length + j] ?? [],
          total: result.rowTotals[i * main.children.length + j] ?? 0,
        });
      }
    } else {
      rows.push({
        mainLabel: main.label,
        subLabel: null,
        values: result.cells[i] ?? [],
        total: result.rowTotals[i] ?? 0,
      });
    }
  }
  return rows;
}

// === 内部辅助函数 ===

function matchesFilter(letter: Letter, filter: { dimension: string; operator: string; value: unknown }, ds: Dataset): boolean {
  // 根据 dimension 类型从 letter / entitiesByLetter / eventsByLetter / actsByLetter 提取该信的对应值
  // 然后根据 operator 进行比较
  // 实现细节：此处列出完整逻辑框架，请根据实际维度逐一实现
  const actualValue = extractDimensionValueFromLetter(filter.dimension, letter, ds);
  switch (filter.operator) {
    case "equals": return actualValue === filter.value;
    case "not_equals": return actualValue !== filter.value;
    case "in": return Array.isArray(filter.value) && filter.value.includes(actualValue);
    case "not_in": return Array.isArray(filter.value) && !filter.value.includes(actualValue);
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) return true;
      if (filter.dimension === "year" && letter.year) {
        return letter.year >= filter.value[0] && letter.year <= filter.value[1];
      }
      return true;
    }
    default: return true;
  }
}

function extractDimensionValueFromLetter(dimension: string, letter: Letter, ds: Dataset): string {
  // 根据维度返回该信在该维度上的值
  // 例如 year → letter.year ?? "__unknown__"
  // recipient → letter.recipient
  // 等
  // 完整实现请覆盖所有 DimensionId
  return "";
}

function getDimensionValuesForAxis(dimension: string, letters: Letter[], ds: Dataset): [string[], Map<string, string[]>] {
  // 返回 [主维度值列表, 主值→子值列表的映射（如果没有嵌套则为空 map）]
  // 值列表按自然顺序或频次降序排列
  return [[], new Map()];
}

function getNestedValues(dimension: string, letters: Letter[], ds: Dataset): string[] {
  // 返回子维度的所有可能值列表
  return [];
}

function buildHeaders(mainValues: string[], subValues: string[] | null, subMap: Map<string, string[]>): { label: string; children?: { label: string }[] }[] {
  return mainValues.map(v => ({
    label: v,
    children: subValues ? (subMap.get(v) ?? subValues).map(sv => ({ label: sv })) : undefined,
  }));
}

function getCellIndices(dimension: string, letter: Letter, ds: Dataset, mainValues: string[], subValues: string[] | null, subMap: Map<string, string[]>): number[] {
  // 返回该信在该维度上的所有坐标索引
  // 如果一封书信同时属于多个维度值（如包含 PER 和 LOC），返回多个索引
  return [0];
}

function getMetricValue(metric: string, letter: Letter, ds: Dataset): number {
  switch (metric) {
    case "letter_count": return 1;
    case "mention_count": {
      // 返回该信的总实体 mention 数
      return (ds.entitiesByLetter[letter.id] ?? []).length;
    }
    case "canonical_count": {
      // 返回该信的不同规范实体数
      const mentions = ds.entitiesByLetter[letter.id] ?? [];
      return new Set(mentions.map(m => `${m.type}:${m.canonical}`)).size;
    }
    case "event_count": return (ds.eventsByLetter[letter.id] ?? []).length;
    case "paragraph_count": return (ds.actsByLetter[letter.id] ?? []).length;
    default: return 1;
  }
}
```

> ⚠️ **Codex 注意**：上面 aggreator.ts 的辅助函数我写了框架和关键逻辑，但部分 switch/case 的完整实现需要你根据维度体系逐一补全。特别关注：
> 1. `extractDimensionValueFromLetter` — 12 个维度每个都需要能提取一封信的对应值
> 2. `getDimensionValuesForAxis` — 需要能从过滤后的书信集合中收集所有可能的维度值（去重排序）
> 3. `getCellIndices` — 一封书信可以属于多个维度值（如同时包含 PER 和 BOK），必须返回所有匹配的索引
> 4. `matchesFilter` — 需要处理不同维度类型（分类 vs 有序）的筛选逻辑

### Step 6：创建 `lib/analysis/echarts-builder.ts`

```typescript
import type { AnalysisConfig, PivotResult } from "./types";
import type { EChartsOption } from "echarts";
import { annotationStyles, entityTypeMeta, eventTypeMeta, actTypeMeta } from "@/lib/config";
import type { EntityType, EventType, ActType } from "@/lib/types";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, PieChart, SankeyChart, RadarChart, ScatterChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent, ToolboxComponent, DataZoomComponent, VisualMapComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, HeatmapChart, LineChart, PieChart, SankeyChart, RadarChart, ScatterChart,
  TooltipComponent, LegendComponent, GridComponent, ToolboxComponent, DataZoomComponent, VisualMapComponent, TitleComponent,
  CanvasRenderer]);

export function buildChartOption(config: AnalysisConfig, result: PivotResult): EChartsOption {
  const { chartType } = config;
  switch (chartType) {
    case "bar_stacked": return buildStackedBar(result);
    case "heatmap": return buildHeatmap(result);
    case "line": return buildLine(result);
    case "pie_ring": return buildPie(result, false);
    case "pie_rose": return buildPie(result, true);
    case "sankey": return buildSankey(result);
    case "radar": return buildRadar(result);
    case "scatter": return buildScatter(result);
    default: return {};
  }
}

// 堆叠柱状图
function buildStackedBar(result: PivotResult): EChartsOption {
  const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const rowLabels = result.rowHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);

  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: rowLabels, type: "scroll", bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    xAxis: { type: "category", data: colLabels, axisLabel: { rotate: colLabels.length > 10 ? 45 : 0 } },
    yAxis: { type: "value" },
    series: rowLabels.map((label, i) => ({
      name: label,
      type: "bar",
      stack: "total",
      data: result.cells[i] ?? [],
      emphasis: { focus: "series" },
    })),
  };
}

// 热力图
function buildHeatmap(result: PivotResult): EChartsOption {
  const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const rowLabels = result.rowHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);

  const data: [number, number, number][] = [];
  for (let ri = 0; ri < result.cells.length; ri++) {
    for (let ci = 0; ci < (result.cells[ri]?.length ?? 0); ci++) {
      if (result.cells[ri]?.[ci] != null && result.cells[ri][ci] > 0) {
        data.push([ci, ri, result.cells[ri][ci]]);
      }
    }
  }

  const maxVal = Math.max(...data.map(d => d[2]), 1);

  return {
    tooltip: { position: "top" },
    grid: { left: "15%", right: "5%", bottom: "10%", top: "5%" },
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    xAxis: { type: "category", data: colLabels, splitArea: { show: true }, axisLabel: { rotate: colLabels.length > 12 ? 45 : 0 } },
    yAxis: { type: "category", data: rowLabels, splitArea: { show: true } },
    visualMap: { min: 0, max: maxVal, calculable: true, orient: "horizontal", left: "center", bottom: "0%" },
    series: [{ type: "heatmap", data, label: { show: result.cells.length <= 20 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" } } }],
  };
}

// 折线图
function buildLine(result: PivotResult): EChartsOption {
  const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const rowLabels = result.rowHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);

  return {
    tooltip: { trigger: "axis" },
    legend: { data: rowLabels, type: "scroll", bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    xAxis: { type: "category", data: colLabels, boundaryGap: false },
    yAxis: { type: "value" },
    series: rowLabels.map((label, i) => ({
      name: label,
      type: "line",
      data: result.cells[i] ?? [],
      areaStyle: {},    // 面积图
      smooth: true,
    })),
  };
}

// 环形图 / 玫瑰图
function buildPie(result: PivotResult, rose: boolean): EChartsOption {
  const rowLabels = result.rowHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const data = rowLabels.map((label, i) => ({ name: label, value: result.rowTotals[i] ?? 0 })).filter(d => d.value > 0);

  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 12 } },
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    series: [{
      type: "pie",
      radius: rose ? ["20%", "70%"] : ["40%", "70%"],
      center: ["50%", "45%"],
      roseType: rose ? "area" : undefined,
      itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
      label: { show: true, formatter: "{b}\n{d}%" },
      data,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.5)" } },
    }],
  };
}

// 桑基图
function buildSankey(result: PivotResult): EChartsOption {
  const rowLabels = result.rowHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const nodes = [...rowLabels.map(l => ({ name: l })), ...colLabels.map(l => ({ name: l }))];
  const links: { source: string; target: string; value: number }[] = [];
  for (let ri = 0; ri < result.cells.length; ri++) {
    for (let ci = 0; ci < (result.cells[ri]?.length ?? 0); ci++) {
      if (result.cells[ri]?.[ci] > 0) {
        links.push({ source: rowLabels[ri], target: colLabels[ci], value: result.cells[ri][ci] });
      }
    }
  }
  return {
    tooltip: { trigger: "item", triggerOn: "mousemove" },
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    series: [{ type: "sankey", layout: "none", emphasis: { focus: "adjacency" }, data: nodes, links }],
  };
}

// 雷达图
function buildRadar(result: PivotResult): EChartsOption {
  const rowLabels = result.rowHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const maxVal = Math.max(...result.rowTotals, 1);
  return {
    tooltip: {},
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    radar: { indicator: rowLabels.map(l => ({ name: l, max: maxVal })), center: ["50%", "50%"], radius: "65%" },
    series: [{ type: "radar", data: [{ value: result.rowTotals, name: "总计" }], areaStyle: { opacity: 0.3 } }],
  };
}

// 气泡图
function buildScatter(result: PivotResult): EChartsOption {
  const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const data = [];
  for (let ri = 0; ri < result.cells.length; ri++) {
    for (let ci = 0; ci < (result.cells[ri]?.length ?? 0); ci++) {
      if (result.cells[ri]?.[ci] > 0) {
        data.push([ci, result.cells[ri][ci], result.cells[ri][ci]]);
      }
    }
  }
  return {
    tooltip: { trigger: "item", formatter: (p: { value: number[] }) => `${colLabels[p.value[0]]}<br/>值: ${p.value[1]}` },
    grid: { left: "3%", right: "4%", containLabel: true },
    toolbox: { feature: { saveAsImage: { title: "保存图片" } } },
    xAxis: { type: "category", data: colLabels, axisLabel: { rotate: colLabels.length > 10 ? 45 : 0 } },
    yAxis: { type: "value" },
    series: [{ type: "scatter", symbolSize: (val: number[]) => Math.max(8, Math.min(80, val[2] * 2)), data }],
  };
}
```

### Step 7：创建 `app/analysis/page.tsx`

分析页面的路由入口：

```tsx
import type { Metadata } from "next";
import { AnalysisPage } from "@/components/analysis/AnalysisPage";

export const metadata: Metadata = {
  title: "自选维度分析 — 叶德辉书信 NER",
  description: "自选维度交叉分析叶德辉书信中的实体、事件与行为标注数据",
};

export default function AnalysisRoute() {
  return <AnalysisPage />;
}
```

### Step 8：创建 `components/analysis/AnalysisPage.tsx`

这是分析页面的主组件（客户端组件），整体三栏布局。

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { dataset } from "@/lib/data-adapter";
import { computePivot } from "@/lib/analysis/aggregator";
import { TEMPLATES } from "@/lib/analysis/dimensions";
import type { AnalysisConfig } from "@/lib/analysis/types";
import { DimensionPanel } from "@/components/analysis/DimensionPanel";
import { PivotTable } from "@/components/analysis/PivotTable";
import { ChartPanel } from "@/components/analysis/ChartPanel";
import { TemplatePicker } from "@/components/analysis/TemplatePicker";

const UNKNOWN_YEAR_COUNT = dataset.letters.filter(l => !l.year).length;

const DEFAULT_CONFIG: AnalysisConfig = {
  rowDimension: null,
  rowNested: null,
  columnDimension: null,
  columnNested: null,
  metric: "letter_count",
  filters: [],
  chartType: "bar_stacked",
  excludeUnknownYear: false,
};

export function AnalysisPage() {
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);

  const result = useMemo(() => {
    if (!config.rowDimension || !config.columnDimension) return null;
    return computePivot(config, dataset);
  }, [config]);

  const handleTemplateSelect = useCallback((templateConfig: AnalysisConfig) => {
    setConfig(templateConfig);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!result) return;
    // 将 result 转为 CSV 字符串并触发下载
    // 列头、行头、行数据、合计行
    // ……实现CSV生成逻辑……
    const csv = "请实现 CSV 生成逻辑";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "维度分析结果.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const showUnknownYearToggle = config.rowDimension === "year" || config.columnDimension === "year";

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📊 自选维度分析</h1>
            <p className="text-xs text-gray-500 mt-0.5">自选维度交叉分析叶德辉书信中的实体、事件与行为</p>
          </div>
          <div className="flex items-center gap-3">
            <TemplatePicker onSelect={handleTemplateSelect} />
            <button
              onClick={handleExportCSV}
              disabled={!result}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              导出CSV
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-gray-500 border rounded-lg hover:bg-gray-50"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* 主体三栏 */}
      <div className="max-w-[1600px] mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_1fr] gap-4">
          {/* 左栏：维度配置 */}
          <DimensionPanel
            config={config}
            onChange={setConfig}
            unknownYearCount={UNKNOWN_YEAR_COUNT}
            showUnknownYearToggle={showUnknownYearToggle}
          />

          {/* 中栏：透视表 */}
          <PivotTable result={result} config={config} loading={false} />

          {/* 右栏：图表 */}
          <div className="lg:col-span-1 xl:col-span-1">
            <ChartPanel result={result} config={config} loading={false} />
          </div>
        </div>
      </div>
    </main>
  );
}
```

### Step 9：创建 `components/analysis/DimensionPanel.tsx`

左侧维度配置面板。

```tsx
"use client";

import { DIMENSIONS, METRICS, CHART_TYPES } from "@/lib/analysis/dimensions";
import { getDimensionValues } from "@/lib/analysis/dimension-values";
import type { AnalysisConfig, DimensionId, Filter, ChartType } from "@/lib/analysis/types";
import { FilterRow } from "@/components/analysis/FilterRow";

interface DimensionPanelProps {
  config: AnalysisConfig;
  onChange: (config: AnalysisConfig) => void;
  unknownYearCount: number;
  showUnknownYearToggle: boolean;
}

let filterIdCounter = 0;

export function DimensionPanel({ config, onChange, unknownYearCount, showUnknownYearToggle }: DimensionPanelProps) {
  const update = (patch: Partial<AnalysisConfig>) => onChange({ ...config, ...patch });

  const rowDim = DIMENSIONS.find(d => d.id === config.rowDimension);
  const colDim = DIMENSIONS.find(d => d.id === config.columnDimension);

  const handleAddFilter = () => {
    const id = `filter_${++filterIdCounter}`;
    onChange({ ...config, filters: [...config.filters, { id, dimension: "recipient", operator: "equals", value: "" }] });
  };

  const handleUpdateFilter = (updated: Filter) => {
    onChange({ ...config, filters: config.filters.map(f => f.id === updated.id ? updated : f) });
  };

  const handleRemoveFilter = (id: string) => {
    onChange({ ...config, filters: config.filters.filter(f => f.id !== id) });
  };

  // 筛选当前选中图表类型是否与配置兼容
  const chartCompatible = isChartCompatible(config.chartType, config);

  return (
    <div className="bg-white border rounded-xl p-4 space-y-5 h-fit">
      <h2 className="font-semibold text-gray-700 text-sm">维度配置</h2>

      {/* 行维度 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">行维度</label>
        <select
          value={config.rowDimension ?? ""}
          onChange={e => update({ rowDimension: (e.target.value || null) as DimensionId | null, rowNested: null })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">请选择…</option>
          {DIMENSIONS.map(d => (<option key={d.id} value={d.id}>{d.label}</option>))}
        </select>
        {rowDim?.supportsNesting && (
          <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={config.rowNested === rowDim.nestableWith}
              onChange={e => update({ rowNested: e.target.checked ? rowDim.nestableWith : null })}
            />
            ▸ 展开子类型：{DIMENSIONS.find(d => d.id === rowDim.nestableWith)?.label ?? ""}
          </label>
        )}
      </div>

      {/* 列维度 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">列维度</label>
        <select
          value={config.columnDimension ?? ""}
          onChange={e => update({ columnDimension: (e.target.value || null) as DimensionId | null, columnNested: null })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">请选择…</option>
          {DIMENSIONS.map(d => (<option key={d.id} value={d.id}>{d.label}</option>))}
        </select>
        {colDim?.supportsNesting && (
          <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={config.columnNested === colDim.nestableWith}
              onChange={e => update({ columnNested: e.target.checked ? colDim.nestableWith : null })}
            />
            ▸ 展开子类型：{DIMENSIONS.find(d => d.id === colDim.nestableWith)?.label ?? ""}
          </label>
        )}
      </div>

      {/* 度量指标 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">值（度量指标）</label>
        <select
          value={config.metric}
          onChange={e => update({ metric: e.target.value as AnalysisConfig["metric"] })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          {METRICS.map(m => (<option key={m.id} value={m.id}>{m.label}</option>))}
        </select>
      </div>

      {/* 图表类型 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">图表类型</label>
        <select
          value={config.chartType}
          onChange={e => update({ chartType: e.target.value as ChartType })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          {CHART_TYPES.map(ct => (
            <option
              key={ct.id}
              value={ct.id}
              disabled={!isChartCompatible(ct.id, config)}
            >
              {ct.label}{!isChartCompatible(ct.id, config) ? "（不兼容）" : ""}
            </option>
          ))}
        </select>
        {!chartCompatible && (
          <p className="text-xs text-amber-600 mt-1">
            {config.chartType === "pie_ring" || config.chartType === "pie_rose"
              ? "环形图/玫瑰图仅适用于无列维度的情况。请移除列维度或切换图表类型。"
              : config.chartType === "radar"
              ? "雷达图适合 6–8 个行维度值以内的场景。"
              : ""}
          </p>
        )}
      </div>

      <hr className="border-gray-100" />

      {/* 筛选条件 */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-2">筛选条件</h3>
        {config.filters.length === 0 && (
          <p className="text-xs text-gray-400">暂无筛选，显示全部数据</p>
        )}
        {config.filters.map(f => (
          <FilterRow key={f.id} filter={f} onUpdate={handleUpdateFilter} onRemove={handleRemoveFilter} />
        ))}
        <button
          onClick={handleAddFilter}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          + 添加筛选
        </button>
      </div>

      {/* 未知年份开关 */}
      {showUnknownYearToggle && (
        <>
          <hr className="border-gray-100" />
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.excludeUnknownYear}
                onChange={e => update({ excludeUnknownYear: e.target.checked })}
              />
              排除无年份书信（当前 {unknownYearCount} 封）
            </label>
            <p className="text-xs text-gray-400 mt-1">勾选后，所有计算将排除年份信息缺失的书信</p>
          </div>
        </>
      )}
    </div>
  );
}

// 判断图表类型是否与当前配置兼容
function isChartCompatible(chartType: ChartType, config: AnalysisConfig): boolean {
  if ((chartType === "pie_ring" || chartType === "pie_rose") && config.columnDimension) return false;
  if (chartType === "radar" && !config.rowDimension) return false;
  return true;
}
```

### Step 10：创建 `components/analysis/PivotTable.tsx`

透视表组件。

```tsx
"use client";

import type { AnalysisConfig, PivotResult } from "@/lib/analysis/types";
import { flattenPivot } from "@/lib/analysis/aggregator";

interface PivotTableProps {
  result: PivotResult | null;
  config: AnalysisConfig;
  loading: boolean;
}

export function PivotTable({ result, config, loading }: PivotTableProps) {
  const handleCopy = () => {
    if (!result) return;
    const rows = flattenPivot(result);
    const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
    const header = [config.rowNested ? "主维度\t子维度" : "维度", ...colLabels, "合计"].join("\t");
    const body = rows.map(r =>
      [r.mainLabel, r.subLabel ?? "", ...r.values.map(v => v.toString()), r.total.toString()].join("\t")
    ).join("\n");
    const totalRow = ["合计", "", ...result.columnTotals.map(v => v.toString()), result.grandTotal.toString()].join("\t");
    navigator.clipboard.writeText([header, body, totalRow].join("\n")).then(() => alert("已复制到剪贴板"));
  };

  // 加载状态
  if (loading) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // 空状态（未选择维度）
  if (!result || !config.rowDimension || !config.columnDimension) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center">
        <p className="text-gray-400 text-lg mb-2">📋</p>
        <p className="text-gray-500">请选择行维度和列维度开始分析</p>
        <p className="text-xs text-gray-400 mt-1">或从上方"预设模板"中选择一个快速开始</p>
      </div>
    );
  }

  // 空状态（无数据）
  if (result.rowHeaders.length === 0 || result.columnHeaders.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center">
        <p className="text-gray-400 text-lg mb-2">🔍</p>
        <p className="text-gray-500">没有匹配的数据</p>
        <p className="text-xs text-gray-400 mt-1">请尝试调整维度或筛选条件</p>
      </div>
    );
  }

  const rows = flattenPivot(result);
  const colLabels = result.columnHeaders.flatMap(h => h.children?.map(c => `${h.label}·${c.label}`) ?? [h.label]);
  const hasNested = rows.some(r => r.subLabel !== null);

  // 计算单元格的最大值用于热力着色
  const maxCell = Math.max(...result.cells.flat(), 1);

  return (
    <div className="bg-white border rounded-xl overflow-hidden flex flex-col h-fit">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-700 text-sm">📋 数据透视表</h2>
        <button onClick={handleCopy} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">
          复制表格
        </button>
      </div>
      <div className="overflow-auto max-h-[65vh]">
        <table className="w-full text-sm border-collapse">
          {/* 列头 */}
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-gray-100 px-3 py-2 text-left font-medium border-b whitespace-nowrap" rowSpan={result.columnHeaders[0]?.children ? 2 : 1}>
                {hasNested ? "主维度" : "维度"}
              </th>
              {hasNested && (
                <th className="sticky top-0 left-0 z-20 bg-gray-100 px-3 py-2 text-left font-medium border-b whitespace-nowrap" rowSpan={result.columnHeaders[0]?.children ? 2 : undefined}>
                  子维度
                </th>
              )}
              {result.columnHeaders.map((ch, ci) => {
                if (ch.children && ch.children.length > 0) {
                  return (
                    <th key={ci} className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-center font-medium border-b" colSpan={ch.children.length}>
                      {ch.label}
                    </th>
                  );
                }
                return (
                  <th key={ci} className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-center font-medium border-b whitespace-nowrap" rowSpan={2}>
                    {ch.label}
                  </th>
                );
              })}
              <th className="sticky top-0 z-10 bg-gray-100 px-3 py-2 text-center font-bold border-b" rowSpan={2}>合计</th>
            </tr>
            {/* 子列头 */}
            {result.columnHeaders.some(h => h.children && h.children.length > 0) && (
              <tr>
                {result.columnHeaders.flatMap((ch, ci) =>
                  (ch.children ?? []).map((sub, si) => (
                    <th key={`${ci}-${si}`} className="sticky top-8 z-10 bg-gray-50 px-3 py-1.5 text-center text-xs font-normal text-gray-600 border-b whitespace-nowrap">
                      {sub.label}
                    </th>
                  ))
                )}
              </tr>
            )}
          </thead>

          {/* 数据行 */}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                {ri === 0 || row.mainLabel !== rows[ri - 1]?.mainLabel ? (
                  <td
                    className={`sticky left-0 z-10 px-3 py-1.5 font-medium border-b whitespace-nowrap ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                    rowSpan={hasNested ? rows.filter(r => r.mainLabel === row.mainLabel).length : 1}
                  >
                    {row.mainLabel}
                  </td>
                ) : null}
                {hasNested && (
                  <td className={`sticky left-[120px] z-10 px-3 py-1.5 text-xs text-gray-600 border-b whitespace-nowrap ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    {row.subLabel}
                  </td>
                )}
                {row.values.map((val, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-1.5 text-center border-b tabular-nums"
                    style={{
                      backgroundColor: val > 0 ? `rgba(91, 121, 141, ${Math.max(0.04, val / maxCell * 0.18).toFixed(2)})` : undefined,
                    }}
                  >
                    {val > 0 ? val.toLocaleString("zh-CN") : "—"}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center font-bold border-b tabular-nums">{row.total > 0 ? row.total.toLocaleString("zh-CN") : "—"}</td>
              </tr>
            ))}

            {/* 合计行 */}
            <tr className="bg-gray-100 font-bold">
              <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 border-t" colSpan={hasNested ? 2 : 1}>合计</td>
              {result.columnTotals.map((val, ci) => (
                <td key={ci} className="px-3 py-2 text-center border-t tabular-nums">{val > 0 ? val.toLocaleString("zh-CN") : "—"}</td>
              ))}
              <td className="px-3 py-2 text-center border-t tabular-nums">{result.grandTotal.toLocaleString("zh-CN")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t text-xs text-gray-400">
        共 {result.rowHeaders.length} 行 × {result.columnHeaders.length} 列
      </div>
    </div>
  );
}
```

### Step 11：创建 `components/analysis/ChartPanel.tsx`

图表面板。

```tsx
"use client";

import { useMemo } from "react";
import type { AnalysisConfig, PivotResult } from "@/lib/analysis/types";
import { buildChartOption } from "@/lib/analysis/echarts-builder";
import ReactECharts from "echarts-for-react";

interface ChartPanelProps {
  result: PivotResult | null;
  config: AnalysisConfig;
  loading: boolean;
}

export function ChartPanel({ result, config, loading }: ChartPanelProps) {
  const option = useMemo(() => {
    if (!result) return null;
    return buildChartOption(config, result);
  }, [result, config]);

  if (loading) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto" />
      </div>
    );
  }

  if (!result || !option) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center">
        <p className="text-gray-400 text-lg mb-2">📈</p>
        <p className="text-gray-500">选择维度和度量后，图表将在右侧呈现</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden h-fit">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-gray-700 text-sm">📈 图表</h2>
      </div>
      <div className="p-2">
        <ReactECharts
          option={option}
          style={{ height: "480px", width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
}
```

### Step 12：创建 `components/analysis/FilterRow.tsx`

单条筛选条件行。

```tsx
"use client";

import { DIMENSIONS } from "@/lib/analysis/dimensions";
import { getDimensionValues, getOperatorsForDimension } from "@/lib/analysis/dimension-values";
import type { Filter, DimensionId, FilterOperator } from "@/lib/analysis/types";

interface FilterRowProps {
  filter: Filter;
  onUpdate: (filter: Filter) => void;
  onRemove: (id: string) => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "=",
  not_equals: "≠",
  in: "⊂",
  not_in: "⊄",
  between: "∈",
};

export function FilterRow({ filter, onUpdate, onRemove }: FilterRowProps) {
  const operators = getOperatorsForDimension(filter.dimension);
  const values = getDimensionValues(filter.dimension);

  return (
    <div className="flex items-center gap-2 mb-2 text-sm">
      {/* 维度选择 */}
      <select
        value={filter.dimension}
        onChange={e => onUpdate({ ...filter, dimension: e.target.value as DimensionId, operator: "equals", value: "" })}
        className="border rounded px-2 py-1 text-xs flex-1"
      >
        {DIMENSIONS.map(d => (<option key={d.id} value={d.id}>{d.label}</option>))}
      </select>

      {/* 运算符选择 */}
      <select
        value={filter.operator}
        onChange={e => onUpdate({ ...filter, operator: e.target.value as FilterOperator, value: "" })}
        className="border rounded px-2 py-1 text-xs w-14"
      >
        {operators.map(op => (<option key={op} value={op}>{OPERATOR_LABELS[op]}</option>))}
      </select>

      {/* 值选择 */}
      {filter.operator === "between" ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            type="text"
            placeholder="起始"
            value={Array.isArray(filter.value) ? filter.value[0] ?? "" : ""}
            onChange={e => {
              const prev = Array.isArray(filter.value) ? filter.value : ["", ""];
              onUpdate({ ...filter, value: [e.target.value, prev[1] ?? ""] });
            }}
            className="border rounded px-2 py-1 text-xs w-full"
          />
          <span className="text-gray-400">—</span>
          <input
            type="text"
            placeholder="结束"
            value={Array.isArray(filter.value) ? filter.value[1] ?? "" : ""}
            onChange={e => {
              const prev = Array.isArray(filter.value) ? filter.value : ["", ""];
              onUpdate({ ...filter, value: [prev[0] ?? "", e.target.value] });
            }}
            className="border rounded px-2 py-1 text-xs w-full"
          />
        </div>
      ) : filter.operator === "in" || filter.operator === "not_in" ? (
        <select
          multiple
          value={Array.isArray(filter.value) ? filter.value : []}
          onChange={e => {
            const selected = Array.from(e.target.selectedOptions, o => o.value);
            onUpdate({ ...filter, value: selected });
          }}
          className="border rounded px-2 py-1 text-xs flex-1 max-h-24"
        >
          {values.map(v => (<option key={v.value} value={v.value}>{v.label}{v.count != null ? ` (${v.count})` : ""}</option>))}
        </select>
      ) : (
        <select
          value={typeof filter.value === "string" ? filter.value : ""}
          onChange={e => onUpdate({ ...filter, value: e.target.value })}
          className="border rounded px-2 py-1 text-xs flex-1"
        >
          <option value="">选择值…</option>
          {values.map(v => (<option key={v.value} value={v.value}>{v.label}{v.count != null ? ` (${v.count})` : ""}</option>))}
        </select>
      )}

      {/* 删除按钮 */}
      <button
        onClick={() => onRemove(filter.id)}
        className="text-red-400 hover:text-red-600 text-xs px-1"
        title="删除此筛选"
      >
        ×
      </button>
    </div>
  );
}
```

### Step 13：创建 `components/analysis/TemplatePicker.tsx`

模板选择器（下拉菜单）。

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { TEMPLATES } from "@/lib/analysis/dimensions";
import type { AnalysisConfig } from "@/lib/analysis/types";

interface TemplatePickerProps {
  onSelect: (config: AnalysisConfig) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1"
      >
        预设模板 ▾
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-white border rounded-xl shadow-lg z-50 w-72 py-2">
          <p className="px-4 py-1 text-xs text-gray-400">选择一个预设分析模板快速开始</p>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => { onSelect(t.config); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm"
            >
              <span className="text-lg">{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 14：修改 `components/SiteHeader.tsx`

在导航链接中新增"维度分析"入口。找到导航链接列表（在 `<nav>` 元素中），在 `/topics`（实体分类检索）之后添加：

```tsx
<Link href="/analysis" className="…匹配现有class…">维度分析</Link>
```

> 请阅读现有的 `SiteHeader.tsx` 文件，确保新增链接的 className 和结构与现有导航链接完全一致。

### Step 15：创建 `lib/analysis/templates.ts`

（如果后续需要模板相关的工具函数，可在这里扩展）

```typescript
export { TEMPLATES } from "./dimensions";
```

---

## 四、样式规范

- 使用 Tailwind CSS 4 类名
- 卡片风格：`bg-white border rounded-xl shadow-sm`
- 主色调：与现有 `annotationStyles` 保持一致
- 文本：`text-gray-900`（主）、`text-gray-700`（次）、`text-gray-500`（辅助）、`text-gray-400`（禁用）
- 表格：紧凑 `text-sm`，奇数行微灰 `bg-gray-50/50`
- 热力着色：`rgba(91, 121, 141, opacity)` — 值越大背景色越深

---

## 五、边界情况 Checklist

- [ ] 未选择行/列维度 → 显示引导提示
- [ ] 数据为空（筛选后无匹配）→ 显示"没有匹配的数据"
- [ ] 维度值 > 100 且非 heatmap → 图表区提示"建议切换热力图或缩小范围"
- [ ] 376 个实体 in 搜索 → debounce 200ms
- [ ] 76 封无年份书信 → 显示"未知"类别 + 排除开关
- [ ] 聚合计算使用 useMemo，避免不必要重算
- [ ] 图表不兼容提示（如 pie 图但选了列维度）
- [ ] 筛选 between 的 min/max 校验
- [ ] CSV 导出使用 UTF-8 BOM（Excel 不乱码）
- [ ] 透视表单元格值 > 0 才着热力色

---

## 六、关键约束

1. **不引入后端 API**：所有计算纯客户端，数据来自 `@/lib/data-adapter`
2. **保持现有代码风格**：参考 `components/TopicsPage.tsx`、`components/CategoryIndexPage.tsx` 的写法
3. **TypeScript 严格**：所有函数和组件完整类型定义
4. **中文优先**：所有 UI 文字
5. **ECharts 按需引入**：已在 echarts-builder.ts 中注册所需组件
6. **文件命名**：组件文件用 PascalCase（如 `AnalysisPage.tsx`），库文件用 kebab-case（如 `aggregator.ts`）

---

## 七、文件清单

### 新建（13 个）

```
lib/analysis/types.ts              — 分析类型定义
lib/analysis/dimensions.ts         — 维度/度量/模板定义
lib/analysis/dimension-values.ts   — 维度值提取函数
lib/analysis/aggregator.ts         — 交叉聚合计算引擎
lib/analysis/echarts-builder.ts    — ECharts option 构建器
lib/analysis/templates.ts          — 模板导出
app/analysis/page.tsx              — 路由入口
components/analysis/AnalysisPage.tsx    — 主组件
components/analysis/DimensionPanel.tsx  — 维度配置面板
components/analysis/PivotTable.tsx      — 透视表
components/analysis/ChartPanel.tsx      — 图表面板
components/analysis/FilterRow.tsx       — 筛选条件行
components/analysis/TemplatePicker.tsx  — 模板选择器
```

### 修改（2 个）

```
components/SiteHeader.tsx           — 导航新增"维度分析"
package.json                        — 新增 echarts, echarts-for-react 依赖
```

---

> **最后提醒 Codex**：
> 1. 请先完整阅读本文件，理清所有文件之间的 import 关系再开始编码
> 2. `aggregator.ts` 是核心计算引擎，其内部辅助函数（`extractDimensionValueFromLetter`、`getDimensionValuesForAxis`、`getCellIndices`、`matchesFilter`）的实际逻辑直接决定了整个分析功能正确与否，请特别注意各维度类型的不同处理方式
> 3. 如果某一处的实现细节不清楚，先参考 `lib/data-adapter.ts`、`lib/types.ts`、`lib/config.ts` 这几个文件的实际内容再动手
> 4. 确保所有 import 路径正确（`@/lib/...` 或 `@/components/...`）
