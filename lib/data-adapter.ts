import rawDataset from "@/data/generated.json";
import { actTypeMeta, entityTypeMeta, eventTypeMeta, featuredLetterIds, topicDefinitions } from "./config";
import type {
  ActType,
  Dataset,
  EntityCatalogEntry,
  EntityType,
  EventMention,
  EventType,
  Letter,
  SearchResult,
  SearchScope,
  TopicSummary,
} from "./types";

export const dataset = rawDataset as unknown as Dataset;

const letterMap = new Map(dataset.letters.map((letter) => [letter.id, letter]));

export function normalizeLetter(letter: Letter): Letter {
  return { ...letter, text: letter.text.trim() };
}

export function normalizeEntityAnnotation(letterId: string) {
  return (dataset.entitiesByLetter[letterId] ?? []).filter((mention) => mention.start >= 0);
}

export function normalizeEventAnnotation(letterId: string) {
  return (dataset.eventsByLetter[letterId] ?? []).filter((event) => event.start >= 0);
}

export function normalizeActAnnotation(letterId: string) {
  return (dataset.actsByLetter?.[letterId] ?? []).filter((act) => act.start >= 0);
}

export function getActAnnotationsForRange(letterId: string, rangeStart: number, rangeEnd: number) {
  return normalizeActAnnotation(letterId).filter(
    (act) => act.start < rangeEnd && act.end > rangeStart,
  );
}

export function getActsByType(type: string) {
  return Object.entries(dataset.actsByLetter ?? {}).flatMap(([letterId, acts]) => {
    const letter = getLetter(letterId);
    if (!letter) return [];
    return acts.filter((act) => act.type === type).map((act) => ({ letter, act }));
  });
}

export function getLetter(id: string) {
  const letter = letterMap.get(id);
  return letter ? normalizeLetter(letter) : null;
}

export function getFeaturedLetters() {
  return featuredLetterIds.map(getLetter).filter((letter): letter is Letter => Boolean(letter));
}

export function getAllLetters() {
  return dataset.letters.map(normalizeLetter).sort((a, b) => a.number.localeCompare(b.number, "zh-CN"));
}

export function getLetterEntitySummary(letterId: string) {
  const mentions = normalizeEntityAnnotation(letterId);
  const types = [...new Set(mentions.map((mention) => mention.type))];
  return { count: mentions.length, types };
}

export function getLetterExcerpt(letter: Letter, length = 116) {
  const text = normalizeLetter(letter).text.replace(/\s+/g, " ");
  return `${text.slice(0, length)}${text.length > length ? "……" : ""}`;
}

export function formatLetterDate(letter: Letter) {
  if (letter.dateLabel) return letter.dateLabel;
  const parts = [letter.year ? `${letter.year}年` : "公历时间暂无数据", letter.ganzhiDate].filter(Boolean);
  return parts.join(" · ");
}

export const searchScopeLabels: Record<SearchScope, string> = {
  fulltext: "全文",
  recipient: "收信人",
  source: "来源",
};

export function searchLetters(rawQuery: string, scope: SearchScope = "fulltext", limit = 30): SearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase("zh-CN");
  if (!query) return [];
  const results: SearchResult[] = [];
  for (const letter of dataset.letters) {
    const field = scope === "recipient" ? letter.recipient : scope === "source" ? letter.source ?? "" : letter.text;
    const rawIndex = field.toLocaleLowerCase("zh-CN").indexOf(query);
    if (rawIndex < 0) continue;
    const start = scope === "fulltext" ? Math.max(0, rawIndex - 34) : 0;
    const end = scope === "fulltext" ? Math.min(field.length, rawIndex + Math.max(query.length, 1) + 56) : field.length;
    results.push({
      letter: normalizeLetter(letter),
      snippet: `${start > 0 ? "……" : ""}${field.slice(start, end)}${end < field.length ? "……" : ""}`,
      matchStart: scope === "fulltext" ? rawIndex : rawIndex,
      snippetMatchStart: rawIndex - start + (start > 0 ? 2 : 0),
      matchLength: rawQuery.trim().length,
      matchField: scope,
    });
    if (results.length >= limit) break;
  }
  return results;
}

export function getSearchResultHref(result: SearchResult, query: string) {
  const params = new URLSearchParams({ q: query, scope: result.matchField });
  if (result.matchField === "fulltext") params.set("at", String(result.matchStart));
  return `/letter/${encodeURIComponent(result.letter.id)}?${params.toString()}`;
}

export function getEntityCategory(type: EntityType): EntityCatalogEntry[] {
  return dataset.entityCatalog.filter((entry) => entry.type === type);
}

export function getEntity(type: EntityType, canonical: string) {
  return dataset.entityCatalog.find((entry) => entry.type === type && entry.canonical === canonical) ?? null;
}

/** The catalog's stable composite key. Surface text is intentionally excluded. */
export function getEntityKey(entity: Pick<EntityCatalogEntry, "type" | "canonical">) {
  return `${entity.type}:${entity.canonical}`;
}

export function getEntityHref(entity: Pick<EntityCatalogEntry, "type" | "canonical">) {
  return `/entity/${entity.type}/${encodeURIComponent(entity.canonical)}`;
}

export function getEntityOccurrences(entry: EntityCatalogEntry) {
  return entry.letterIds.flatMap((letterId) => {
    const letter = getLetter(letterId);
    if (!letter) return [];
    const mentions = normalizeEntityAnnotation(letterId).filter(
      (mention) => mention.type === entry.type && mention.canonical === entry.canonical,
    );
    return mentions.map((mention) => ({ letter, mention }));
  });
}

export function getEventsByType(type: EventType) {
  return Object.entries(dataset.eventsByLetter).flatMap(([letterId, events]) => {
    const letter = getLetter(letterId);
    if (!letter) return [];
    return events.filter((event) => event.type === type).map((event) => ({ letter, event }));
  });
}

export function getAllEvents() {
  return Object.entries(dataset.eventsByLetter).flatMap(([letterId, events]) => {
    const letter = getLetter(letterId);
    return letter ? events.map((event) => ({ letter, event })) : [];
  });
}

export function getTopicSummaries(): TopicSummary[] {
  const allEvents = getAllEvents();
  const eventLetters = new Set(allEvents.map(({ letter }) => letter.id)).size;
  return topicDefinitions.map((topic) => {
    if (topic.kind === "event") {
      return {
        ...topic,
        entityCount: Object.keys(eventTypeMeta).length,
        mentionCount: allEvents.length,
        letterCount: eventLetters,
        status: allEvents.length ? "available" : "organizing",
      };
    }
    const stats = topic.entityCode ? dataset.entityStats[topic.entityCode] : null;
    const available = Boolean(stats?.canonicalCount || stats?.mentionCount);
    return {
      ...topic,
      entityCount: stats?.canonicalCount ?? 0,
      mentionCount: stats?.mentionCount ?? 0,
      letterCount: stats?.letterCount ?? 0,
      status: available ? "available" : "organizing",
    };
  });
}

export function getTopicBySlug(slug: string) {
  return getTopicSummaries().find((topic) => topic.slug === slug) ?? null;
}

export function getRelatedEntities(entry: EntityCatalogEntry, limit = 12) {
  const letterIds = new Set(entry.letterIds);
  return dataset.entityCatalog
    .filter((candidate) => candidate.canonical !== entry.canonical && candidate.letterIds.some((id) => letterIds.has(id)))
    .map((candidate) => ({
      entry: candidate,
      sharedLetters: candidate.letterIds.filter((id) => letterIds.has(id)).length,
    }))
    .sort((a, b) => b.sharedLetters - a.sharedLetters || b.entry.count - a.entry.count)
    .slice(0, limit);
}

export function getRelatedEvents(entry: EntityCatalogEntry, limit = 12) {
  return entry.letterIds
    .flatMap((letterId) => {
      const letter = getLetter(letterId);
      if (!letter) return [];
      return (dataset.eventsByLetter[letterId] ?? []).map((event) => ({ letter, event }));
    })
    .slice(0, limit);
}

export function getCategoryMeta(layer: string, code: string) {
  if (layer === "entity" && code in entityTypeMeta) {
    const type = code as EntityType;
    return { layer, code: type, ...entityTypeMeta[type], stats: dataset.entityStats[type] };
  }
  if (layer === "event" && code in eventTypeMeta) {
    const type = code as EventType;
    return { layer, code: type, ...eventTypeMeta[type], stats: dataset.eventStats[type] };
  }
  if (layer === "act" && code in actTypeMeta) {
    const type = code as ActType;
    return { layer, code: type, ...actTypeMeta[type], stats: dataset.actStats[type] };
  }
  return null;
}

export function splitLetterIntoTranslationPairs(letter: Letter) {
  const events = normalizeEventAnnotation(letter.id)
    .filter((event) => event.start >= 0)
    .sort((a, b) => a.start - b.start);
  const pairs: Array<{ original: string; translation: string | null; event: EventMention | null; start: number; end: number }> = [];
  let cursor = 0;
  for (const event of events) {
    if (event.start < cursor) continue;
    if (event.start > cursor) {
      const original = letter.text.slice(cursor, event.start);
      if (original.trim()) pairs.push({ original, translation: null, event: null, start: cursor, end: event.start });
    }
    pairs.push({ original: letter.text.slice(event.start, event.end), translation: event.paraphrase, event, start: event.start, end: event.end });
    cursor = event.end;
  }
  const tail = letter.text.slice(cursor);
  if (tail.trim()) pairs.push({ original: tail, translation: null, event: null, start: cursor, end: letter.text.length });
  return pairs.length ? pairs : [{ original: letter.text, translation: null, event: null, start: 0, end: letter.text.length }];
}
