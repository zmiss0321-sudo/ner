import type { EntityCatalogEntry } from "@/lib/types";
import { getTextInitial } from "@/lib/pinyin";
import { EntityListItem } from "./EntityListItem";
import { getSecondaryCategories } from "@/lib/topic-config";

type AlphabetGroupedEntityListProps = {
  entries: EntityCatalogEntry[];
  /** code → Chinese label map */
  categoryLabelMap: Record<string, string>;
};

type Group = {
  initial: string;
  entries: EntityCatalogEntry[];
};

function groupByInitial(entries: EntityCatalogEntry[]): Group[] {
  const map = new Map<string, EntityCatalogEntry[]>();
  for (const entry of entries) {
    const initial = getTextInitial(entry.canonical);
    const key = /^[A-Z]$/.test(initial) ? initial : "#";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  // Sort entries within each group by pinyin using Intl.Collator
  const collator = new Intl.Collator("zh-CN", { usage: "sort", sensitivity: "base" });
  for (const [, groupEntries] of map) {
    groupEntries.sort((a, b) => collator.compare(a.canonical, b.canonical));
  }

  // Sort groups A-Z, with # at the end
  const groups = [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    })
    .map(([initial, entries]) => ({ initial, entries }));

  return groups;
}

/**
 * 按拼音首字母分组的实体列表 — 所有专题共用。
 */
export function AlphabetGroupedEntityList({ entries, categoryLabelMap }: AlphabetGroupedEntityListProps) {
  const groups = groupByInitial(entries);

  if (!groups.length) {
    return (
      <div className="empty-index">
        <span>无匹配结果</span>
        <p>尝试调整筛选条件以查看更多实体。</p>
      </div>
    );
  }

  return (
    <section className="alpha-grouped-list" aria-label="实体列表（按首字母分组）">
      {groups.map((group) => (
        <div key={group.initial} className="alpha-group" id={`alpha-${group.initial}`}>
          <h2 className="alpha-group-title">{group.initial}</h2>
          <div className="alpha-group-entries">
            {group.entries.map((entry) => (
              <EntityListItem
                key={`${entry.type}-${entry.canonical}`}
                entry={entry}
                categoryLabelMap={categoryLabelMap}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
