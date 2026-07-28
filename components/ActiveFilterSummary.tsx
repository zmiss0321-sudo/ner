import type { SecondaryCategory } from "@/lib/topic-config";

type ActiveFilterSummaryProps = {
  totalCount: number;
  filteredCount: number;
  selectedLetter: string | null;
  selectedCategories: string[];
  categoryMap: Record<string, string>; // code → label
  keyword: string;
  onClearAll: () => void;
  topicLabel: string; // e.g. "地点"
};

/**
 * 当前筛选状态栏 — 显示全部激活的筛选条件及结果数量。
 */
export function ActiveFilterSummary({
  totalCount,
  filteredCount,
  selectedLetter,
  selectedCategories,
  categoryMap,
  keyword,
  onClearAll,
  topicLabel,
}: ActiveFilterSummaryProps) {
  const hasFilters = selectedLetter !== null || selectedCategories.length > 0 || keyword.trim().length > 0;

  return (
    <div className="active-filter-summary">
      {hasFilters ? (
        <>
          <span className="filter-result-text">
            共 {totalCount} 个{topicLabel} · 当前显示 {filteredCount} 个
          </span>
          <div className="filter-tags">
            {selectedLetter !== null && (
              <span className="filter-tag">
                首字母：{selectedLetter}
              </span>
            )}
            {selectedCategories.length > 0 && (
              <span className="filter-tag">
                分类：{selectedCategories.map((c) => categoryMap[c] ?? c).join("、")}
              </span>
            )}
            {keyword.trim() && (
              <span className="filter-tag">
                关键词：{keyword.trim()}
              </span>
            )}
            <button type="button" className="filter-clear-all" onClick={onClearAll}>
              清空全部筛选
            </button>
          </div>
        </>
      ) : (
        <span className="filter-result-text">
          共 {totalCount} 个{topicLabel} · 当前显示全部
        </span>
      )}
    </div>
  );
}
