"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { eventTypeMeta, entityTypeMeta } from "@/lib/config";
import { formatLetterDate, getAllEvents, getEntityCategory, getTopicBySlug } from "@/lib/data-adapter";
import { getTextInitial, ALPHABET } from "@/lib/pinyin";
import { getSearchPlaceholder, getSecondaryCategories } from "@/lib/topic-config";
import type { SecondaryCategory } from "@/lib/topic-config";
import type { EntityCatalogEntry, EntityType } from "@/lib/types";
import { TopicHeader } from "@/components/TopicHeader";
import { TopicSearch } from "@/components/TopicSearch";
import { AlphabetIndex } from "@/components/AlphabetIndex";
import { SecondaryCategoryFilter } from "@/components/SecondaryCategoryFilter";
import type { FilterMode } from "@/components/SecondaryCategoryFilter";
import { ActiveFilterSummary } from "@/components/ActiveFilterSummary";
import { AlphabetGroupedEntityList } from "@/components/AlphabetGroupedEntityList";

export function TopicDetailPage({ slug }: { slug: string }) {
  const topic = getTopicBySlug(slug);

  const [query, setQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("single");

  // All entities for this topic
  const allEntries: EntityCatalogEntry[] = useMemo(() => {
    if (!topic?.entityCode) return [];
    return getEntityCategory(topic.entityCode);
  }, [topic]);

  // Secondary category config
  const categories: SecondaryCategory[] = useMemo(() => {
    if (!topic?.entityCode) return [];
    return getSecondaryCategories(topic.entityCode);
  }, [topic]);

  // Build category code → label map
  const categoryLabelMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      map[cat.code] = cat.label;
    }
    return map;
  }, [categories]);

  // Filter: search + letter + categories (AND logic)
  const filteredEntries = useMemo(() => {
    let result = allEntries;

    // Search filter
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (normalizedQuery) {
      result = result.filter((entry) =>
        [entry.canonical, ...entry.aliases]
          .join(" ")
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery),
      );
    }

    // Letter filter
    if (selectedLetter !== null) {
      result = result.filter(
        (entry) => getTextInitial(entry.canonical) === selectedLetter,
      );
    }

    // Category filter (OR within selected categories)
    if (selectedCategories.length > 0) {
      result = result.filter((entry) =>
        entry.subtypes.length
          ? entry.subtypes.some((code) => selectedCategories.includes(code))
          : selectedCategories.includes("__unclassified__"),
      );
    }

    return result;
  }, [allEntries, query, selectedLetter, selectedCategories]);

  // Compute letter counts from all entries (considering search + category filters, NOT letter filter)
  const letterCounts: Record<string, number> = useMemo(() => {
    // Base: entries filtered by search + categories only (not letter)
    let base = allEntries;

    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (normalizedQuery) {
      base = base.filter((entry) =>
        [entry.canonical, ...entry.aliases]
          .join(" ")
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery),
      );
    }

    if (selectedCategories.length > 0) {
      base = base.filter((entry) =>
        entry.subtypes.length
          ? entry.subtypes.some((code) => selectedCategories.includes(code))
          : selectedCategories.includes("__unclassified__"),
      );
    }

    const counts: Record<string, number> = {};
    for (const letter of ALPHABET) {
      counts[letter] = 0;
    }
    for (const entry of base) {
      const initial = getTextInitial(entry.canonical);
      if (counts[initial] !== undefined) {
        counts[initial]++;
      }
    }
    return counts;
  }, [allEntries, query, selectedCategories]);

  // Compute category counts (considering search + letter filters, NOT category filter)
  const categoryCounts: Record<string, number> = useMemo(() => {
    let base = allEntries;

    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (normalizedQuery) {
      base = base.filter((entry) =>
        [entry.canonical, ...entry.aliases]
          .join(" ")
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery),
      );
    }

    if (selectedLetter !== null) {
      base = base.filter(
        (entry) => getTextInitial(entry.canonical) === selectedLetter,
      );
    }

    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat.code] = base.filter((entry) =>
        entry.subtypes.includes(cat.code),
      ).length;
    }
    return counts;
  }, [allEntries, query, selectedLetter, categories]);

  // Category toggle with single/multi logic
  const handleCategoryToggle = useCallback(
    (code: string) => {
      if (filterMode === "single") {
        setSelectedCategories((prev) => (prev.includes(code) ? [] : [code]));
      } else {
        setSelectedCategories((prev) =>
          prev.includes(code)
            ? prev.filter((c) => c !== code)
            : [...prev, code],
        );
      }
    },
    [filterMode],
  );

  // Mode switch logic
  const handleModeChange = useCallback(
    (mode: FilterMode) => {
      if (mode === "single" && filterMode === "multi") {
        // Multi → Single: keep only the last selection
        setSelectedCategories((prev) =>
          prev.length > 0 ? [prev[prev.length - 1]] : [],
        );
      }
      // Single → Multi: keep current selection
      setFilterMode(mode);
    },
    [filterMode],
  );

  const handleClearCategories = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  const handleClearAll = useCallback(() => {
    setQuery("");
    setSelectedLetter(null);
    setSelectedCategories([]);
  }, []);

  // Events (for event-type topics)
  const events = useMemo(() => {
    if (topic?.kind !== "event") return [];
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return getAllEvents().filter(
      ({ letter, event }) =>
        !normalized ||
        `${letter.recipient}${letter.year ?? ""}${event.originalText}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalized),
    );
  }, [query, topic]);

  if (!topic) {
    return <main className="site-container page-state">未找到这个实体专题。</main>;
  }

  const placeholder = getSearchPlaceholder(topic.name);

  return (
    <main className="topic-detail-page site-container">
      {/* 1. 返回链接 */}
      <Link className="back-link" href="/topics">
        ← 返回实体分类检索
      </Link>

      {/* 2. 紧凑型专题标题区 */}
      <TopicHeader
        eyebrow={`第一层标注 · 实体层 NER · ${topic.englishLabel}`}
        title={`${topic.name}专题`}
        description={topic.description}
        metrics={[
          {
            value: topic.entityCount ?? "—",
            label: topic.kind === "event" ? "种事件类型" : "个规范条目",
          },
          {
            value: topic.mentionCount ?? "—",
            label: topic.kind === "event" ? "个标注事件" : "次出现",
          },
          {
            value: topic.letterCount ?? "—",
            label: "封书信",
          },
        ]}
      />

      {/* 3. 专题内部搜索框 */}
      <TopicSearch value={query} onChange={setQuery} placeholder={placeholder} />

      {/* Only show entity-specific UI for entity topics */}
      {topic.kind === "entity" && (
        <>
          {/* 4. A—Z 拼音首字母索引 */}
          <AlphabetIndex
            counts={letterCounts}
            selected={selectedLetter}
            onSelect={setSelectedLetter}
            totalCount={allEntries.length}
          />

          {/* 5. 二级分类筛选区 */}
          {categories.length > 0 && (
            <SecondaryCategoryFilter
              categories={categories}
              categoryCounts={categoryCounts}
              selected={selectedCategories}
              onToggle={handleCategoryToggle}
              mode={filterMode}
              onModeChange={handleModeChange}
              onClear={handleClearCategories}
              totalCount={allEntries.length}
            />
          )}

          {/* 6. 当前筛选状态和结果数量 */}
          <ActiveFilterSummary
            totalCount={allEntries.length}
            filteredCount={filteredEntries.length}
            selectedLetter={selectedLetter}
            selectedCategories={selectedCategories}
            categoryMap={categoryLabelMap}
            keyword={query}
            onClearAll={handleClearAll}
            topicLabel={topic.name}
          />

          {/* 7. 按拼音首字母分组的实体列表 */}
          <AlphabetGroupedEntityList
            entries={filteredEntries}
            categoryLabelMap={categoryLabelMap}
          />
        </>
      )}

      {/* Event topic fallback */}
      {topic.kind === "event" &&
        (events.length ? (
          <section className="event-index-list" aria-label="事件列表">
            {events.map(({ letter, event }) => (
              <article key={`${letter.id}-${event.id}`}>
                <span>
                  {eventTypeMeta[event.type].label}
                  <b>{event.type}</b>
                </span>
                <div>
                  <p>{event.originalText}</p>
                  <small>
                    {event.stage ?? "状态暂无数据"} · 致{letter.recipient} ·{" "}
                    {formatLetterDate(letter)}
                  </small>
                </div>
                <Link href={`/letter/${encodeURIComponent(letter.id)}`}>
                  查看原信 →
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <TopicEmpty />
        ))}
    </main>
  );
}

function TopicEmpty() {
  return (
    <div className="empty-index">
      <span>数据整理中</span>
      <p>专题入口与列表结构已经保留，接入对应标注数据后将在此自动显示。</p>
    </div>
  );
}
