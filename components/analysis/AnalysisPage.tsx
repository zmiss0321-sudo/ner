"use client";

import { useCallback, useState } from "react";
import { computePivot, flattenPivot } from "@/lib/analysis/aggregator";
import { getDimensionKeyLabel } from "@/lib/analysis/dimensions";
import { dataset } from "@/lib/data-adapter";
import type {
  AnalysisConfig,
  AnalysisTemplate,
  ChartType,
  PivotResult,
} from "@/lib/analysis/types";
import { ChartPanel } from "./ChartPanel";
import { DimensionPanel } from "./DimensionPanel";
import { PivotTable } from "./PivotTable";
import { TemplatePicker } from "./TemplatePicker";

const UNKNOWN_YEAR_COUNT = dataset.letters.filter((letter) => !letter.year).length;

const DEFAULT_CONFIG: AnalysisConfig = {
  selectedDimensions: [],
  rowKey: null,
  columnKey: null,
  metric: "letter_count",
  filters: [],
  chartType: "bar_stacked",
  excludeUnknownYear: false,
};

function createDefaultConfig(): AnalysisConfig {
  return cloneConfig(DEFAULT_CONFIG);
}

interface AnalysisRun {
  config: AnalysisConfig;
  result: PivotResult;
}

function flatColumnLabels(config: AnalysisConfig, result: PivotResult): string[] {
  if (!config.columnKey) return ["总计"];
  return result.columnHeaders.flatMap((header) =>
    header.children?.map((child) => `${header.label} · ${child.label}`) ?? [header.label],
  );
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function cloneConfig(config: AnalysisConfig): AnalysisConfig {
  return {
    ...config,
    selectedDimensions: [...config.selectedDimensions],
    filters: config.filters.map((filter) => ({
      ...filter,
      value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
    })),
  };
}

export function AnalysisPage() {
  const [config, setConfig] = useState<AnalysisConfig>(createDefaultConfig);
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [cacheEpoch, setCacheEpoch] = useState(0);

  const runAnalysis = useCallback((nextConfig: AnalysisConfig, scroll = true) => {
    const snapshot = cloneConfig(nextConfig);
    setConfig(snapshot);
    setAnalysis({
      config: snapshot,
      result: computePivot(snapshot, dataset),
    });
    setExportStatus("");
    if (scroll) {
      window.requestAnimationFrame(() => {
        document.getElementById("analysis-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  const handleTemplateSelect = useCallback((template: AnalysisTemplate) => {
    setActiveTemplateId(template.id);
    setCacheEpoch((current) => current + 1);
    runAnalysis(template.config);
  }, [runAnalysis]);

  const handleReset = useCallback(() => {
    setConfig(createDefaultConfig());
    setAnalysis(null);
    setExportStatus("");
    setActiveTemplateId(null);
    setCacheEpoch((current) => current + 1);
  }, []);

  const handleChartTypeChange = useCallback((chartType: ChartType) => {
    setActiveTemplateId(null);
    setConfig((current) => ({ ...current, chartType }));
    setAnalysis((current) => current
      ? { ...current, config: { ...current.config, chartType } }
      : current);
  }, []);

  const handleConfigChange = useCallback((nextConfig: AnalysisConfig) => {
    setConfig(nextConfig);
    setActiveTemplateId(null);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!analysis) return;
    const { config: appliedConfig, result } = analysis;
    const rows = flattenPivot(result);
    const columnLabels = flatColumnLabels(appliedConfig, result);
    const hasNestedRows = rows.some((row) => row.subLabel !== null);
    const header = [
      ...(hasNestedRows ? ["主维度", "子维度"] : ["维度"]),
      ...columnLabels,
      "合计",
    ];
    const body = rows.map((row) => [
      row.mainLabel,
      ...(hasNestedRows ? [row.subLabel ?? ""] : []),
      ...row.values,
      row.total,
    ]);
    const totalRow = [
      "合计",
      ...(hasNestedRows ? [""] : []),
      ...result.columnTotals,
      result.grandTotal,
    ];
    const csv = [header, ...body, totalRow]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "叶德辉书信_维度分析结果.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportStatus("CSV 已导出");
    window.setTimeout(() => setExportStatus(""), 2200);
  }, [analysis]);

  const appliedConstraintKeys = analysis
    ? analysis.config.selectedDimensions.filter(
        (key) => key !== analysis.config.rowKey && key !== analysis.config.columnKey,
      )
    : [];

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-20 font-serif">
      <div className="site-container">
        <header className="flex flex-col gap-5 border-b border-[var(--line)] py-9 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold tracking-[.18em] text-[var(--purple)]">
              书信标注数据探索
            </p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-[.06em] text-[var(--ink)] sm:text-[34px]">
              自选维度分析
            </h1>
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              交叉观察书信中的实体、事件与行为
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <TemplatePicker
              activeTemplateId={activeTemplateId}
              onSelect={handleTemplateSelect}
            />
            <button
              type="button"
              onClick={handleReset}
              className="h-9 border border-[var(--line-dark)] bg-[var(--surface)] px-3 text-[11px] text-[var(--ink)] transition hover:border-[var(--purple)] hover:text-[var(--purple)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
            >
              重置
            </button>
          </div>
        </header>

        <section className="mt-7 border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center sm:py-16">
          <span className="mx-auto grid size-10 place-items-center border border-[var(--line-dark)] text-[16px] text-[var(--purple)]">
            选
          </span>
          <p className="mt-4 text-[19px] font-medium tracking-[.04em] text-[var(--ink)]">
            精选分析视图
          </p>
          <p className="mt-2 text-[11px] text-[var(--muted)]">即将呈现，敬请期待</p>
        </section>

        <div className="my-10 flex items-center gap-4">
          <span className="h-px flex-1 bg-[var(--line)]" />
          <p className="shrink-0 text-center text-[14px] text-[var(--purple-deep)] sm:text-[16px]">
            想自己探索？勾选维度开始分析
          </p>
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <DimensionPanel
          config={config}
          onChange={handleConfigChange}
          onAnalyze={() => runAnalysis(config)}
          unknownYearCount={UNKNOWN_YEAR_COUNT}
          cacheEpoch={cacheEpoch}
        />

        {analysis ? (
          <section id="analysis-results" className="scroll-mt-20 pt-14">
            <header className="mb-5 border-b border-[var(--line-dark)] pb-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-semibold tracking-[.16em] text-[var(--purple)]">
                    当前分析结果
                  </p>
                  <h2 className="mt-1 text-[24px] font-semibold tracking-[.05em]">
                    分析结果
                  </h2>
                </div>
                <p className="text-[10px] text-[var(--muted)]">
                  行：{analysis.config.rowKey ? getDimensionKeyLabel(analysis.config.rowKey) : "未设置"}
                  <span className="px-2">·</span>
                  列：{analysis.config.columnKey ? getDimensionKeyLabel(analysis.config.columnKey) : "无"}
                </p>
              </div>
              {appliedConstraintKeys.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[9px] text-[var(--muted)]">限定维度：</span>
                  {appliedConstraintKeys.map((key) => (
                    <span
                      key={key}
                      className="border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[9px] text-[var(--purple-deep)]"
                    >
                      {getDimensionKeyLabel(key)}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <div className="grid min-w-0 auto-rows-[640px] items-stretch gap-6 min-[1200px]:h-[clamp(620px,72vh,760px)] min-[1200px]:auto-rows-fr min-[1200px]:grid-cols-2">
              <PivotTable
                result={analysis.result}
                config={analysis.config}
                loading={false}
                onExportCsv={handleExportCsv}
                exportStatus={exportStatus}
              />
              <ChartPanel
                result={analysis.result}
                config={analysis.config}
                loading={false}
                onChartTypeChange={handleChartTypeChange}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
