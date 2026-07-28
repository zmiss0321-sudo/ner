import Link from "next/link";
import type { EntityCatalogEntry } from "@/lib/types";
import { getSecondaryCategories } from "@/lib/topic-config";

type EntityListItemProps = {
  entry: EntityCatalogEntry;
  /** code → Chinese label map */
  categoryLabelMap: Record<string, string>;
};

/**
 * 实体条目 — 显示规范名称、中文分类、出现次数、别名及详情箭头。
 */
export function EntityListItem({ entry, categoryLabelMap }: EntityListItemProps) {
  const categories = getSecondaryCategories(entry.type);
  const subtypeDisplay = entry.subtypes.length
    ? entry.subtypes.map((code) => {
        const cat = categories.find((c) => c.code === code);
        return cat ? `${cat.label} · ${code}` : code;
      })
    : ["未分类"];

  const aliasText = entry.aliases.length ? entry.aliases.slice(0, 5).join("、") : null;

  return (
    <Link
      href={`/entity/${entry.type}/${encodeURIComponent(entry.canonical)}`}
      className="entity-list-item"
    >
      <div className="eli-main">
        <strong className="eli-name">{entry.canonical}</strong>
        <span className="eli-category">{subtypeDisplay.join(" / ")}</span>
        {aliasText && <small className="eli-aliases">别名：{aliasText}</small>}
      </div>
      <span className="eli-stats">
        {entry.count} 次出现 · {entry.letterIds.length} 封书信
      </span>
      <i className="eli-arrow" aria-hidden="true">→</i>
    </Link>
  );
}
