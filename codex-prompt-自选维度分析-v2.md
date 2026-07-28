# 自选维度分析 V2 — Codex 完整实现规范

> 本文档是给 Codex 的实现规范。**请完整阅读后再动手。**  
> 本次为 V2 重构，核心改动：维度平铺勾选、全中文化、上下滚动布局、行列自动分配+手动可调。

---

## 一、项目环境

| 项目 | 值 |
|------|-----|
| 项目路径 | `ye-annotation-site/` |
| 框架 | Next.js 16.2.6 (App Router) |
| UI | React 19.2.6 + Tailwind CSS 4.2.1 |
| 语言 | TypeScript 5.9.3 |
| 包管理 | npm |
| 数据 | 静态 JSON（约 8MB），通过 `@/lib/data-adapter` 导入 `dataset` 对象，纯客户端计算 |
| 图表库 | ECharts 5 + echarts-for-react（**导入路径 `echarts-for-react/esm/core`**） |
| 构建工具 | Vite（通过 vinext） |
| CSS 变量 | 项目使用 CSS 自定义属性，如 `var(--line)`、`var(--ink)`、`var(--muted)`、`var(--purple)`、`var(--surface)`、`var(--paper)`、`var(--green)`、`var(--purple-deep)`、`var(--purple-pale)`、`var(--font-serif)`、`var(--line-dark)` 等。**请先阅读 `app/globals.css` 确认所有可用变量。** |

---

## 二、数据模型

数据来自 `import { dataset } from "@/lib/data-adapter"`，类型定义在 `lib/types.ts`。

```typescript
interface Dataset {
  letters: Letter[];                              // 306 封
  entitiesByLetter: Record<string, EntityMention[]>;
  eventsByLetter: Record<string, EventMention[]>;
  actsByLetter: Record<string, ActMention[]>;
  entityCatalog: EntityCatalogEntry[];            // 3378 个规范实体
  entityStats: Record<EntityType, { canonicalCount; mentionCount; letterCount }>;
  eventStats: Record<EventType, { eventCount; letterCount }>;
  actStats: Record<ActType, { paragraphCount; letterCount }>;
}

interface Letter {
  id: string;          // "001_1923_易培基"
  number: string;
  year: string | null; // "1894"–"1926" 或 null（76封无年份）
  recipient: string;
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
  canonical: string;
  aliases: string[];
  subtypes: string[];    // 如 "PER-CONTEMPORARY", "LOC-ADM1", "BOK-CLASSICS"
  count: number;
  letterIds: string[];
}
```

### 关键配置文件（`lib/config.ts`、`lib/topic-config.ts`）

- `entityTypeMeta` — `{ PER: { label: "人物" }, LOC: { label: "地点" }, … }`
- `eventTypeMeta` — `{ BIB: { label: "文献活动" }, ACA: { label: "学术活动" }, … }`
- `actTypeMeta` — `{ REQ: { label: "请求" }, DSP: { label: "展示" }, … }`
- `getSecondaryCategories(entityCode)` — 返回某实体类型的所有二级分类，如 `getSecondaryCategories("PER")` 返回 `[{ code: "PER-CONTEMPORARY", label: "同时代人" }, …]`
- `annotationStyles` — 所有实体/事件/行为的颜色定义

---

## 三、现有文件（需要重写/修改）

以下文件已存在，需要根据 V2 设计**重写**：

```
lib/analysis/types.ts          — 类型定义（需调整）
lib/analysis/dimensions.ts     — 维度元数据（需大幅修改，加入二级子类型）
lib/analysis/dimension-values.ts — 维度值提取函数（需更新）
lib/analysis/aggregator.ts     — 聚合引擎（大概率可复用，接口可能微调）
lib/analysis/echarts-builder.ts — ECharts option 构建器（可复用，微调）
components/analysis/AnalysisPage.tsx    — 主页面（需重写布局）
components/analysis/DimensionPanel.tsx  — 维度面板（需重写为平铺勾选式）
components/analysis/PivotTable.tsx      — 透视表（可复用，微调布局）
components/analysis/ChartPanel.tsx      — 图表面板（可复用，微调布局 + 修复导入路径）
components/analysis/FilterRow.tsx       — 筛选行（可复用）
components/analysis/TemplatePicker.tsx  — 模板选择器（修改按钮样式）
app/analysis/page.tsx                   — 路由入口（可复用）
components/SiteHeader.tsx               — 导航（已有"维度分析"链接）
```

---

## 四、全局样式修正

### 4.1 滚动条改细

在 `app/globals.css` 中添加或修改：

```css
/* 全局细滚动条 */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #c5bfc9;
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover {
  background: #9a949a;
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #c5bfc9 transparent;
}
```

### 4.2 预设模板按钮

紫色背景 + 白色文字：

```html
<button class="h-9 border border-[var(--purple)] bg-[var(--purple)] px-3 text-[11px] text-white transition hover:bg-[var(--purple-deep)]">
  预设模板 ▾
</button>
```

确保 `text-white` 或直接用固定值 `color: #fff`。

### 4.3 字体统一

分析页面所有文字字体与项目其他页面保持一致，使用项目全局定义的 CSS 变量/字体族（`font-[var(--font-serif)]` 用于标题，正文使用系统默认或 CSS 变量定义的字体）。**不要引入新的字体**。

---

## 五、页面整体结构（上下滚动式）

```
┌──────────────────────────────────────────────────┐
│  主导航（SiteHeader）                              │
├──────────────────────────────────────────────────┤
│                                                  │
│  📊 自选维度分析                      [预设模板▼]  │  ← 紫色底白字
│  交叉观察书信中的实体、事件与行为标注      [重置]   │
│                                                  │
│  ╔══════════════════════════════════════════╗    │
│  ║  默认展示区（留空占位）                   ║    │  ← 你手动做的图表/
│  ║  此处先放一个占位区块，后续替换           ║    │    表格放这里
│  ║  "精选分析视图，即将呈现" 之类的占位文    ║    │
│  ╚══════════════════════════════════════════╝    │
│                                                  │
│  ─────── 想自己探索？勾选维度开始分析 ───────     │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  【时间】                                 │    │
│  │  ☐ 年份    ☐ 时期（晚清 / 民初）          │    │
│  │                                          │    │
│  │  【人物】                                 │    │
│  │  ☐ 收信人                                │    │
│  │                                          │    │
│  │  【实体类型】                             │    │
│  │  ☐ 人物（PER）                           │    │
│  │    ☐ 叶德辉本人   ☐ 收信人               │    │  ← 勾了"人物"后展开
│  │    ☐ 同时代人     ☐ 叶氏家族             │    │
│  │    ☐ 日本人士     ☐ 历史人物   ☐ 待考    │    │
│  │  ☐ 地点（LOC）                           │    │
│  │    （勾了"地点"后展开子类型）              │    │
│  │  ☐ 书籍（BOK）                           │    │
│  │    （勾了"书籍"后展开子类型）              │    │
│  │  ☐ 版本（VER） ☐ 时间（TIM）             │    │
│  │  ☐ 官职（OFF） ☐ 机构（ORG）             │    │
│  │  ☐ 亲属（KIN） ☐ 星命（AST）             │    │
│  │                                          │    │
│  │  【事件类型】                             │    │
│  │  ☐ 文献活动  ☐ 学术活动  ☐ 社会交往      │    │
│  │  ☐ 政治时局  ☐ 家族事务                  │    │
│  │                                          │    │
│  │  【行为类型】                             │    │
│  │  ☐ 请求  ☐ 展示  ☐ 告知  ☐ 赞扬         │    │
│  │  ☐ 维系  ☐ 训导  ☐ 协商                 │    │
│  │                                          │    │
│  │  ───────────────────────────────         │    │
│  │  筛选条件（可选）                         │    │
│  │  [收信人 = 松崎鹤雄] [×]                 │    │
│  │  [+ 添加筛选]                            │    │
│  │  ☐ 排除无年份书信（76封）                 │    │
│  │                                          │    │
│  │  已选维度：                               │    │
│  │  [人物 ×] [年份 ×] [书籍子类型 ×]        │    │
│  │                                          │    │
│  │  列 [年份 ▾]   行 [人物 ▾]               │    │
│  │                                          │    │
│  │  图表类型 [堆叠柱状图 ▾]                  │    │
│  │                                          │    │
│  │  [🔍 开始分析]                            │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ═══════════ 分析结果 ════════════════          │  ← 点"开始分析"后出现
│                                                  │
│  ┌─────────────────┐ ┌──────────────────┐       │
│  │ 📋 数据透视表     │ │ 📈 图表           │       │  ← 左右排列
│  │                  │ │                  │       │
│  │ [复制表格]       │ │ [柱状图 ▼]       │       │
│  │ [导出CSV]        │ │ [📷 导出图片]    │       │
│  │                  │ │                  │       │
│  └─────────────────┘ └──────────────────┘       │
│                                                  │
│  （用户改了维度再点"开始分析" → 下方结果替换）     │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 六、维度体系（全中文）

### 6.1 维度树结构

这是维度的完整中文显示树。**所有标签只用中文，二级子类型只在用户勾选了一级后展开**。

```typescript
// 维度树的定义，用于渲染勾选区
interface DimensionTreeNode {
  key: string;              // 内部 ID，如 "entity_type:PER"
  label: string;            // 显示文字，纯中文："人物（PER）"
  category: string;         // 分组："时间" | "人物" | "实体类型" | "事件类型" | "行为类型"
  level: "parent" | "child";
  parentKey?: string;       // 子类型的父级 key
}
```

维度树（按分组平铺）：

**时间**
- ☐ 年份
- ☐ 时期（晚清 / 民初）

**人物**
- ☐ 收信人

**实体类型**（勾选后展开子类型）
- ☐ 人物（PER）
  - ☐ 叶德辉本人
  - ☐ 收信人
  - ☐ 同时代人
  - ☐ 叶氏家族
  - ☐ 日本人士
  - ☐ 历史人物
  - ☐ 待考
- ☐ 地点（LOC）
  - ☐ 国家
  - ☐ 省 / 省级
  - ☐ 府 / 州 / 县级
  - ☐ 城市
  - ☐ 街道 / 具体地点
  - ☐ 地区 / 模糊区域
  - ☐ 山岳
  - ☐ 水体
  - ☐ 设施 / 建筑
- ☐ 书籍（BOK）
  - ☐ 经部
  - ☐ 史部
  - ☐ 子部
  - ☐ 集部
  - ☐ 今人著作
  - ☐ 工具书
  - ☐ 先祖著作
- ☐ 版本（VER）
  - ☐ 宋本 / 宋刻
  - ☐ 元本 / 元刻
  - ☐ 明本 / 明刻
  - ☐ 清本 / 清刻
  - ☐ 刻本 / 刊本
  - ☐ 抄本 / 稿本 / 写本
  - ☐ 活字本 / 排印本
  - ☐ 拓本 / 碑帖
  - ☐ 影印本 / 石印本
  - ☐ 版本状态
  - ☐ 和刻本
- ☐ 时间（TIM）
  - ☐ 相对时间
  - ☐ 绝对时间
  - ☐ 时段 / 频率
  - ☐ 历史时期
- ☐ 官职（OFF）
  - ☐ 中央文官
  - ☐ 地方官
  - ☐ 武职
  - ☐ 学官 / 文教
  - ☐ 民国新职
  - ☐ 外交 / 涉外
- ☐ 机构（ORG）
  - ☐ 出版 / 书店
  - ☐ 图书馆 / 藏书机构
  - ☐ 学校 / 书院
  - ☐ 政府 / 衙门
  - ☐ 政党 / 派系
  - ☐ 公司 / 银行
  - ☐ 书斋 / 堂号
- ☐ 亲属（KIN）
  - ☐ 祖先 / 先世
  - ☐ 子孙 / 后嗣
  - ☐ 父系 / 宗族
  - ☐ 姻亲 / 婚姻
  - ☐ 家族合称
- ☐ 星命（AST）
  - ☐ 五行 / 干支
  - ☐ 星宿 / 星次
  - ☐ 命理 / 八字
  - ☐ 易学 / 占卜
  - ☐ 杂占 / 风水

**事件类型**
- ☐ 文献活动
- ☐ 学术活动
- ☐ 社会交往
- ☐ 政治时局
- ☐ 家族事务

**行为类型**
- ☐ 请求
- ☐ 展示
- ☐ 告知
- ☐ 赞扬
- ☐ 维系
- ☐ 训导
- ☐ 协商

### 6.2 维度 key 映射

勾选区的显示标签 vs 内部 key 对照（用于传给 aggregator）：

| 显示标签 | 内部维度 key | 类型 |
|---------|-------------|------|
| 年份 | `year` | 独立维度 |
| 时期 | `period` | 独立维度 |
| 收信人 | `recipient` | 独立维度 |
| 人物（PER） | `entity_type:PER` | 实体类型 |
| 同时代人 | `entity_subtype:PER-CONTEMPORARY` | 实体子类型 |
| 地点（LOC） | `entity_type:LOC` | 实体类型 |
| 省 / 省级 | `entity_subtype:LOC-ADM1` | 实体子类型 |
| 书籍（BOK） | `entity_type:BOK` | 实体类型 |
| 经部 | `entity_subtype:BOK-CLASSICS` | 实体子类型 |
| …等等 | … | … |
| 文献活动 | `event_type:BIB` | 事件类型 |
| 请求 | `act_type:REQ` | 行为类型 |

### 6.3 代码实现：维度树定义（放在 `lib/analysis/dimensions.ts`）

```typescript
// 维度分组
export interface DimensionGroup {
  category: string;       // "时间" | "人物" | "实体类型" | "事件类型" | "行为类型"
  items: DimensionItem[];
}

export interface DimensionItem {
  key: string;            // 内部 ID
  label: string;          // 显示文字，纯中文
  children?: DimensionItem[];  // 二级子维度
}

// 示例：
export const DIMENSION_GROUPS: DimensionGroup[] = [
  {
    category: "时间",
    items: [
      { key: "year", label: "年份" },
      { key: "period", label: "时期（晚清 / 民初）" },
    ],
  },
  {
    category: "人物",
    items: [
      { key: "recipient", label: "收信人" },
    ],
  },
  {
    category: "实体类型",
    items: [
      {
        key: "entity_type:PER", label: "人物（PER）",
        children: [
          { key: "entity_subtype:PER-SELF", label: "叶德辉本人" },
          { key: "entity_subtype:PER-ADDRESSEE", label: "收信人" },
          { key: "entity_subtype:PER-CONTEMPORARY", label: "同时代人" },
          { key: "entity_subtype:PER-FAMILY", label: "叶氏家族" },
          { key: "entity_subtype:PER-JAPANESE", label: "日本人士" },
          { key: "entity_subtype:PER-HISTORICAL", label: "历史人物" },
          { key: "entity_subtype:PER-AMBIG", label: "待考" },
        ],
      },
      {
        key: "entity_type:LOC", label: "地点（LOC）",
        children: [
          { key: "entity_subtype:LOC-ADM0", label: "国家" },
          { key: "entity_subtype:LOC-ADM1", label: "省 / 省级" },
          // ……其他 LOC 子类型，从 getSecondaryCategories("LOC") 获取
        ],
      },
      // ……BOK, VER, TIM, OFF, ORG, KIN, AST 同上，全部从 getSecondaryCategories() 获取数据
    ],
  },
  {
    category: "事件类型",
    items: [
      { key: "event_type:BIB", label: "文献活动" },
      { key: "event_type:ACA", label: "学术活动" },
      { key: "event_type:SOC", label: "社会交往" },
      { key: "event_type:POL", label: "政治时局" },
      { key: "event_type:FAM", label: "家族事务" },
    ],
  },
  {
    category: "行为类型",
    items: [
      { key: "act_type:REQ", label: "请求" },
      { key: "act_type:DSP", label: "展示" },
      { key: "act_type:INF", label: "告知" },
      { key: "act_type:PRS", label: "赞扬" },
      { key: "act_type:MNT", label: "维系" },
      { key: "act_type:INS", label: "训导" },
      { key: "act_type:NEG", label: "协商" },
    ],
  },
];
```

> **Codex 注意**：实体类型的子维度（children）应从 `getSecondaryCategories()` 动态生成，不要硬编码。上面的硬编码只是示例格式。请在运行时调用 `getSecondaryCategories(code)` 填充 children。

---

## 七、交互逻辑

### 7.1 勾选 → 已选维度展示

- 用户勾选任意维度（父级或子级），页面不需要自动计算
- 勾选后，在维度勾选区下方显示"已选维度"标签行：

```
已选维度：[人物 ×] [年份 ×] [同时代人 ×] [经部 ×]
```

- 点击标签上的 × 可取消勾选（同步取消上方 checkbox）
- 如果取消了父级，其所有子级也自动取消

### 7.2 行列自动分配规则

用户勾选维度后，系统按以下规则自动分配行列：

1. **恰好 2 个维度被选中**（不含子类型）：
   - 时间为列，分类为行
   - 如果都是分类维度，第一个勾的为行、第二个勾的为列
2. **勾了 3 个及以上**：
   - 前两个（按勾选顺序）分配为行和列
   - 其余自动加入筛选区（在结果上方以筛选标签展示）
3. **只勾了 1 个**：
   - 仅行维度（适合饼图/柱状图分布展示）

用户可手动调整：行列区域提供下拉菜单，用户点击即可切换。

### 7.3 行列调整 UI

```
列 [年份 ▾]    行 [人物 ▾]

其余维度将作为筛选条件：[同时代人] [经部]
```

- 下拉菜单中列出所有已选维度
- 已在行/列中的维度在下拉中灰显
- 切换后自动更新分配

### 7.4 "开始分析"按钮

- 至少勾选 1 个维度时按钮可用，否则灰显
- 点击后：
  - 页面平滑滚动到分析结果区域（`scrollIntoView({ behavior: "smooth" })`）
  - 如果之前已有结果，用新结果替换（不是追加）
  - 上方的默认展示区始终不变

### 7.5 图表类型切换

分析结果区图表右上角有下拉菜单切换图表类型：

```
[堆叠柱状图 ▾] [📷 导出图片]
```

- 如果当前配置不兼容某图表类型（如饼图必须无列维度），在下拉中灰显该选项并标注原因
- 切换后图表实时更新，透视表保持不变

---

## 八、保留功能

以下功能从 V1 保留，逻辑不变：

| 功能 | 位置 | 说明 |
|------|------|------|
| 复制表格 | 透视表工具栏 | 复制为 TSV 到剪贴板 |
| 导出 CSV | 透视表工具栏 | UTF-8 BOM，Excel 直接打开 |
| 导出图表图片 | 图表工具栏 | ECharts 原生 `saveAsImage` |
| 预设模板 | 页面右上角 | 点击自动勾选维度 + 开始分析 |
| 图表类型切换 | 图表工具栏 | 下拉菜单 |
| 筛选条件 | 维度勾选区下方 | 多筛选 AND 逻辑 |
| 排除无年份 | 筛选区域 | 勾选后剔除 `year===null` 书信 |
| 重置 | 页面右上角 | 清空所有勾选和结果 |

---

## 九、核心计算引擎适配（`aggregator.ts`）

V1 的 `computePivot` 需要微调以适配新的维度 key 格式。

### 新维度 key → 数据提取逻辑

| key 前缀 | 提取逻辑 |
|----------|---------|
| `year` | `letter.year`（null → "未知"） |
| `period` | year ≤1911 → "晚清"；≥1912 → "民初"；null → "未知时期" |
| `recipient` | `letter.recipient` |
| `entity_type:PER` | `entitiesByLetter[letterId]` 中 type==="PER" 的 mention 数 > 0 |
| `entity_subtype:PER-CONTEMPORARY` | `entityCatalog` 中 subtype="PER-CONTEMPORARY" 的实体被 mention 到 |
| `event_type:BIB` | `eventsByLetter[letterId]` 中 type==="BIB" 的 event 数 > 0 |
| `act_type:REQ` | `actsByLetter[letterId]` 中 type==="REQ" 的 act 数 > 0 |

一条书信可以匹配多个维度值（同时包含 PER 和 LOC 实体 → 在 "人物" 和 "地点" 两个格子各算 1）。

---

## 十、文件修改清单

### 需要重写的文件

| 文件 | 改动 |
|------|------|
| `app/globals.css` | 添加细滚动条样式 |
| `lib/analysis/types.ts` | 调整 AnalysisConfig：`selectedDimensions: string[]` 替代 `rowDimension/columnDimension`，新增 `rowKey`/`columnKey` 字段 |
| `lib/analysis/dimensions.ts` | 重写为维度树定义 + DIMENSION_GROUPS 导出 |
| `components/analysis/AnalysisPage.tsx` | 重写布局：默认展示区 → 维度勾选区 → 结果区（上下滚动） |
| `components/analysis/DimensionPanel.tsx` | 重写为平铺勾选 + 已选标签 + 行列调整 + 开始分析按钮 |
| `components/analysis/ChartPanel.tsx` | 修复导入路径 `echarts-for-react/esm/core`；确保白色文字 |
| `components/analysis/TemplatePicker.tsx` | 按钮样式：紫色背景白色文字 |

### 需要微调的文件

| 文件 | 改动 |
|------|------|
| `lib/analysis/aggregator.ts` | 适配新的维度 key 格式 |
| `lib/analysis/echarts-builder.ts` | 微调配色/字体与全局一致 |
| `components/analysis/PivotTable.tsx` | 微调布局以适配左右排列 |

### 不需要改动的文件

| 文件 | 原因 |
|------|------|
| `app/analysis/page.tsx` | 入口不变 |
| `lib/analysis/dimension-values.ts` | 逻辑可复用 |
| `lib/analysis/templates.ts` | 模板逻辑可复用 |
| `components/analysis/FilterRow.tsx` | 筛选组件可复用 |
| `components/SiteHeader.tsx` | 已有"维度分析"链接 |

---

## 十一、关键实现细节

### 11.1 默认展示区占位

在 `AnalysisPage.tsx` 顶部放一个占位区块，先用简单的卡片 + 占位文字：

```tsx
<section className="border border-[var(--line)] bg-[var(--surface)] p-10 text-center">
  <p className="font-[var(--font-serif)] text-lg text-[var(--ink)]">精选分析视图</p>
  <p className="mt-2 text-sm text-[var(--muted)]">即将呈现，敬请期待</p>
</section>
```

后续替换为你手做的图表。

### 11.2 分析结果"替换而非追加"

用 state 管理分析结果。每次点击"开始分析"，更新同一个 state，结果区域自然替换。

### 11.3 平滑滚动

```typescript
document.getElementById("analysis-results")?.scrollIntoView({ behavior: "smooth" });
```

### 11.4 二级子类型动画

用 CSS `max-height` transition 或 Tailwind 的 `overflow-hidden transition-all` 实现子类型展开/收起的平滑动画。

### 11.5 字体一致性

- 标题：使用 `font-[var(--font-serif)]`（与项目其他页面一致）
- 正文：使用项目全局字体（通常 Tailwind 默认或 CSS 变量定义）
- **不要引入 Google Fonts 或其他外部字体**

---

## 十二、ECharts 导入路径警告

**`echarts-for-react` 必须导入 ESM 版本**：

```typescript
// ✅ 正确
import ReactEChartsCore from "echarts-for-react/esm/core";

// ❌ 错误 — Vite CJS 互操作会导致 "Element type is invalid: got object"
// import ReactEChartsCore from "echarts-for-react/lib/core";
```

---

## 十三、边界情况 Checklist

- [ ] 未勾选任何维度 → "开始分析"按钮灰显，提示"请至少勾选一个维度"
- [ ] 无年份书信（76 封）→ 年份维度中显示"未知"，排除开关可见
- [ ] 勾选了父级 → 子级自动展开；取消父级 → 子级自动清空
- [ ] 实体子类型数据从 `getSecondaryCategories()` 动态生成，非硬编码
- [ ] 分析结果始终在页面下方，上方默认展示区不受影响
- [ ] 滚动条全局细条（5px）
- [ ] 所有标签中文，无英文代码
- [ ] 预设模板按钮白色文字
- [ ] 导出 CSV 使用 UTF-8 BOM
- [ ] 图表类型不兼容时在下拉中灰显 + 提示原因
