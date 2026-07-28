"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { buildChartOption, echarts } from "@/lib/analysis/echarts-builder";
import {
  CHART_TYPES,
  getDimensionKeyLabel,
  getChartIncompatibilityReason,
  METRICS,
} from "@/lib/analysis/dimensions";
import type {
  AnalysisConfig,
  ChartType,
  PivotResult,
} from "@/lib/analysis/types";

interface ChartPanelProps {
  result: PivotResult | null;
  config: AnalysisConfig;
  loading: boolean;
  onChartTypeChange: (chartType: ChartType) => void;
}

const CHART_SERIF_FONT = '"Noto Serif SC", "Songti SC", STSong, SimSun, serif';

function flatHeaderCount(headers: PivotResult["rowHeaders"]): number {
  return headers.reduce((count, header) => count + (header.children?.length ?? 1), 0);
}

function ChartState({
  symbol,
  title,
  description,
}: {
  symbol: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid h-full min-h-0 place-items-center px-8 py-12 text-center font-serif">
      <div>
        <span className="mx-auto grid size-10 place-items-center border border-[var(--line)] font-serif text-[15px] text-[var(--purple)]">
          {symbol}
        </span>
        <p className="mt-4 font-serif text-[15px] text-[var(--ink)]">{title}</p>
        <p className="mt-1.5 text-[10px] leading-5 text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

export function ChartPanel({
  result,
  config,
  loading,
  onChartTypeChange,
}: ChartPanelProps) {
  const chartRef = useRef<ReactEChartsCore | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [exportStatus, setExportStatus] = useState("");

  const option = useMemo(() => {
    if (!result) return null;
    const builtOption = buildChartOption(config, result);
    return {
      ...builtOption,
      textStyle: {
        ...builtOption.textStyle,
        fontFamily: CHART_SERIF_FONT,
      },
    };
  }, [config, result]);

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !chartContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
    });
    resizeObserver.observe(chartContainerRef.current);

    const handleWindowResize = () => instance.resize();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [option]);

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    requestAnimationFrame(() => {
      instance.resize();
    });
  }, [option]);

  const rowCount = result ? flatHeaderCount(result.rowHeaders) : 0;
  const columnCount = result ? flatHeaderCount(result.columnHeaders) : 0;
  const largestAxis = Math.max(rowCount, columnCount);
  const footerDimensionKey = config.columnKey ?? config.rowKey;
  const footerDimensionLabel = footerDimensionKey
    ? getDimensionKeyLabel(footerDimensionKey).replace(/（.*$/, "")
    : "维度";
  const footerValueCount = config.columnKey ? columnCount : rowCount;
  const metricLabel = METRICS.find((metric) => metric.id === config.metric)?.label ?? "数值";

  const handleExportImage = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const dataUrl = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fffef9",
    });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = "叶德辉书信_维度分析图表.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setExportStatus("图片已导出");
    window.setTimeout(() => setExportStatus(""), 1800);
  };

  let content;
  if (loading) {
    content = (
      <div className="grid h-full min-h-0 place-items-center">
        <span className="size-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--purple)]" />
      </div>
    );
  } else if (!result || !option) {
    content = (
      <ChartState
        symbol="图"
        title="图表等待分析"
        description="勾选维度并点击“开始分析”后，图表将在这里呈现。"
      />
    );
  } else if (result.grandTotal === 0) {
    content = (
      <ChartState
        symbol="空"
        title="没有可绘制的数据"
        description="当前组合的统计值均为零，请调整维度、指标或筛选条件。"
      />
    );
  } else if (largestAxis > 100 && config.chartType !== "heatmap") {
    content = (
      <ChartState
        symbol="多"
        title={`当前包含 ${largestAxis.toLocaleString("zh-CN")} 个维度值`}
        description="为保持图表清晰和页面流畅，建议切换热力图或通过筛选缩小范围。"
      />
    );
  } else if (config.chartType === "radar" && rowCount > 8) {
    content = (
      <ChartState
        symbol="限"
        title="雷达图维度过多"
        description={`当前有 ${rowCount} 个行维度值；雷达图适合 6—8 个以内，请先缩小范围。`}
      />
    );
  } else {
    content = (
      <div ref={chartContainerRef} className="absolute inset-0 min-h-0 min-w-0">
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={option}
          style={{ height: "100%", width: "100%" }}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
        />
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] font-serif shadow-[0_4px_18px_rgba(39,36,42,.035)]">
      <header className="flex h-24 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4">
        <div>
          <span className="text-[8px] font-bold tracking-[.14em] text-[var(--purple)]">图形视图</span>
          <h2 className="mt-1 font-serif text-[16px] tracking-[.03em]">图表</h2>
        </div>
        <div className="flex items-center justify-end gap-2.5">
          <select
            aria-label="切换图表类型"
            value={config.chartType}
            onChange={(event) => onChartTypeChange(event.target.value as ChartType)}
            className="h-8 w-[220px] max-w-[240px] border border-[var(--line-dark)] bg-[var(--surface)] px-2 font-serif text-[9px] outline-none focus:border-[var(--purple)]"
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
          <button
            type="button"
            onClick={handleExportImage}
            disabled={!result || result.grandTotal === 0 || !option}
            className="h-8 w-[108px] border border-[var(--line-dark)] px-2.5 font-serif text-[9px] text-[var(--purple)] transition hover:border-[var(--purple)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            导出图片
          </button>
          <span className="sr-only" aria-live="polite">
            {exportStatus}
          </span>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">{content}</div>
      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--line)] px-4 text-[12px] text-[var(--muted)]">
        <span>{footerValueCount.toLocaleString("zh-CN")} 个{footerDimensionLabel}</span>
        <span>指标：{metricLabel}</span>
      </footer>
    </section>
  );
}
