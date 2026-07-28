import { actTypeMeta, entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { dataset } from "@/lib/data-adapter";
import { getSecondaryCategories } from "@/lib/topic-config";
import type { ActType, EntityType, EventType } from "@/lib/types";
import { DIMENSIONS } from "./dimensions";
import type { DimensionId, FilterOperator } from "./types";

export interface DimensionValue {
  value: string;
  label: string;
  count?: number;
}

const dimensionValuesCache = new Map<DimensionId, DimensionValue[]>();

function secondaryCategoryLabel(type: EntityType, code: string): string {
  return getSecondaryCategories(type).find((category) => category.code === code)?.label ?? code;
}

function subtypeOwner(code: string): EntityType | null {
  const entityTypes = Object.keys(entityTypeMeta) as EntityType[];
  return entityTypes.find((type) =>
    getSecondaryCategories(type).some((category) => category.code === code),
  ) ?? null;
}

function computeDimensionValues(dimension: DimensionId): DimensionValue[] {
  switch (dimension) {
    case "year": {
      const years = [...new Set(dataset.letters.flatMap((letter) => letter.year ? [letter.year] : []))]
        .sort((a, b) => Number(a) - Number(b));
      return [
        ...years.map((year) => ({ value: year, label: `${year}年` })),
        { value: "__unknown__", label: "未知年份" },
      ];
    }
    case "period":
      return [
        { value: "late_qing", label: "晚清（1894—1911）" },
        { value: "early_republic", label: "民初（1912—1926）" },
        { value: "__unknown_period__", label: "未知时期" },
      ];
    case "recipient": {
      const counts = new Map<string, number>();
      for (const letter of dataset.letters) {
        counts.set(letter.recipient, (counts.get(letter.recipient) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
        .map(([recipient, count]) => ({ value: recipient, label: recipient, count }));
    }
    case "entity_type":
      return (Object.keys(dataset.entityStats) as EntityType[]).map((type) => ({
        value: type,
        label: entityTypeMeta[type].label,
        count: dataset.entityStats[type].mentionCount,
      }));
    case "entity_subtype": {
      const counts = new Map<string, number>();
      for (const entry of dataset.entityCatalog) {
        for (const subtype of entry.subtypes) {
          counts.set(subtype, (counts.get(subtype) ?? 0) + entry.count);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
        .map(([subtype, count]) => {
          const owner = subtypeOwner(subtype);
          const label = owner
            ? `${entityTypeMeta[owner].label} · ${secondaryCategoryLabel(owner, subtype)}`
            : subtype;
          return { value: subtype, label, count };
        });
    }
    case "entity_canonical":
      return dataset.entityCatalog
        .map((entry) => ({
          value: `${entry.type}:${entry.canonical}`,
          label: `${entityTypeMeta[entry.type].label} · ${entry.canonical}`,
          count: entry.count,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
    case "loc_subtype":
      return getSecondaryCategories("LOC").map((category) => ({
        value: category.code,
        label: category.label,
      }));
    case "loc_canonical":
      return dataset.entityCatalog
        .filter((entry) => entry.type === "LOC")
        .map((entry) => ({
          value: `LOC:${entry.canonical}`,
          label: entry.canonical,
          count: entry.count,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
    case "event_type":
      return (Object.keys(dataset.eventStats) as EventType[]).map((type) => ({
        value: type,
        label: eventTypeMeta[type].label,
        count: dataset.eventStats[type].eventCount,
      }));
    case "act_type":
      return (Object.keys(dataset.actStats) as ActType[]).map((type) => ({
        value: type,
        label: actTypeMeta[type].label,
        count: dataset.actStats[type].paragraphCount,
      }));
    case "bok_subtype":
      return getSecondaryCategories("BOK").map((category) => ({
        value: category.code,
        label: category.label,
      }));
    case "ver_subtype":
      return getSecondaryCategories("VER").map((category) => ({
        value: category.code,
        label: category.label,
      }));
  }
}

export function getDimensionValues(dimension: DimensionId): DimensionValue[] {
  const cached = dimensionValuesCache.get(dimension);
  if (cached) return cached;
  const values = computeDimensionValues(dimension);
  dimensionValuesCache.set(dimension, values);
  return values;
}

export function getDimensionValueLabel(dimension: DimensionId, value: string): string {
  if (value === "__unclassified__") return "未分类";
  return getDimensionValues(dimension).find((item) => item.value === value)?.label ?? value;
}

export function getDimensionLabel(dimension: DimensionId): string {
  return DIMENSIONS.find((item) => item.id === dimension)?.label ?? dimension;
}

export function getOperatorsForDimension(dimension: DimensionId): FilterOperator[] {
  if (dimension === "year") return ["equals", "not_equals", "between"];
  return ["equals", "not_equals", "in", "not_in"];
}
