"use client";

import { useEffect, useRef } from "react";
import {
  CHART_TYPES,
  DIMENSION_GROUPS,
  METRICS,
  getChartIncompatibilityReason,
  getDimensionItem,
  getDimensionKeyLabel,
  isEntitySubtypeDimension,
  isTemporalDimension,
} from "@/lib/analysis/dimensions";
import type {
  AnalysisConfig,
  ChartType,
  DimensionItem,
  DimensionKey,
  Filter,
} from "@/lib/analysis/types";
import { FilterRow } from "./FilterRow";

interface DimensionPanelProps {
  config: AnalysisConfig;
  onChange: (config: AnalysisConfig) => void;
  onAnalyze: () => void;
  unknownYearCount: number;
  cacheEpoch: number;
}

interface AxisAssignment {
  rowKey: DimensionKey | null;
  columnKey: DimensionKey | null;
}

let filterIdCounter = 0;

const fieldClass =
  "h-[52px] w-full border border-[var(--line-dark)] bg-[var(--surface)] px-3 font-serif text-[16px] text-[var(--ink)] outline-none transition focus:border-[var(--purple)] focus-visible:ring-1 focus-visible:ring-[var(--purple)] disabled:cursor-not-allowed disabled:opacity-55";

function axisCandidates(selected: DimensionKey[]): DimensionKey[] {
  return selected.filter((key) => !isEntitySubtypeDimension(key));
}

function autoAssignAxes(selected: DimensionKey[]): AxisAssignment {
  const candidates = axisCandidates(selected);
  if (candidates.length === 0) return { rowKey: null, columnKey: null };
  if (candidates.length === 1) return { rowKey: candidates[0], columnKey: null };
  if (candidates.length === 2) {
    const [first, second] = candidates;
    const firstIsTime = isTemporalDimension(first);
    const secondIsTime = isTemporalDimension(second);
    if (firstIsTime !== secondIsTime) {
      return firstIsTime
        ? { rowKey: second, columnKey: first }
        : { rowKey: first, columnKey: second };
    }
  }
  return { rowKey: candidates[0], columnKey: candidates[1] };
}

function withCompatibleChart(
  config: AnalysisConfig,
  axes: AxisAssignment,
): AnalysisConfig {
  const chartType = getChartIncompatibilityReason(
    config.chartType,
    axes.rowKey,
    axes.columnKey,
  )
    ? "bar_stacked"
    : config.chartType;
  return { ...config, ...axes, chartType };
}

function ChoiceChip({
  label,
  code,
  selected,
  onToggle,
  ariaLabel,
}: {
  label: string;
  code?: string;
  selected: boolean;
  onToggle: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={`inline-flex min-h-9 max-w-full items-center gap-2 border px-3 py-1.5 font-serif text-[12px] leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] active:translate-y-px ${
        selected
          ? "border-[var(--purple)] bg-[var(--purple-pale)] text-[var(--purple-deep)]"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--line-dark)] hover:bg-[rgba(255,254,249,.72)]"
      }`}
    >
      {selected ? (
        <span aria-hidden="true" className="text-[12px] font-semibold text-[var(--purple)]">
          ✓
        </span>
      ) : null}
      <span className="min-w-0">{label}</span>
      {code ? (
        <span className="font-sans text-[8px] font-extrabold tracking-[.16em] text-[var(--muted)]">
          {code}
        </span>
      ) : null}
    </button>
  );
}

export function DimensionPanel({
  config,
  onChange,
  onAnalyze,
  unknownYearCount,
  cacheEpoch,
}: DimensionPanelProps) {
  const selected = new Set(config.selectedDimensions);
  const childSelectionCache = useRef(new Map<DimensionKey, DimensionKey[]>());
  const timeGroup = DIMENSION_GROUPS.find((group) => group.category === "时间");
  const entityGroup = DIMENSION_GROUPS.find((group) => group.category === "实体类型");
  const eventGroup = DIMENSION_GROUPS.find((group) => group.category === "事件类型");
  const actGroup = DIMENSION_GROUPS.find((group) => group.category === "行为类型");
  const entityItems = entityGroup?.items ?? [];
  const activeEntityItems = entityItems.filter((item) => selected.has(item.key));
  const selectableAxisKeys = axisCandidates(config.selectedDimensions);
  const constraintKeys = config.selectedDimensions.filter(
    (key) => key !== config.rowKey && key !== config.columnKey,
  );

  useEffect(() => {
    childSelectionCache.current.clear();
  }, [cacheEpoch]);

  const update = (patch: Partial<AnalysisConfig>) => onChange({ ...config, ...patch });

  const commitSelection = (nextSelected: DimensionKey[]) => {
    const axes = autoAssignAxes(nextSelected);
    onChange(withCompatibleChart(
      { ...config, selectedDimensions: nextSelected },
      axes,
    ));
  };

  const handleToggleItem = (item: DimensionItem) => {
    const removing = selected.has(item.key);
    if (item.children?.length) {
      const childKeys = new Set(item.children.map((child) => child.key));
      if (removing) {
        const selectedChildren = config.selectedDimensions.filter((key) => childKeys.has(key));
        if (selectedChildren.length) {
          childSelectionCache.current.set(item.key, selectedChildren);
        }
        commitSelection(
          config.selectedDimensions.filter((key) => key !== item.key && !childKeys.has(key)),
        );
        return;
      }

      const cachedChildren = childSelectionCache.current.get(item.key) ?? [];
      commitSelection([
        ...config.selectedDimensions,
        item.key,
        ...cachedChildren.filter((key) => !selected.has(key)),
      ]);
      return;
    }

    commitSelection(
      removing
        ? config.selectedDimensions.filter((key) => key !== item.key)
        : [...config.selectedDimensions, item.key],
    );
  };

  const handleToggleSubtype = (parent: DimensionItem, child: DimensionItem) => {
    if (!selected.has(parent.key)) return;
    const removing = selected.has(child.key);
    const nextSelected = removing
      ? config.selectedDimensions.filter((key) => key !== child.key)
      : [...config.selectedDimensions, child.key];
    const selectedChildren = nextSelected.filter((key) =>
      parent.children?.some((candidate) => candidate.key === key),
    );
    childSelectionCache.current.set(parent.key, selectedChildren);
    commitSelection(nextSelected);
  };

  const handleSelectAllSubtypes = (parent: DimensionItem) => {
    const childKeys = new Set(parent.children?.map((child) => child.key) ?? []);
    childSelectionCache.current.set(parent.key, []);
    commitSelection(config.selectedDimensions.filter((key) => !childKeys.has(key)));
  };

  const handleAddFilter = () => {
    filterIdCounter += 1;
    const filter: Filter = {
      id: `filter_${Date.now()}_${filterIdCounter}`,
      dimension: "recipient",
      operator: "equals",
      value: "",
    };
    update({ filters: [...config.filters, filter] });
  };

  const handleUpdateFilter = (updated: Filter) => {
    update({
      filters: config.filters.map((filter) => filter.id === updated.id ? updated : filter),
    });
  };

  const handleRemoveFilter = (id: string) => {
    update({ filters: config.filters.filter((filter) => filter.id !== id) });
  };

  const handleRowChange = (rowKey: DimensionKey) => {
    const axes = {
      rowKey,
      columnKey: config.columnKey === rowKey ? null : config.columnKey,
    };
    onChange(withCompatibleChart(config, axes));
  };

  const handleColumnChange = (columnKey: DimensionKey | null) => {
    const axes = {
      rowKey: config.rowKey,
      columnKey: columnKey === config.rowKey ? null : columnKey,
    };
    onChange(withCompatibleChart(config, axes));
  };

  const chartReason = getChartIncompatibilityReason(
    config.chartType,
    config.rowKey,
    config.columnKey,
  );

  const showDetailScope = activeEntityItems.length > 0;

  return (
    <section className="font-serif text-[var(--ink)]">
      <div className="space-y-[20px]">
        {/* 大标题 */}
        <div className="mb-0">
          <h2 className="text-[20px] font-semibold tracking-[.04em] text-[var(--ink)] sm:text-[22px]">
            选择分析维度
          </h2>
        </div>

        {/* 统一维度面板 */}
        <div className="space-y-[20px]">

          {/* 综合：年份、时期、收信人 */}
          <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
            <h3 className="pt-1.5 text-[13px] font-medium text-[var(--purple-deep)]">综合</h3>
            <div className="flex min-w-0 flex-wrap gap-2.5">
              {timeGroup?.items.map((item) => (
                <ChoiceChip
                  key={item.key}
                  label={item.label}
                  selected={selected.has(item.key)}
                  onToggle={() => handleToggleItem(item)}
                />
              ))}
            </div>
          </div>

          {/* 实体类型 */}
          <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
            <h3 className="pt-1.5 text-[13px] font-medium text-[var(--purple-deep)]">实体类型</h3>
            <div className="flex min-w-0 flex-wrap gap-2.5">
              {entityItems.map((item) => {
                const code = item.key.split(":")[1];
                const label = item.label.replace(/（[^）]+）$/, "");
                return (
                  <ChoiceChip
                    key={item.key}
                    label={label}
                    code={code}
                    selected={selected.has(item.key)}
                    onToggle={() => handleToggleItem(item)}
                  />
                );
              })}
            </div>
          </div>

          {/* 细分范围：只在选中实体类型时显示，不用分割线 */}
          {showDetailScope && (
            <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
              <div className="pt-1.5">
                <h3 className="text-[13px] font-medium text-[var(--purple-deep)]">细分范围</h3>
                <p className="mt-0.5 text-[10px] leading-4 text-[var(--muted)]">
                  可选；未选择细分项时，默认包含全部内容。
                </p>
              </div>
              <div className="min-w-0">
                {activeEntityItems.map((parent) => {
                  const children = parent.children ?? [];
                  const hasSelectedChild = children.some((child) => selected.has(child.key));
                  const parentLabel = parent.label.replace(/（[^）]+）$/, "");
                  const parentCode = parent.key.split(":")[1];
                  return (
                    <div key={parent.key} className="mb-3 last:mb-0">
                      <p className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">
                        {parentLabel}
                        <span className="ml-1.5 font-sans text-[8px] font-extrabold tracking-[.16em] text-[var(--muted)]">
                          {parentCode}
                        </span>
                      </p>
                      {children.length ? (
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <ChoiceChip
                            label={`全部${parentLabel}`}
                            selected={!hasSelectedChild}
                            onToggle={() => handleSelectAllSubtypes(parent)}
                            ariaLabel={`分析全部${parentLabel}`}
                          />
                          {children.map((child) => (
                            <ChoiceChip
                              key={child.key}
                              label={child.label}
                              selected={selected.has(child.key)}
                              onToggle={() => handleToggleSubtype(parent, child)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-[var(--muted)]">
                          该维度暂未设置细分项，将按全部内容分析。
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 事件类型 */}
          <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
            <h3 className="pt-1.5 text-[13px] font-medium text-[var(--purple-deep)]">事件类型</h3>
            <div className="flex min-w-0 flex-wrap gap-2.5">
              {eventGroup?.items.map((item) => (
                <ChoiceChip
                  key={item.key}
                  label={item.label}
                  selected={selected.has(item.key)}
                  onToggle={() => handleToggleItem(item)}
                />
              ))}
            </div>
          </div>

          {/* 行为类型 */}
          <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
            <h3 className="pt-1.5 text-[13px] font-medium text-[var(--purple-deep)]">行为类型</h3>
            <div className="flex min-w-0 flex-wrap gap-2.5">
              {actGroup?.items.map((item) => (
                <ChoiceChip
                  key={item.key}
                  label={item.label}
                  selected={selected.has(item.key)}
                  onToggle={() => handleToggleItem(item)}
                />
              ))}
            </div>
          </div>

        </div>

        {/* 行列配置 */}
        <section aria-labelledby="axis-config-heading" className="pt-2">
          <div className="mb-3">
            <h2 id="axis-config-heading" className="text-[17px] font-semibold tracking-[.04em] text-[var(--ink)]">
              行列配置
            </h2>
            <p className="mt-1 text-[15px] leading-6 text-[var(--muted)]">
              可调整数据透视表结构、统计口径与图表表达。
            </p>
          </div>

          <div className="grid gap-4 border border-[var(--line)] bg-[rgba(240,236,226,.46)] p-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-[16px] leading-6 text-[var(--muted)]">行</span>
              <select
                value={config.rowKey ?? ""}
                disabled={!selectableAxisKeys.length}
                onChange={(event) => handleRowChange(event.target.value as DimensionKey)}
                className={fieldClass}
              >
                {!config.rowKey ? <option value="">未设置</option> : null}
                {selectableAxisKeys.map((key) => (
                  <option key={key} value={key} disabled={key === config.columnKey}>
                    {getDimensionKeyLabel(key)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[16px] leading-6 text-[var(--muted)]">列</span>
              <select
                value={config.columnKey ?? ""}
                disabled={!selectableAxisKeys.length}
                onChange={(event) => handleColumnChange(
                  event.target.value ? event.target.value as DimensionKey : null,
                )}
                className={fieldClass}
              >
                <option value="">不设置列维度</option>
                {selectableAxisKeys.map((key) => (
                  <option key={key} value={key} disabled={key === config.rowKey}>
                    {getDimensionKeyLabel(key)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[16px] leading-6 text-[var(--muted)]">统计指标</span>
              <select
                value={config.metric}
                onChange={(event) => update({
                  metric: event.target.value as AnalysisConfig["metric"],
                })}
                className={fieldClass}
              >
                {METRICS.map((metric) => (
                  <option key={metric.id} value={metric.id}>{metric.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[16px] leading-6 text-[var(--muted)]">图表类型</span>
              <select
                value={config.chartType}
                onChange={(event) => update({ chartType: event.target.value as ChartType })}
                className={fieldClass}
              >
                {CHART_TYPES.map((chartType) => {
                  const reason = getChartIncompatibilityReason(
                    chartType.id,
                    config.rowKey,
                    config.columnKey,
                  );
                  return (
                    <option key={chartType.id} value={chartType.id} disabled={Boolean(reason)}>
                      {chartType.label}{reason ? `（${reason}）` : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            {constraintKeys.length ? (
              <div className="md:col-span-2 xl:col-span-4">
                <p className="text-[15px] leading-6 text-[var(--muted)]">其余维度将作为限定条件：</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {constraintKeys.map((key) => (
                    <span
                      key={key}
                      className="border border-[var(--line-dark)] bg-[var(--surface)] px-2 py-1 text-[15px] text-[var(--purple-deep)]"
                    >
                      {getDimensionKeyLabel(key)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {chartReason ? (
              <p className="text-[15px] leading-6 text-[var(--red)] md:col-span-2 xl:col-span-4">
                当前图表不可用：{chartReason}
              </p>
            ) : null}
          </div>
        </section>

        {/* 筛选条件 */}
        <section aria-labelledby="filter-heading" className="pt-2">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 id="filter-heading" className="text-[17px] font-semibold tracking-[.04em] text-[var(--ink)]">
                筛选条件
              </h2>
              <p className="mt-1 text-[15px] leading-6 text-[var(--muted)]">可选，多条条件按“且”关系应用</p>
            </div>
            <span className="text-[15px] text-[#9a949a]">{config.filters.length} 条</span>
          </div>

          {config.filters.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {config.filters.map((filter) => (
                <FilterRow
                  key={filter.id}
                  filter={filter}
                  onUpdate={handleUpdateFilter}
                  onRemove={handleRemoveFilter}
                />
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-[var(--line)] px-3 py-3 text-center text-[15px] text-[#9a949a]">
              当前显示全部数据
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAddFilter}
              className="border border-[var(--line-dark)] bg-transparent px-3 py-2 text-[15px] font-serif text-[var(--purple)] transition hover:border-[var(--purple)] hover:bg-[var(--purple-pale)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
            >
              ＋ 添加筛选
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-[15px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={config.excludeUnknownYear}
                onChange={(event) => update({ excludeUnknownYear: event.target.checked })}
                className="size-4 accent-[var(--purple)]"
              />
              排除无年份书信（{unknownYearCount} 封）
            </label>
          </div>
        </section>

        {/* 已选条件摘要 */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <h2 className="mr-1 text-[15px] font-medium text-[var(--muted)]">已选条件：</h2>
          {config.selectedDimensions.length ? (
            config.selectedDimensions.map((key) => {
              const item = getDimensionItem(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (!item) return;
                    if (item.parentKey) {
                      const parent = getDimensionItem(item.parentKey);
                      if (parent) handleToggleSubtype(parent, item);
                      return;
                    }
                    handleToggleItem(item);
                  }}
                  className="inline-flex min-h-7 items-center gap-1.5 border border-[#c9c2d4] bg-[var(--purple-pale)] px-2.5 py-1 text-[15px] font-serif text-[var(--purple-deep)] transition hover:border-[var(--purple)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
                  aria-label={`取消${getDimensionKeyLabel(key)}`}
                >
                  {getDimensionKeyLabel(key)}
                  <span aria-hidden="true">×</span>
                </button>
              );
            })
          ) : (
            <span className="text-[15px] text-[#9b959a]">尚未选择</span>
          )}
        </div>

        {/* 开始分析 */}
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center pt-2">
          <p className="text-[15px] leading-6 text-[var(--muted)]" aria-live="polite">
            {selectableAxisKeys.length
              ? `已选择 ${selectableAxisKeys.length} 个分析维度`
              : "请至少勾选一个维度"}
          </p>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!selectableAxisKeys.length || !config.rowKey || Boolean(chartReason)}
            className="h-[52px] w-full bg-[var(--purple)] px-7 text-[16px] font-serif font-medium text-white transition hover:bg-[var(--purple-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] disabled:cursor-not-allowed disabled:bg-[#b7b1bd] disabled:text-white sm:w-auto"
          >
            <span className="text-white">开始分析</span>
          </button>
        </div>
      </div>
    </section>
  );
}
