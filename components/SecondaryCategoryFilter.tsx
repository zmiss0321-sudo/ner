import type { SecondaryCategory } from "@/lib/topic-config";

export type FilterMode = "single" | "multi";

type SecondaryCategoryFilterProps = {
  categories: SecondaryCategory[];
  /** 每个分类下的实体数量（已考虑其他筛选条件） */
  categoryCounts: Record<string, number>;
  /** 当前选中的分类代码列表（单选时只有一个元素） */
  selected: string[];
  /** 选中分类回调 */
  onToggle: (code: string) => void;
  /** 当前模式 */
  mode: FilterMode;
  /** 切换模式回调 */
  onModeChange: (mode: FilterMode) => void;
  /** 清空筛选 */
  onClear: () => void;
  /** 实体总数 */
  totalCount: number;
};

/**
 * 二级分类筛选区 — 支持单选/多选模式切换。
 * 按钮主文案显示中文名称，英文代码作为小字辅助信息。
 */
export function SecondaryCategoryFilter({
  categories,
  categoryCounts,
  selected,
  onToggle,
  mode,
  onModeChange,
  onClear,
  totalCount,
}: SecondaryCategoryFilterProps) {
  const hasSelection = selected.length > 0;

  return (
    <section className="secondary-category-filter" aria-label="二级分类筛选">
      <div className="cat-filter-header">
        <span className="cat-filter-title">二级分类筛选</span>
        <div className="cat-filter-controls">
          <span className="cat-mode-label">模式</span>
          <button
            type="button"
            className={`cat-mode-btn${mode === "single" ? " cat-mode-active" : ""}`}
            onClick={() => onModeChange("single")}
          >
            单选
          </button>
          <button
            type="button"
            className={`cat-mode-btn${mode === "multi" ? " cat-mode-active" : ""}`}
            onClick={() => onModeChange("multi")}
          >
            多选
          </button>
          {hasSelection && (
            <button type="button" className="cat-clear-btn" onClick={onClear}>
              清空筛选
            </button>
          )}
        </div>
      </div>
      <div className="cat-filter-buttons">
        <button
          type="button"
          className={`cat-btn${!hasSelection ? " cat-btn-selected" : ""}`}
          onClick={onClear}
        >
          <span className="cat-btn-label">全部</span>
          <span className="cat-btn-count">{totalCount}</span>
        </button>
        {categories.map((cat) => {
          const count = categoryCounts[cat.code] ?? 0;
          const isSelected = selected.includes(cat.code);
          return (
            <button
              key={cat.code}
              type="button"
              className={`cat-btn${isSelected ? " cat-btn-selected" : ""}`}
              onClick={() => onToggle(cat.code)}
              title={cat.description}
            >
              <span className="cat-btn-label">{cat.label}</span>
              <span className="cat-btn-count">{count}</span>
              <span className="cat-btn-code">{cat.code}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
