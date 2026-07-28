"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { entityTypeMeta, eventTypeMeta, actTypeMeta } from "@/lib/config";
import { formatLetterDate, getCategoryMeta, getEntityCategory, getEventsByType, getActsByType } from "@/lib/data-adapter";
import { getTextInitial, ALPHABET } from "@/lib/pinyin";
import { getSearchPlaceholder, getSecondaryCategories } from "@/lib/topic-config";
import type { SecondaryCategory } from "@/lib/topic-config";
import type { ActType, EntityCatalogEntry, EntityType, EventType } from "@/lib/types";
import { TopicHeader } from "@/components/TopicHeader";
import { TopicSearch } from "@/components/TopicSearch";
import { AlphabetIndex } from "@/components/AlphabetIndex";
import { SecondaryCategoryFilter } from "@/components/SecondaryCategoryFilter";
import type { FilterMode } from "@/components/SecondaryCategoryFilter";
import { ActiveFilterSummary } from "@/components/ActiveFilterSummary";
import { AlphabetGroupedEntityList } from "@/components/AlphabetGroupedEntityList";

export function CategoryIndexPage({ layer, code }: { layer: string; code: string }) {
  const meta = getCategoryMeta(layer, code);

  const [query, setQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("single");

  // Entity data (only for entity layer)
  const allEntries: EntityCatalogEntry[] = useMemo(
    () => (layer === "entity" ? getEntityCategory(code as EntityType) : []),
    [code, layer],
  );

  // Event data (only for event layer)
  const allEvents = useMemo(
    () => (layer === "event" ? getEventsByType(code as EventType) : []),
    [code, layer],
  );

  // Act data (only for act layer)
  const allActs = useMemo(
    () => (layer === "act" ? getActsByType(code as ActType) : []),
    [code, layer],
  );

  // Secondary category config
  const categories: SecondaryCategory[] = useMemo(() => {
    if (layer !== "entity") return [];
    return getSecondaryCategories(code as EntityType);
  }, [layer, code]);

  const categoryLabelMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) map[cat.code] = cat.label;
    return map;
  }, [categories]);

  // Filter: search + letter + categories (AND)
  const filteredEntries = useMemo(() => {
    let result = allEntries;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (normalizedQuery) {
      result = result.filter((entry) =>
        [entry.canonical, ...entry.aliases].join(" ").toLocaleLowerCase("zh-CN").includes(normalizedQuery),
      );
    }
    if (selectedLetter !== null) {
      result = result.filter((entry) => getTextInitial(entry.canonical) === selectedLetter);
    }
    if (selectedCategories.length > 0) {
      result = result.filter((entry) =>
        entry.subtypes.length
          ? entry.subtypes.some((s) => selectedCategories.includes(s))
          : selectedCategories.includes("__unclassified__"),
      );
    }
    return result;
  }, [allEntries, query, selectedLetter, selectedCategories]);

  // Letter counts (considering search + categories, not letter itself)
  const letterCounts: Record<string, number> = useMemo(() => {
    let base = allEntries;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (normalizedQuery) {
      base = base.filter((entry) =>
        [entry.canonical, ...entry.aliases].join(" ").toLocaleLowerCase("zh-CN").includes(normalizedQuery),
      );
    }
    if (selectedCategories.length > 0) {
      base = base.filter((entry) =>
        entry.subtypes.length
          ? entry.subtypes.some((s) => selectedCategories.includes(s))
          : selectedCategories.includes("__unclassified__"),
      );
    }
    const counts: Record<string, number> = {};
    for (const letter of ALPHABET) counts[letter] = 0;
    for (const entry of base) {
      const init = getTextInitial(entry.canonical);
      if (counts[init] !== undefined) counts[init]++;
    }
    return counts;
  }, [allEntries, query, selectedCategories]);

  // Category counts (considering search + letter, not category itself)
  const categoryCounts: Record<string, number> = useMemo(() => {
    let base = allEntries;
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (normalizedQuery) {
      base = base.filter((entry) =>
        [entry.canonical, ...entry.aliases].join(" ").toLocaleLowerCase("zh-CN").includes(normalizedQuery),
      );
    }
    if (selectedLetter !== null) {
      base = base.filter((entry) => getTextInitial(entry.canonical) === selectedLetter);
    }
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat.code] = base.filter((entry) => entry.subtypes.includes(cat.code)).length;
    }
    return counts;
  }, [allEntries, query, selectedLetter, categories]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return allEvents;
    return allEvents.filter(({ letter, event }) =>
      `${letter.recipient}${letter.year ?? ""}${event.originalText}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery),
    );
  }, [allEvents, query]);

  // Filtered acts
  const filteredActs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return allActs;
    return allActs.filter(({ letter, act }) =>
      `${letter.recipient}${letter.year ?? ""}${act.originalText}${act.subtype ?? ""}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery),
    );
  }, [allActs, query]);

  // Category toggle with single/multi logic
  const handleCategoryToggle = useCallback(
    (catCode: string) => {
      if (filterMode === "single") {
        setSelectedCategories((prev) => (prev.includes(catCode) ? [] : [catCode]));
      } else {
        setSelectedCategories((prev) =>
          prev.includes(catCode) ? prev.filter((c) => c !== catCode) : [...prev, catCode],
        );
      }
    },
    [filterMode],
  );

  const handleModeChange = useCallback(
    (mode: FilterMode) => {
      if (mode === "single" && filterMode === "multi") {
        setSelectedCategories((prev) => (prev.length > 0 ? [prev[prev.length - 1]] : []));
      }
      setFilterMode(mode);
    },
    [filterMode],
  );

  const handleClearCategories = useCallback(() => setSelectedCategories([]), []);
  const handleClearAll = useCallback(() => {
    setQuery("");
    setSelectedLetter(null);
    setSelectedCategories([]);
  }, []);

  if (!meta) return <div className="page-state">未找到对应的实体专题。</div>;

  const layerLabel =
    layer === "entity"
      ? "第一层标注 · 实体层 NER"
      : layer === "event"
        ? "第二层标注 · 事件层 EVT"
        : "第三层标注 · 行动层 ACT";

  const totalValue =
    layer === "entity"
      ? "canonicalCount" in meta.stats ? meta.stats.canonicalCount : 0
      : layer === "event"
        ? "eventCount" in meta.stats ? meta.stats.eventCount : 0
        : "paragraphCount" in meta.stats ? meta.stats.paragraphCount : 0;

  const totalUnit = layer === "entity" ? "个规范条目" : layer === "event" ? "个事件" : "个段落";
  const letterCount = "letterCount" in meta.stats ? meta.stats.letterCount : 0;
  const placeholder = getSearchPlaceholder(meta.label);

  return (
    <main className="index-page site-container">
      <Link className="back-link" href="/topics">← 返回实体分类检索</Link>

      <TopicHeader
        eyebrow={`${layerLabel} · ${code}`}
        title={`${meta.label}专题`}
        description={"prompt" in meta ? meta.prompt : meta.definition}
        metrics={[
          { value: totalValue.toLocaleString("zh-CN"), label: totalUnit },
          { value: letterCount.toLocaleString("zh-CN"), label: "封书信" },
        ]}
      />

      <TopicSearch value={query} onChange={setQuery} placeholder={placeholder} />

      {/* Entity layer: full filtering + grouped list */}
      {layer === "entity" && (
        <>
          <AlphabetIndex
            counts={letterCounts}
            selected={selectedLetter}
            onSelect={setSelectedLetter}
            totalCount={allEntries.length}
          />

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

          <ActiveFilterSummary
            totalCount={allEntries.length}
            filteredCount={filteredEntries.length}
            selectedLetter={selectedLetter}
            selectedCategories={selectedCategories}
            categoryMap={categoryLabelMap}
            keyword={query}
            onClearAll={handleClearAll}
            topicLabel={meta.label}
          />

          <AlphabetGroupedEntityList entries={filteredEntries} categoryLabelMap={categoryLabelMap} />
        </>
      )}

      {/* Event layer */}
      {layer === "event" && (
        filteredEvents.length ? (
          <section className="event-index-list" style={{ marginTop: 24 }}>
            {filteredEvents.slice(0, 120).map(({ letter, event }) => (
              <article key={`${letter.id}-${event.id}`}>
                <span>{eventTypeMeta[event.type].label}<b>{event.type}</b></span>
                <div>
                  <p>{event.originalText}</p>
                  <small>{event.stage ?? "状态暂无数据"} · 致{letter.recipient} · {formatLetterDate(letter)}</small>
                </div>
                <Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看原信 →</Link>
              </article>
            ))}
          </section>
        ) : <EmptyIndex />
      )}

      {layer === "act" && (
        filteredActs.length ? (
          <section className="event-index-list" style={{ marginTop: 24 }}>
            {filteredActs.slice(0, 200).map(({ letter, act }) => (
              <article key={act.id}>
                <span>{actTypeMeta[act.type].label}<b>{act.type}</b></span>
                <div>
                  <p>{act.originalText}</p>
                  <small>{act.subtype ? `${act.subtype} · ` : ""}{act.mode} · 致{letter.recipient} · {formatLetterDate(letter)}</small>
                </div>
                <Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看原信 →</Link>
              </article>
            ))}
          </section>
        ) : <EmptyIndex />
      )}
    </main>
  );
}

function EmptyIndex({ message = "现有数据中暂无这一类型的标注条目。" }: { message?: string }) {
  return <div className="empty-index"><span>暂无数据</span><p>{message}</p></div>;
}
