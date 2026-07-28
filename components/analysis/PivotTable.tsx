"use client";

import { useMemo, useState } from "react";
import { flattenPivot } from "@/lib/analysis/aggregator";
import { METRICS } from "@/lib/analysis/dimensions";
import type { AnalysisConfig, PivotResult } from "@/lib/analysis/types";

interface PivotTableProps {
  result: PivotResult | null;
  config: AnalysisConfig;
  loading: boolean;
  onExportCsv: () => void;
  exportStatus: string;
}

function getColumnLabels(result: PivotResult): string[] {
  return result.columnHeaders.flatMap((header) =>
    header.children?.map((child) => `${header.label} · ${child.label}`) ?? [header.label],
  );
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function EmptyPanel({
  symbol,
  title,
  description,
}: {
  symbol: string;
  title: string;
  description: string;
}) {
  return (
    <section className="grid min-h-64 place-items-center border border-[var(--line)] bg-[var(--surface)] px-8 py-12 text-center font-serif">
      <div>
        <span className="mx-auto grid size-10 place-items-center border border-[var(--line)] font-serif text-[15px] text-[var(--purple)]">
          {symbol}
        </span>
        <p className="mt-4 font-serif text-[15px] text-[var(--ink)]">{title}</p>
        <p className="mt-1.5 text-[10px] leading-5 text-[var(--muted)]">{description}</p>
      </div>
    </section>
  );
}

export function PivotTable({
  result,
  config,
  loading,
  onExportCsv,
  exportStatus,
}: PivotTableProps) {
  const [copyStatus, setCopyStatus] = useState("");
  const rows = useMemo(() => result ? flattenPivot(result) : [], [result]);

  const handleCopy = async () => {
    if (!result) return;
    const columnLabels = getColumnLabels(result);
    const hasNestedRows = rows.some((row) => row.subLabel !== null);
    const header = [
      ...(hasNestedRows ? ["主维度", "子维度"] : ["维度"]),
      ...columnLabels,
      "合计",
    ].join("\t");
    const body = rows.map((row) => [
      row.mainLabel,
      ...(hasNestedRows ? [row.subLabel ?? ""] : []),
      ...row.values.map(String),
      String(row.total),
    ].join("\t"));
    const totalRow = [
      "合计",
      ...(hasNestedRows ? [""] : []),
      ...result.columnTotals.map(String),
      String(result.grandTotal),
    ].join("\t");
    try {
      await copyToClipboard([header, ...body, totalRow].join("\n"));
      setCopyStatus("已复制");
    } catch {
      setCopyStatus("复制失败");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  if (loading) {
    return (
      <section className="border border-[var(--line)] bg-[var(--surface)] p-8 font-serif">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-1/3 bg-[var(--paper-deep)]" />
          <div className="h-44 bg-[var(--paper)]" />
        </div>
      </section>
    );
  }

  if (!result || !config.rowKey) {
    return (
      <EmptyPanel
        symbol="表"
        title="请选择分析维度"
        description="勾选至少一个维度并点击“开始分析”，数据透视表将在这里呈现。"
      />
    );
  }

  if (result.rowHeaders.length === 0 || result.columnHeaders.length === 0) {
    return (
      <EmptyPanel
        symbol="检"
        title="没有匹配的数据"
        description="请调整维度、筛选条件或未知年份设置。"
      />
    );
  }

  const columnLabels = getColumnLabels(result);
  const hasNestedRows = rows.some((row) => row.subLabel !== null);
  const hasNestedColumns = result.columnHeaders.some((header) => Boolean(header.children?.length));
  const maxCell = Math.max(...result.cells.flat(), 1);
  const tableWidth = 280 + (hasNestedRows ? 160 : 0) + columnLabels.length * 80 + 92;
  const rowGroupCounts = new Map<string, number>();
  for (const row of rows) {
    rowGroupCounts.set(row.mainLabel, (rowGroupCounts.get(row.mainLabel) ?? 0) + 1);
  }
  const metricLabel = METRICS.find((metric) => metric.id === config.metric)?.label ?? "数值";

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] font-serif shadow-[0_4px_18px_rgba(39,36,42,.035)]">
      <header className="flex h-24 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4">
        <div>
          <span className="text-[8px] font-bold tracking-[.14em] text-[var(--purple)]">数据视图</span>
          <h2 className="mt-1 font-serif text-[16px] tracking-[.03em]">数据透视表</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-[9px] text-[var(--green)]" aria-live="polite">
            {copyStatus || exportStatus}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 border border-[var(--line-dark)] px-2.5 font-serif text-[9px] text-[var(--purple)] transition hover:border-[var(--purple)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
          >
            复制表格
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="h-8 border border-[var(--line-dark)] px-2.5 font-serif text-[9px] text-[var(--purple)] transition hover:border-[var(--purple)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
          >
            导出 CSV
          </button>
        </div>
      </header>

      <div className="min-h-0 w-full max-w-full flex-1 overflow-auto [scrollbar-color:rgba(79,71,126,.28)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[rgba(79,71,126,.28)] [&::-webkit-scrollbar-track]:bg-transparent">
        <table
          className="table-fixed border-collapse leading-[1.45] [&_td]:!text-[15px] [&_th]:!text-[15px]"
          style={{ width: tableWidth, minWidth: tableWidth }}
        >
          <caption className="sr-only">
            自选维度分析数据透视表，度量指标为{metricLabel}
          </caption>
          <colgroup>
            <col style={{ width: 280 }} />
            {hasNestedRows ? <col style={{ width: 160 }} /> : null}
            {columnLabels.map((label, index) => (
              <col key={`${label}-${index}`} style={{ width: 80 }} />
            ))}
            <col style={{ width: 92 }} />
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={hasNestedColumns ? 2 : 1}
                className="sticky left-0 top-0 z-30 h-[52px] w-[280px] min-w-[240px] max-w-[320px] border-b border-r border-[var(--line)] bg-[var(--paper-deep)] px-4 py-2.5 align-middle text-left font-medium text-[var(--purple-deep)]"
              >
                {hasNestedRows ? "主维度" : "维度"}
              </th>
              {hasNestedRows && (
                <th
                  rowSpan={hasNestedColumns ? 2 : 1}
                  className="sticky left-[280px] top-0 z-30 h-[52px] w-40 border-b border-r border-[var(--line)] bg-[var(--paper-deep)] px-3 py-2.5 align-middle text-left font-medium text-[var(--purple-deep)]"
                >
                  子维度
                </th>
              )}
              {result.columnHeaders.map((header, index) =>
                header.children?.length ? (
                  <th
                    key={`${header.label}-${index}`}
                    colSpan={header.children.length}
                    className="sticky top-0 z-20 h-[52px] border-b border-r border-[var(--line)] bg-[var(--paper-deep)] px-2 py-2.5 align-middle text-center font-medium whitespace-nowrap text-[var(--purple-deep)]"
                  >
                    {header.label}
                  </th>
                ) : (
                  <th
                    key={`${header.label}-${index}`}
                    rowSpan={hasNestedColumns ? 2 : 1}
                    className="sticky top-0 z-20 h-[52px] w-20 border-b border-r border-[var(--line)] bg-[var(--paper-deep)] px-2 py-2.5 align-middle text-center font-medium whitespace-nowrap text-[var(--purple-deep)]"
                  >
                    {header.label}
                  </th>
                ),
              )}
              <th
                rowSpan={hasNestedColumns ? 2 : 1}
                className="sticky top-0 z-20 h-[52px] w-[92px] border-b border-l border-[var(--line-dark)] bg-[#e9e5da] px-2 py-2.5 align-middle text-center font-medium whitespace-nowrap text-[var(--purple-deep)]"
              >
                合计
              </th>
            </tr>
            {hasNestedColumns && (
              <tr>
                {result.columnHeaders.flatMap((header, headerIndex) =>
                  (header.children ?? []).map((child, childIndex) => (
                    <th
                      key={`${headerIndex}-${childIndex}`}
                      className="sticky top-[52px] z-20 h-[52px] w-20 border-b border-r border-[var(--line)] bg-[#f5f2ea] px-2 py-2.5 text-center align-middle font-normal whitespace-nowrap text-[var(--muted)]"
                    >
                      {child.label}
                    </th>
                  )),
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const firstInGroup = rowIndex === 0 || row.mainLabel !== rows[rowIndex - 1]?.mainLabel;
              const stripedClass = rowIndex % 2 === 0 ? "bg-[var(--surface)]" : "bg-[rgba(240,236,226,.34)]";
              return (
                <tr key={`${row.mainLabel}-${row.subLabel ?? ""}-${rowIndex}`} className={stripedClass}>
                  {firstInGroup && (
                    <th
                      scope="rowgroup"
                      rowSpan={hasNestedRows ? rowGroupCounts.get(row.mainLabel) : 1}
                      className={`sticky left-0 z-10 h-12 w-[280px] min-w-[240px] max-w-[320px] border-b border-r border-[var(--line)] px-4 py-2.5 align-middle text-left font-serif font-medium ${stripedClass}`}
                    >
                      <span
                        title={row.mainLabel}
                        className="block max-w-[280px] overflow-hidden whitespace-normal leading-[1.55] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                      >
                        {row.mainLabel}
                      </span>
                    </th>
                  )}
                  {hasNestedRows && (
                    <th
                      scope="row"
                      className={`sticky left-[280px] z-10 h-12 w-40 border-b border-r border-[var(--line)] px-3 py-2.5 align-middle text-left font-normal text-[var(--muted)] ${stripedClass}`}
                    >
                      <span
                        title={row.subLabel ?? undefined}
                        className="block overflow-hidden whitespace-normal leading-[1.55] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                      >
                        {row.subLabel}
                      </span>
                    </th>
                  )}
                  {row.values.map((value, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="h-12 w-20 border-b border-r border-[var(--line)] px-2 py-2.5 align-middle text-center tabular-nums"
                      style={{
                        backgroundColor: value > 0
                          ? `rgba(91, 121, 141, ${Math.max(0.04, value / maxCell * 0.2).toFixed(3)})`
                          : undefined,
                      }}
                    >
                      {value > 0 ? value.toLocaleString("zh-CN") : "—"}
                    </td>
                  ))}
                  <td className="h-12 w-[92px] border-b border-l border-[var(--line-dark)] bg-[#f5f2ea] px-2 py-2.5 align-middle text-center font-medium tabular-nums">
                    {row.total > 0 ? row.total.toLocaleString("zh-CN") : "—"}
                  </td>
                </tr>
              );
            })}
            <tr>
              <th
                colSpan={hasNestedRows ? 2 : 1}
                className="sticky bottom-0 left-0 z-30 h-[52px] border-r border-t border-[var(--line-dark)] bg-[#e9e5da] px-4 py-2.5 align-middle text-left font-serif font-medium text-[var(--purple-deep)]"
              >
                合计
              </th>
              {result.columnTotals.map((value, columnIndex) => (
                <td
                  key={columnIndex}
                  className="sticky bottom-0 z-20 h-[52px] w-20 border-r border-t border-[var(--line-dark)] bg-[#e9e5da] px-2 py-2.5 align-middle text-center font-medium tabular-nums"
                >
                  {value > 0 ? value.toLocaleString("zh-CN") : "—"}
                </td>
              ))}
              <td className="sticky bottom-0 z-20 h-[52px] w-[92px] border-l border-t border-[var(--line-dark)] bg-[#ddd7c9] px-2 py-2.5 align-middle text-center font-medium tabular-nums text-[var(--purple-deep)]">
                {result.grandTotal.toLocaleString("zh-CN")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--line)] px-4 text-[12px] text-[var(--muted)]">
        <span>{rows.length.toLocaleString("zh-CN")} 行 × {columnLabels.length.toLocaleString("zh-CN")} 列</span>
        <span>指标：{metricLabel}</span>
      </footer>
    </section>
  );
}
