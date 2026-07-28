"use client";

import { useEffect, useMemo, useState } from "react";
import { DIMENSIONS } from "@/lib/analysis/dimensions";
import {
  getDimensionValues,
  getOperatorsForDimension,
} from "@/lib/analysis/dimension-values";
import type {
  DimensionId,
  Filter,
  FilterOperator,
} from "@/lib/analysis/types";

interface FilterRowProps {
  filter: Filter;
  onUpdate: (filter: Filter) => void;
  onRemove: (id: string) => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "等于",
  not_equals: "不等于",
  in: "属于",
  not_in: "不属于",
  between: "介于",
};

const compactFieldClass =
  "h-8 min-w-0 border border-[var(--line-dark)] bg-[var(--surface)] px-2 font-serif text-[10px] outline-none focus:border-[var(--purple)]";

export function FilterRow({ filter, onUpdate, onRemove }: FilterRowProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const values = getDimensionValues(filter.dimension);
  const operators = getOperatorsForDimension(filter.dimension);
  const searchable = values.length > 100;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const visibleValues = useMemo(() => {
    if (!searchable || !debouncedQuery) return values;
    const normalized = debouncedQuery.toLocaleLowerCase("zh-CN");
    const selected = new Set(
      Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : [],
    );
    return values.filter((item) =>
      selected.has(item.value)
      || `${item.label} ${item.value}`.toLocaleLowerCase("zh-CN").includes(normalized),
    );
  }, [debouncedQuery, filter.value, searchable, values]);

  const range = Array.isArray(filter.value) ? filter.value : ["", ""];
  const rangeInvalid = filter.operator === "between"
    && Boolean(range[0] && range[1] && Number(range[0]) > Number(range[1]));
  const yearValues = values.filter((item) => item.value !== "__unknown__");

  const handleOperatorChange = (operator: FilterOperator) => {
    const nextValue = operator === "between"
      ? ["", ""] as [string, string]
      : operator === "in" || operator === "not_in"
        ? []
        : "";
    onUpdate({ ...filter, operator, value: nextValue });
  };

  return (
    <div className="border border-[var(--line)] bg-[var(--paper)] p-2.5 font-serif">
      <div className="grid grid-cols-[minmax(0,1fr)_72px_24px] gap-1.5">
        <select
          aria-label="筛选维度"
          value={filter.dimension}
          onChange={(event) => {
            setQuery("");
            setDebouncedQuery("");
            onUpdate({
              ...filter,
              dimension: event.target.value as DimensionId,
              operator: "equals",
              value: "",
            });
          }}
          className={compactFieldClass}
        >
          {DIMENSIONS.map((dimension) => (
            <option key={dimension.id} value={dimension.id}>{dimension.label}</option>
          ))}
        </select>
        <select
          aria-label="筛选运算符"
          value={filter.operator}
          onChange={(event) => handleOperatorChange(event.target.value as FilterOperator)}
          className={compactFieldClass}
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>{OPERATOR_LABELS[operator]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(filter.id)}
          className="grid size-8 place-items-center border border-transparent font-serif text-[15px] text-[#a26c6c] transition hover:border-[#d8bcbc] hover:bg-[#f5eaea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
          title="删除此筛选"
          aria-label="删除此筛选"
        >
          ×
        </button>
      </div>

      {filter.operator === "between" ? (
        <div className="mt-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <select
              aria-label="起始年份"
              value={range[0] ?? ""}
              onChange={(event) => onUpdate({
                ...filter,
                value: [event.target.value, range[1] ?? ""],
              })}
              className={compactFieldClass}
            >
              <option value="">起始年份</option>
              {yearValues.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-[var(--muted)]">—</span>
            <select
              aria-label="结束年份"
              value={range[1] ?? ""}
              onChange={(event) => onUpdate({
                ...filter,
                value: [range[0] ?? "", event.target.value],
              })}
              className={compactFieldClass}
            >
              <option value="">结束年份</option>
              {yearValues.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          {rangeInvalid && (
            <p className="mt-1 text-[9px] text-[#944b48]" role="alert">
              起始年份不能晚于结束年份；修正前暂不应用此条件。
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`搜索${DIMENSIONS.find((item) => item.id === filter.dimension)?.label ?? "值"}…`}
              className="mb-1.5 h-8 w-full border border-[var(--line-dark)] bg-[var(--surface)] px-2 font-serif text-[10px] outline-none placeholder:text-[#aaa4aa] focus:border-[var(--purple)]"
            />
          )}
          {filter.operator === "in" || filter.operator === "not_in" ? (
            <>
              <select
                multiple
                aria-label="筛选值（可多选）"
                value={Array.isArray(filter.value) ? filter.value : []}
                onChange={(event) => onUpdate({
                  ...filter,
                  value: Array.from(event.target.selectedOptions, (option) => option.value),
                })}
                className="min-h-20 w-full border border-[var(--line-dark)] bg-[var(--surface)] px-1 py-1 font-serif text-[10px] outline-none focus:border-[var(--purple)]"
              >
                {visibleValues.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}{item.count !== undefined ? `（${item.count}）` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[8px] text-[#9a949a]">
                按住 Command / Ctrl 可选择多个值
              </p>
            </>
          ) : (
            <select
              aria-label="筛选值"
              value={typeof filter.value === "string" ? filter.value : ""}
              onChange={(event) => onUpdate({ ...filter, value: event.target.value })}
              className="h-8 w-full border border-[var(--line-dark)] bg-[var(--surface)] px-2 font-serif text-[10px] outline-none focus:border-[var(--purple)]"
            >
              <option value="">选择值…</option>
              {visibleValues.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}{item.count !== undefined ? `（${item.count}）` : ""}
                </option>
              ))}
            </select>
          )}
          {searchable && debouncedQuery && visibleValues.length === 0 && (
            <p className="mt-1 text-[9px] text-[var(--muted)]">没有匹配的选项</p>
          )}
        </div>
      )}
    </div>
  );
}
