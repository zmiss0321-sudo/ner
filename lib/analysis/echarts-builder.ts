import { annotationStyles } from "@/lib/config";
import { BarChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { AnalysisConfig, PivotResult } from "./types";

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  RadarChart,
  ScatterChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
  CanvasRenderer,
]);

export { echarts };

const CHART_COLORS = [
  ...Object.values(annotationStyles.entity).map((style) => style.color),
  ...Object.values(annotationStyles.event).map((style) => style.accent),
  "#9a7c45",
  "#4f477e",
  "#4f7367",
  "#944b48",
];

const CHART_FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

function flatLabels(headers: PivotResult["rowHeaders"]): string[] {
  return headers.flatMap((header) =>
    header.children?.map((child) => `${header.label} · ${child.label}`) ?? [header.label],
  );
}

function categoryZoom(labelCount: number) {
  if (labelCount <= 16) return undefined;
  const end = Math.max(12, 1600 / labelCount);
  return [
    {
      type: "slider" as const,
      height: 18,
      left: 60,
      right: 28,
      bottom: 58,
      start: 0,
      end,
    },
    { type: "inside" as const, start: 0, end },
  ];
}

function scrollLegend(data?: string[]) {
  return {
    type: "scroll" as const,
    data,
    left: 18,
    right: 18,
    bottom: 14,
    height: 26,
    orient: "horizontal" as const,
    itemWidth: 18,
    itemHeight: 12,
    itemGap: 14,
    pageIconSize: 12,
    pageButtonGap: 6,
    pageButtonItemGap: 6,
    pageTextStyle: { fontSize: 12 },
    textStyle: { fontSize: 12 },
  };
}

function buildStackedBar(result: PivotResult): EChartsOption {
  const columnLabels = flatLabels(result.columnHeaders);
  const rowLabels = flatLabels(result.rowHeaders);
  const singleDimension = columnLabels.length === 1 && columnLabels[0] === "总计";
  if (singleDimension) {
    return {
      color: CHART_COLORS,
      textStyle: { fontFamily: CHART_FONT },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 58, right: 28, top: 52, bottom: 130, containLabel: true },
      dataZoom: categoryZoom(rowLabels.length),
      xAxis: {
        type: "category",
        data: rowLabels,
        axisLabel: { rotate: rowLabels.length > 10 ? 42 : 0, color: "#777178", fontSize: 12 },
        axisLine: { lineStyle: { color: "#d9d4ca" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#777178", fontSize: 12 },
        splitLine: { lineStyle: { color: "#ebe7df" } },
      },
      series: [{
        name: "数值",
        type: "bar",
        data: result.rowTotals,
        barMaxWidth: 42,
        itemStyle: { color: "#4f477e" },
      }],
    };
  }
  return {
    color: CHART_COLORS,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: scrollLegend(rowLabels),
    grid: { left: 58, right: 28, top: 52, bottom: 130, containLabel: true },
    dataZoom: categoryZoom(columnLabels.length),
    xAxis: {
      type: "category",
      data: columnLabels,
      axisLabel: { rotate: columnLabels.length > 10 ? 42 : 0, color: "#777178", fontSize: 12 },
      axisLine: { lineStyle: { color: "#d9d4ca" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#777178", fontSize: 12 },
      splitLine: { lineStyle: { color: "#ebe7df" } },
    },
    series: rowLabels.map((label, index) => ({
      name: label,
      type: "bar",
      stack: "total",
      data: result.cells[index] ?? [],
      emphasis: { focus: "series" },
      barMaxWidth: 34,
    })),
  };
}

function buildHeatmap(result: PivotResult): EChartsOption {
  const columnLabels = flatLabels(result.columnHeaders);
  const rowLabels = flatLabels(result.rowHeaders);
  const data: [number, number, number][] = [];
  for (let rowIndex = 0; rowIndex < result.cells.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < (result.cells[rowIndex]?.length ?? 0); columnIndex += 1) {
      const value = result.cells[rowIndex][columnIndex];
      if (value > 0) data.push([columnIndex, rowIndex, value]);
    }
  }
  const maxValue = Math.max(...data.map((item) => item[2]), 1);

  return {
    textStyle: { fontFamily: CHART_FONT },
    tooltip: {
      position: "top",
      formatter: (params) => {
        const value = Array.isArray(params) ? params[0]?.value : params.value;
        if (!Array.isArray(value)) return "";
        return `${rowLabels[Number(value[1])] ?? ""}<br/>${columnLabels[Number(value[0])] ?? ""}：${Number(value[2]).toLocaleString("zh-CN")}`;
      },
    },
    grid: {
      left: rowLabels.some((label) => label.length > 8) ? 118 : 82,
      right: 28,
      bottom: 130,
      top: 52,
      containLabel: false,
    },
    dataZoom: categoryZoom(columnLabels.length),
    xAxis: {
      type: "category",
      data: columnLabels,
      splitArea: { show: true, areaStyle: { color: ["#fffef9", "#fbfaf5"] } },
      axisLabel: { rotate: columnLabels.length > 10 ? 42 : 0, color: "#777178", fontSize: 12 },
      axisLine: { lineStyle: { color: "#d9d4ca" } },
    },
    yAxis: {
      type: "category",
      data: rowLabels,
      splitArea: { show: true, areaStyle: { color: ["#fffef9", "#fbfaf5"] } },
      axisLabel: { color: "#777178", width: 105, overflow: "truncate", fontSize: 12 },
      axisLine: { lineStyle: { color: "#d9d4ca" } },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 14,
      inRange: { color: ["#f3f1eb", "#c8d1d6", "#5b798d"] },
      textStyle: { color: "#777178", fontSize: 12 },
    },
    series: [{
      type: "heatmap",
      data,
      label: { show: result.cells.length <= 16 && columnLabels.length <= 16, color: "#35305d" },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(39,36,42,.22)" } },
    }],
  };
}

function buildLine(result: PivotResult): EChartsOption {
  const columnLabels = flatLabels(result.columnHeaders);
  const rowLabels = flatLabels(result.rowHeaders);
  return {
    color: CHART_COLORS,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: { trigger: "axis" },
    legend: scrollLegend(rowLabels),
    grid: { left: 58, right: 28, top: 52, bottom: 130, containLabel: true },
    dataZoom: categoryZoom(columnLabels.length),
    xAxis: {
      type: "category",
      data: columnLabels,
      boundaryGap: false,
      axisLabel: { rotate: columnLabels.length > 10 ? 42 : 0, color: "#777178", fontSize: 12 },
      axisLine: { lineStyle: { color: "#d9d4ca" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#777178", fontSize: 12 },
      splitLine: { lineStyle: { color: "#ebe7df" } },
    },
    series: rowLabels.map((label, index) => ({
      name: label,
      type: "line",
      data: result.cells[index] ?? [],
      showSymbol: columnLabels.length <= 18,
      symbolSize: 6,
      smooth: true,
      areaStyle: { opacity: 0.06 },
      emphasis: { focus: "series" },
    })),
  };
}

function buildPie(result: PivotResult, rose: boolean): EChartsOption {
  const rowLabels = flatLabels(result.rowHeaders);
  const data = rowLabels
    .map((label, index) => ({ name: label, value: result.rowTotals[index] ?? 0 }))
    .filter((item) => item.value > 0);

  return {
    color: CHART_COLORS,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: { trigger: "item", formatter: "{b}<br/>{c}（{d}%）" },
    legend: scrollLegend(),
    series: [{
      type: "pie",
      radius: rose ? ["18%", "68%"] : ["40%", "68%"],
      center: ["50%", "45%"],
      roseType: rose ? "area" : undefined,
      minAngle: 2,
      itemStyle: { borderColor: "#fffef9", borderWidth: 2 },
      label: { show: data.length <= 18, formatter: "{b}\n{d}%", color: "#5f5960" },
      data,
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(39,36,42,.2)" },
      },
    }],
  };
}

function buildSankey(result: PivotResult): EChartsOption {
  const rowLabels = flatLabels(result.rowHeaders);
  const columnLabels = flatLabels(result.columnHeaders);
  const nodes = [
    ...rowLabels.map((label) => ({
      name: `row:${label}`,
      label: { formatter: label },
    })),
    ...columnLabels.map((label) => ({
      name: `column:${label}`,
      label: { formatter: label },
    })),
  ];
  const links: { source: string; target: string; value: number }[] = [];
  for (let rowIndex = 0; rowIndex < result.cells.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < (result.cells[rowIndex]?.length ?? 0); columnIndex += 1) {
      const value = result.cells[rowIndex][columnIndex];
      if (value > 0) {
        links.push({
          source: `row:${rowLabels[rowIndex]}`,
          target: `column:${columnLabels[columnIndex]}`,
          value,
        });
      }
    }
  }

  return {
    color: CHART_COLORS,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: { trigger: "item", triggerOn: "mousemove" },
    series: [{
      type: "sankey",
      left: 28,
      right: 72,
      top: 52,
      bottom: 32,
      nodeWidth: 18,
      nodeGap: 12,
      layoutIterations: 32,
      emphasis: { focus: "adjacency" },
      lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
      label: { show: true, color: "#5f5960", fontSize: 12, overflow: "truncate", width: 96 },
      data: nodes,
      links,
    }],
  };
}

function buildRadar(result: PivotResult): EChartsOption {
  const rowLabels = flatLabels(result.rowHeaders);
  const columnLabels = flatLabels(result.columnHeaders);
  const maxValues = rowLabels.map((_, rowIndex) =>
    Math.max(...(result.cells[rowIndex] ?? []), result.rowTotals[rowIndex] ?? 0, 1),
  );
  const useColumns = columnLabels.length > 1 && columnLabels.length <= 8;
  const seriesData = useColumns
    ? columnLabels.map((label, columnIndex) => ({
        name: label,
        value: result.cells.map((row) => row[columnIndex] ?? 0),
      }))
    : [{ name: "总计", value: result.rowTotals }];

  return {
    color: CHART_COLORS,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: {},
    legend: useColumns ? scrollLegend(columnLabels) : undefined,
    radar: {
      indicator: rowLabels.map((label, index) => ({ name: label, max: maxValues[index] })),
      center: ["50%", "49%"],
      radius: "64%",
      axisName: { color: "#5f5960", fontSize: 11 },
      splitLine: { lineStyle: { color: "#d9d4ca" } },
      splitArea: { areaStyle: { color: ["#fffef9", "#f8f6f0"] } },
    },
    series: [{ type: "radar", data: seriesData, areaStyle: { opacity: 0.12 } }],
  };
}

function buildScatter(result: PivotResult): EChartsOption {
  const columnLabels = flatLabels(result.columnHeaders);
  const rowLabels = flatLabels(result.rowHeaders);
  const maxValue = Math.max(...result.cells.flat(), 1);
  return {
    color: CHART_COLORS,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: {
      trigger: "item",
      formatter: (rawParams) => {
        const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
        const rawValue = params && "value" in params ? params.value : [];
        const value = Array.isArray(rawValue) ? rawValue : [];
        const seriesName = params && "seriesName" in params ? params.seriesName : "";
        return `${seriesName ?? ""}<br/>${columnLabels[Number(value[0])] ?? ""}：${Number(value[1] ?? 0).toLocaleString("zh-CN")}`;
      },
    },
    legend: scrollLegend(rowLabels),
    grid: { left: 58, right: 28, top: 52, bottom: 130, containLabel: true },
    dataZoom: categoryZoom(columnLabels.length),
    xAxis: {
      type: "category",
      data: columnLabels,
      axisLabel: { rotate: columnLabels.length > 10 ? 42 : 0, color: "#777178", fontSize: 12 },
      axisLine: { lineStyle: { color: "#d9d4ca" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#777178", fontSize: 12 },
      splitLine: { lineStyle: { color: "#ebe7df" } },
    },
    series: rowLabels.map((label, rowIndex) => ({
      name: label,
      type: "scatter",
      data: (result.cells[rowIndex] ?? [])
        .map((value, columnIndex) => [columnIndex, value, value])
        .filter((item) => item[1] > 0),
      symbolSize: (value: number[]) => 7 + Math.sqrt(value[2] / maxValue) * 28,
      emphasis: { focus: "series" },
    })),
  };
}

export function buildChartOption(
  config: AnalysisConfig,
  result: PivotResult,
): EChartsOption {
  switch (config.chartType) {
    case "bar_stacked":
      return buildStackedBar(result);
    case "heatmap":
      return buildHeatmap(result);
    case "line":
      return buildLine(result);
    case "pie_ring":
      return buildPie(result, false);
    case "pie_rose":
      return buildPie(result, true);
    case "sankey":
      return buildSankey(result);
    case "radar":
      return buildRadar(result);
    case "scatter":
      return buildScatter(result);
  }
}
