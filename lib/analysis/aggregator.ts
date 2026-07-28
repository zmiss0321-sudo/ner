import type {
  ActMention,
  Dataset,
  EntityMention,
  EntityType,
  EventMention,
  Letter,
} from "@/lib/types";
import { getDimensionKeyLabel } from "./dimensions";
import type {
  AnalysisConfig,
  DimensionId,
  DimensionKey,
  Filter,
  MetricId,
  PivotResult,
  PivotRowData,
} from "./types";

interface CatalogIndexes {
  subtypesByEntity: Map<string, string[]>;
}

interface AxisModel {
  headers: PivotResult["rowHeaders"];
  values: string[];
  indexByValue: Map<string, number>;
}

const PRESENT_VALUE = "__present__";

function emptyResult(): PivotResult {
  return {
    rowHeaders: [],
    columnHeaders: [],
    cells: [],
    rowTotals: [],
    columnTotals: [],
    grandTotal: 0,
  };
}

function entityKey(type: EntityType, canonical: string): string {
  return `${type}:${canonical}`;
}

function buildCatalogIndexes(ds: Dataset): CatalogIndexes {
  const subtypesByEntity = new Map<string, string[]>();
  for (const entry of ds.entityCatalog) {
    subtypesByEntity.set(entityKey(entry.type, entry.canonical), entry.subtypes);
  }
  return { subtypesByEntity };
}

function getMentionSubtypes(mention: EntityMention, indexes: CatalogIndexes): string[] {
  return [...new Set([
    ...(mention.subtype ? [mention.subtype] : []),
    ...(indexes.subtypesByEntity.get(entityKey(mention.type, mention.canonical)) ?? []),
  ])];
}

function normalizedSubtype(type: EntityType, subtype: string): string {
  return subtype.startsWith(`${type}-`) ? subtype : `${type}-${subtype}`;
}

function mentionHasSubtype(
  mention: EntityMention,
  subtype: string,
  indexes: CatalogIndexes,
): boolean {
  return getMentionSubtypes(mention, indexes)
    .some((value) => normalizedSubtype(mention.type, value) === subtype);
}

function periodForYear(year: string | null): string {
  if (!year) return "__unknown_period__";
  return Number(year) <= 1911 ? "late_qing" : "early_republic";
}

function splitKey(key: DimensionKey): [string, string | null] {
  const separator = key.indexOf(":");
  return separator === -1
    ? [key, null]
    : [key.slice(0, separator), key.slice(separator + 1)];
}

function extractDimensionValues(
  key: DimensionKey,
  letter: Letter,
  ds: Dataset,
  indexes: CatalogIndexes,
): Set<string> {
  if (key === "year") return new Set([letter.year ?? "__unknown__"]);
  if (key === "period") return new Set([periodForYear(letter.year)]);
  if (key === "recipient") return new Set([letter.recipient]);

  const [kind, value] = splitKey(key);
  const mentions = ds.entitiesByLetter[letter.id] ?? [];

  if (kind === "entity_type" && value) {
    return mentions.some((mention) => mention.type === value)
      ? new Set([PRESENT_VALUE])
      : new Set();
  }
  if (kind === "entity_subtype" && value) {
    return mentions.some((mention) => mentionHasSubtype(mention, value, indexes))
      ? new Set([PRESENT_VALUE])
      : new Set();
  }
  if (kind === "event_type" && value) {
    return (ds.eventsByLetter[letter.id] ?? []).some((event) => event.type === value)
      ? new Set([PRESENT_VALUE])
      : new Set();
  }
  if (kind === "act_type" && value) {
    return (ds.actsByLetter[letter.id] ?? []).some((act) => act.type === value)
      ? new Set([PRESENT_VALUE])
      : new Set();
  }

  return new Set();
}

function extractFilterValues(
  dimension: DimensionId,
  letter: Letter,
  ds: Dataset,
  indexes: CatalogIndexes,
): Set<string> {
  const mentions = ds.entitiesByLetter[letter.id] ?? [];
  switch (dimension) {
    case "year":
      return new Set([letter.year ?? "__unknown__"]);
    case "period":
      return new Set([periodForYear(letter.year)]);
    case "recipient":
      return new Set([letter.recipient]);
    case "entity_type":
      return new Set(mentions.map((mention) => mention.type));
    case "entity_subtype":
      return new Set(mentions.flatMap((mention) => getMentionSubtypes(mention, indexes)));
    case "entity_canonical":
      return new Set(mentions.map((mention) => entityKey(mention.type, mention.canonical)));
    case "loc_subtype":
      return new Set(
        mentions
          .filter((mention) => mention.type === "LOC")
          .flatMap((mention) => getMentionSubtypes(mention, indexes)),
      );
    case "loc_canonical":
      return new Set(
        mentions
          .filter((mention) => mention.type === "LOC")
          .map((mention) => entityKey(mention.type, mention.canonical)),
      );
    case "event_type":
      return new Set((ds.eventsByLetter[letter.id] ?? []).map((event) => event.type));
    case "act_type":
      return new Set((ds.actsByLetter[letter.id] ?? []).map((act) => act.type));
    case "bok_subtype":
      return new Set(
        mentions
          .filter((mention) => mention.type === "BOK")
          .flatMap((mention) => getMentionSubtypes(mention, indexes)),
      );
    case "ver_subtype":
      return new Set(
        mentions
          .filter((mention) => mention.type === "VER")
          .flatMap((mention) => getMentionSubtypes(mention, indexes)),
      );
  }
}

function filterHasUsableValue(filter: Filter): boolean {
  if (Array.isArray(filter.value)) return filter.value.some(Boolean);
  return filter.value.length > 0;
}

function matchesFilter(
  letter: Letter,
  filter: Filter,
  ds: Dataset,
  indexes: CatalogIndexes,
): boolean {
  if (!filterHasUsableValue(filter)) return true;

  if (filter.operator === "between") {
    if (filter.dimension !== "year" || !Array.isArray(filter.value)) return true;
    const [start, end] = filter.value;
    if (!start || !end || Number(start) > Number(end)) return true;
    return Boolean(
      letter.year
      && Number(letter.year) >= Number(start)
      && Number(letter.year) <= Number(end),
    );
  }

  const actualValues = extractFilterValues(filter.dimension, letter, ds, indexes);
  const selectedValues = Array.isArray(filter.value) ? filter.value : [filter.value];
  const hasMatch = selectedValues.some((value) => actualValues.has(value));
  return filter.operator === "equals" || filter.operator === "in" ? hasMatch : !hasMatch;
}

function axisLabel(key: DimensionKey, value: string): string {
  if (value === PRESENT_VALUE) return getDimensionKeyLabel(key);
  if (key === "year") return value === "__unknown__" ? "未知" : `${value}年`;
  if (key === "period") {
    if (value === "late_qing") return "晚清";
    if (value === "early_republic") return "民初";
    return "未知时期";
  }
  return value;
}

function sortAxisValues(
  key: DimensionKey,
  values: string[],
  counts: Map<string, number>,
): string[] {
  if (key === "year") {
    return values.sort((a, b) => {
      if (a === "__unknown__") return 1;
      if (b === "__unknown__") return -1;
      return Number(a) - Number(b);
    });
  }
  if (key === "period") {
    const order = new Map([
      ["late_qing", 0],
      ["early_republic", 1],
      ["__unknown_period__", 2],
    ]);
    return values.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  }
  if (key === "recipient") {
    return values.sort((a, b) =>
      (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
      || a.localeCompare(b, "zh-CN"),
    );
  }
  return values;
}

function buildAxis(
  key: DimensionKey,
  letters: Letter[],
  ds: Dataset,
  indexes: CatalogIndexes,
): AxisModel {
  const counts = new Map<string, number>();
  for (const letter of letters) {
    for (const value of extractDimensionValues(key, letter, ds, indexes)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const values = sortAxisValues(key, [...counts.keys()], counts);
  return {
    headers: values.map((value) => ({ label: axisLabel(key, value) })),
    values,
    indexByValue: new Map(values.map((value, index) => [value, index])),
  };
}

function getAxisIndices(
  axis: AxisModel,
  key: DimensionKey,
  letter: Letter,
  ds: Dataset,
  indexes: CatalogIndexes,
): number[] {
  return [...extractDimensionValues(key, letter, ds, indexes)]
    .map((value) => axis.indexByValue.get(value))
    .filter((index): index is number => index !== undefined);
}

function mentionMatchesKey(
  mention: EntityMention,
  key: DimensionKey | null,
  indexes: CatalogIndexes,
): boolean {
  if (!key) return true;
  const [kind, value] = splitKey(key);
  if (kind === "entity_type" && value) return mention.type === value;
  if (kind === "entity_subtype" && value) return mentionHasSubtype(mention, value, indexes);
  return true;
}

function eventMatchesKey(event: EventMention, key: DimensionKey | null): boolean {
  if (!key) return true;
  const [kind, value] = splitKey(key);
  return kind !== "event_type" || !value || event.type === value;
}

function actMatchesKey(act: ActMention, key: DimensionKey | null): boolean {
  if (!key) return true;
  const [kind, value] = splitKey(key);
  return kind !== "act_type" || !value || act.type === value;
}

function getMetricValue(
  metric: MetricId,
  letter: Letter,
  ds: Dataset,
  indexes: CatalogIndexes,
  config: AnalysisConfig,
): number {
  if (metric === "letter_count") return 1;

  if (metric === "mention_count" || metric === "canonical_count") {
    const mentions = (ds.entitiesByLetter[letter.id] ?? []).filter((mention) =>
      mentionMatchesKey(mention, config.rowKey, indexes)
      && mentionMatchesKey(mention, config.columnKey, indexes),
    );
    if (metric === "mention_count") return mentions.length;
    return new Set(mentions.map((mention) => entityKey(mention.type, mention.canonical))).size;
  }

  if (metric === "event_count") {
    return (ds.eventsByLetter[letter.id] ?? []).filter((event) =>
      eventMatchesKey(event, config.rowKey)
      && eventMatchesKey(event, config.columnKey),
    ).length;
  }

  return (ds.actsByLetter[letter.id] ?? []).filter((act) =>
    actMatchesKey(act, config.rowKey)
    && actMatchesKey(act, config.columnKey),
  ).length;
}

export function computePivot(config: AnalysisConfig, ds: Dataset): PivotResult {
  if (!config.rowKey) return emptyResult();

  const indexes = buildCatalogIndexes(ds);
  const constraintKeys = config.selectedDimensions.filter(
    (key) => key !== config.rowKey && key !== config.columnKey,
  );
  let letters = config.excludeUnknownYear
    ? ds.letters.filter((letter) => letter.year !== null)
    : ds.letters;

  for (const filter of config.filters) {
    letters = letters.filter((letter) => matchesFilter(letter, filter, ds, indexes));
  }
  if (constraintKeys.length) {
    letters = letters.filter((letter) =>
      constraintKeys.every(
        (key) => extractDimensionValues(key, letter, ds, indexes).size > 0,
      ),
    );
  }

  const rowAxis = buildAxis(config.rowKey, letters, ds, indexes);
  const columnAxis: AxisModel = config.columnKey
    ? buildAxis(config.columnKey, letters, ds, indexes)
    : {
        headers: [{ label: "总计" }],
        values: ["__total__"],
        indexByValue: new Map([["__total__", 0]]),
      };

  const cells = Array.from(
    { length: rowAxis.values.length },
    () => Array(columnAxis.values.length).fill(0),
  );

  for (const letter of letters) {
    const rowIndices = getAxisIndices(rowAxis, config.rowKey, letter, ds, indexes);
    const columnIndices = config.columnKey
      ? getAxisIndices(columnAxis, config.columnKey, letter, ds, indexes)
      : [0];
    const metricValue = getMetricValue(config.metric, letter, ds, indexes, config);

    for (const rowIndex of rowIndices) {
      for (const columnIndex of columnIndices) {
        cells[rowIndex][columnIndex] += metricValue;
      }
    }
  }

  const rowTotals = cells.map((row) => row.reduce((sum, value) => sum + value, 0));
  const columnTotals = columnAxis.values.map((_, columnIndex) =>
    cells.reduce((sum, row) => sum + (row[columnIndex] ?? 0), 0),
  );

  return {
    rowHeaders: rowAxis.headers,
    columnHeaders: columnAxis.headers,
    cells,
    rowTotals,
    columnTotals,
    grandTotal: rowTotals.reduce((sum, value) => sum + value, 0),
  };
}

export function flattenPivot(result: PivotResult): PivotRowData[] {
  const rows: PivotRowData[] = [];
  let flatIndex = 0;

  for (const header of result.rowHeaders) {
    if (header.children?.length) {
      for (const child of header.children) {
        rows.push({
          mainLabel: header.label,
          subLabel: child.label,
          values: result.cells[flatIndex] ?? [],
          total: result.rowTotals[flatIndex] ?? 0,
        });
        flatIndex += 1;
      }
    } else {
      rows.push({
        mainLabel: header.label,
        subLabel: null,
        values: result.cells[flatIndex] ?? [],
        total: result.rowTotals[flatIndex] ?? 0,
      });
      flatIndex += 1;
    }
  }

  return rows;
}
