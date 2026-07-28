"use client";

import { buildTextNodeMap, createSourceRange } from "@/lib/text-node-map";
import type { ActMention } from "@/lib/types";
import { useEffect, useRef, useState, useCallback } from "react";

interface TrackSegment {
  behaviorId: string;
  x: number;
  y: number;
  width: number;
  isFirst: boolean;
  isLast: boolean;
  lane: number;
}

interface Props {
  acts: ActMention[];
  activeBehaviorId: string | null;
  container: HTMLElement | null;
  showAct: boolean;
  letterText: string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

// ── Debug mode (only in development) ──
const IS_DEV = typeof window !== "undefined"
  && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// ── Debug style constants (forced visible) ──
const DEBUG_TRACK_COLOR = "#ff0000";
const DEBUG_TRACK_WIDTH = 3;
const DEBUG_DOT_RADIUS = 5;
const DEBUG_DIAMOND_SIZE = 10;

// ── Final style constants ──
const TRACK_COLOR = "rgba(70, 59, 103, 0.72)";
const TRACK_ACTIVE_COLOR = "rgba(55, 41, 92, 0.98)";
const TRACK_WIDTH = 1.25;
const TRACK_ACTIVE_WIDTH = 2;
const DOT_RADIUS = 3;
const DIAMOND_SIZE = 5.5;
const HIT_HEIGHT = 14;
const BASE_GAP = 6;       // px below text bottom
const LANE_GAP = 5;       // px between overlapping lanes
const LINE_TOLERANCE = 2; // px for merging same-row rects

interface DebugInfo {
  showThirdLayer: boolean;
  behaviorCount: number;
  validBehaviorCount: number;
  invalidBehaviorCount: number;
  mappedTextNodeCount: number;
  measuredBehaviorCount: number;
  generatedTrackSegmentCount: number;
  overlayWidth: number;
  overlayHeight: number;
  containerClientWidth: number;
  containerClientHeight: number;
  containerScrollWidth: number;
  containerScrollHeight: number;
  detail: Array<{
    id: string;
    type: string;
    start: number;
    end: number;
    quoteFromSource: string;
    startNodeFound: boolean;
    endNodeFound: boolean;
    rectCount: number;
    rects: string;
  }>;
}

export function BehaviorTrackOverlay({
  acts,
  activeBehaviorId,
  container,
  showAct,
  letterText,
  onHover,
  onSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [segments, setSegments] = useState<TrackSegment[]>([]);
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  // Separate geometry from interaction——hover/select should not clear tracks
  const segmentsRef = useRef<TrackSegment[]>([]);

  const measure = useCallback(() => {
    if (!showAct || !container || !acts.length) {
      setSegments([]);
      setDebugInfo(null);
      return;
    }

    const c = container;
    const cRect = c.getBoundingClientRect();

    // Use the container itself as the root for text node mapping,
    // NOT querySelector("p") which only captures the first paragraph.
    const map = buildTextNodeMap(c);
    if (IS_DEV) {
      console.log("[BehaviorTrackOverlay] text node map:", map.length, "nodes for container", c.tagName, c.className);
    }

    const overlayW = Math.max(c.clientWidth, c.scrollWidth);
    const overlayH = Math.max(c.clientHeight, c.scrollHeight) + 20;

    setContainerDims({ w: overlayW, h: overlayH });

    const allSegments: TrackSegment[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let measuredCount = 0;
    const debugDetails: DebugInfo["detail"] = [];

    for (const act of acts) {
      // Validate start/end
      const isValid = act.start >= 0
        && act.end > act.start
        && act.end <= letterText.length;

      const quoteFromSource = letterText.slice(
        Math.max(0, act.start),
        Math.min(letterText.length, act.end),
      );

      if (!isValid) {
        invalidCount++;
        if (IS_DEV) {
          debugDetails.push({
            id: act.id,
            type: act.type,
            start: act.start,
            end: act.end,
            quoteFromSource,
            startNodeFound: false,
            endNodeFound: false,
            rectCount: 0,
            rects: `INVALID: start=${act.start} end=${act.end} textLen=${letterText.length}`,
          });
        }
        continue;
      }
      validCount++;

      // Create DOM Range
      const range = createSourceRange(map, act.start, act.end);
      const startNodeFound = range !== null;
      const endNodeFound = range !== null;

      if (!range) {
        if (IS_DEV) {
          debugDetails.push({
            id: act.id,
            type: act.type,
            start: act.start,
            end: act.end,
            quoteFromSource,
            startNodeFound,
            endNodeFound,
            rectCount: 0,
            rects: "Range creation FAILED — no matching text nodes",
          });
        }
        continue;
      }

      const rawRects = Array.from(range.getClientRects());
      // Filter zero-dimension rects
      const validRects = rawRects.filter((r) => r.width > 0 && r.height > 0);

      if (validRects.length === 0) {
        if (IS_DEV) {
          const collapsed = range.collapsed;
          debugDetails.push({
            id: act.id,
            type: act.type,
            start: act.start,
            end: act.end,
            quoteFromSource,
            startNodeFound,
            endNodeFound,
            rectCount: 0,
            rects: `Range collapsed=${collapsed}, raw rects=${rawRects.length}, valid rects=0`,
          });
        }
        continue;
      }
      measuredCount++;

      // Merge same-row rects (tolerance-based)
      const mergedRects: Array<{ left: number; right: number; top: number; bottom: number; width: number }> = [];
      for (const rect of validRects) {
        const existing = mergedRects.find(
          (m) => Math.abs(rect.top - m.top) <= LINE_TOLERANCE,
        );
        if (existing) {
          existing.left = Math.min(existing.left, rect.left);
          existing.right = Math.max(existing.right, rect.right);
          existing.top = Math.min(existing.top, rect.top);
          existing.bottom = Math.max(existing.bottom, rect.bottom);
          existing.width = existing.right - existing.left;
        } else {
          mergedRects.push({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.right - rect.left,
          });
        }
      }

      if (IS_DEV) {
        debugDetails.push({
          id: act.id,
          type: act.type,
          start: act.start,
          end: act.end,
          quoteFromSource,
          startNodeFound,
          endNodeFound,
          rectCount: mergedRects.length,
          rects: `${validRects.length} raw rects, ${mergedRects.length} merged rows`,
        });
      }

      // Convert viewport coords to container-local coords
      for (let ri = 0; ri < mergedRects.length; ri++) {
        const rect = mergedRects[ri];
        const x = rect.left - cRect.left + c.scrollLeft;
        const w = rect.width;
        const isFirst = ri === 0;
        const isLast = ri === mergedRects.length - 1;

        // Track y: below the text line
        const baseY = rect.bottom - cRect.top + c.scrollTop + BASE_GAP;

        // Lane assignment: avoid overlapping tracks at same y level
        let lane = 0;
        const existingLanes = allSegments
          .filter((s) => s.behaviorId !== act.id)
          .filter((s) => Math.abs(s.y - baseY) < LANE_GAP * 2)
          .filter((s) => !(x + w <= s.x || s.x + s.width <= x))
          .map((s) => s.lane);
        while (existingLanes.includes(lane) && lane < 3) lane++;

        allSegments.push({
          behaviorId: act.id,
          x, y: baseY + lane * LANE_GAP,
          width: w,
          isFirst, isLast,
          lane,
        });
      }
    }

    if (IS_DEV) {
      debugDetails.push({
        id: "SUMMARY",
        type: "",
        start: 0, end: 0,
        quoteFromSource: "",
        startNodeFound: false, endNodeFound: false,
        rectCount: allSegments.length,
        rects: `total segments across ${measuredCount} measured behaviors`,
      });
    }

    setSegments(allSegments);
    segmentsRef.current = allSegments;

    if (IS_DEV) {
      const di: DebugInfo = {
        showThirdLayer: showAct,
        behaviorCount: acts.length,
        validBehaviorCount: validCount,
        invalidBehaviorCount: invalidCount,
        mappedTextNodeCount: map.length,
        measuredBehaviorCount: measuredCount,
        generatedTrackSegmentCount: allSegments.length,
        overlayWidth: overlayW,
        overlayHeight: overlayH,
        containerClientWidth: c.clientWidth,
        containerClientHeight: c.clientHeight,
        containerScrollWidth: c.scrollWidth,
        containerScrollHeight: c.scrollHeight,
        detail: debugDetails,
      };
      setDebugInfo(di);
      console.table({
        "showThirdLayer": di.showThirdLayer,
        "behaviorCount": di.behaviorCount,
        "validBehaviorCount": di.validBehaviorCount,
        "invalidBehaviorCount": di.invalidBehaviorCount,
        "mappedTextNodeCount": di.mappedTextNodeCount,
        "measuredBehaviorCount": di.measuredBehaviorCount,
        "generatedTrackSegmentCount": di.generatedTrackSegmentCount,
        "overlayWidth": di.overlayWidth,
        "overlayHeight": di.overlayHeight,
        "containerClientWidth": di.containerClientWidth,
        "containerClientHeight": di.containerClientHeight,
        "containerScrollWidth": di.containerScrollWidth,
        "containerScrollHeight": di.containerScrollHeight,
      });
    }
  }, [acts, container, showAct, letterText]);

  // ── Measurement effect ──
  // The measure() callback itself handles the bail-out (sets segments=[] when
  // showAct/container/acts are invalid), so this effect only needs to subscribe
  // to resize/font/scroll events that trigger re-measurement.
  useEffect(() => {
    if (!container) return;

    let frameId: number;

    function scheduleMeasure() {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        measure();
      });
    }

    // Initial measure (deferred via rAF to avoid sync setState in effect)
    scheduleMeasure();

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);

    // Font ready
    document.fonts?.ready.then(scheduleMeasure);

    // Window resize
    window.addEventListener("resize", scheduleMeasure);

    // Delayed measures for initial render stability
    const t1 = setTimeout(scheduleMeasure, 30);
    const t2 = setTimeout(scheduleMeasure, 150);
    const t3 = setTimeout(scheduleMeasure, 600);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [container, measure]);

  // ── Don't hide overlay just because segments is empty (initial state) ──
  // Show debug info even when no segments rendered
  if (!showAct) return null;

  // Group segments by behaviorId
  const grouped = new Map<string, TrackSegment[]>();
  for (const s of segments) {
    if (!grouped.has(s.behaviorId)) grouped.set(s.behaviorId, []);
    grouped.get(s.behaviorId)!.push(s);
  }

  // Use debug styles in dev mode
  const useDebug = IS_DEV;
  const trackColor = useDebug ? DEBUG_TRACK_COLOR : TRACK_COLOR;
  const trackActiveColor = useDebug ? DEBUG_TRACK_COLOR : TRACK_ACTIVE_COLOR;
  const trackWidth = useDebug ? DEBUG_TRACK_WIDTH : TRACK_WIDTH;
  const trackActiveWidth = useDebug ? DEBUG_TRACK_WIDTH : TRACK_ACTIVE_WIDTH;
  const dotRadius = useDebug ? DEBUG_DOT_RADIUS : DOT_RADIUS;
  const diamondSize = useDebug ? DEBUG_DIAMOND_SIZE : DIAMOND_SIZE;

  return (
    <>
      {/* Debug panel (dev only) */}
      {IS_DEV && debugInfo ? (
        <div style={{
          position: "absolute", top: 0, right: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)", color: "#0f0",
          padding: "10px 14px", fontSize: "11px", fontFamily: "monospace",
          maxWidth: "420px", maxHeight: "60vh", overflow: "auto",
          pointerEvents: "auto", borderRadius: "4px",
        }}>
          <div style={{ fontWeight: "bold", marginBottom: 6, color: "#ff0" }}>
            ACT Track Debug {useDebug ? "(DEBUG MODE)" : ""}
          </div>
          <div>acts: {debugInfo.behaviorCount} | valid: {debugInfo.validBehaviorCount} | invalid: {debugInfo.invalidBehaviorCount}</div>
          <div>text nodes mapped: {debugInfo.mappedTextNodeCount}</div>
          <div>behaviors measured: {debugInfo.measuredBehaviorCount}</div>
          <div>track segments: {debugInfo.generatedTrackSegmentCount}</div>
          <div>overlay: {debugInfo.overlayWidth}x{debugInfo.overlayHeight}</div>
          <div>container: {debugInfo.containerClientWidth}x{debugInfo.containerClientHeight} (scroll: {debugInfo.containerScrollWidth}x{debugInfo.containerScrollHeight})</div>
          <div style={{ marginTop: 6, color: "#aaa", fontSize: "10px" }}>
            {debugInfo.detail.filter(d => d.id !== "SUMMARY").map(d => (
              <div key={d.id} style={{
                borderTop: "1px solid #333", paddingTop: 4, marginTop: 4,
                color: d.rectCount === 0 ? "#f66" : "#6f6",
              }}>
                [{d.type}] {d.id}: &ldquo;{d.quoteFromSource.slice(0, 30)}&rdquo;
                <br />start={d.start} end={d.end} | rects={d.rectCount} | {d.rects}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* SVG overlay — show even with 0 segments in dev to allow inspection */}
      {segments.length > 0 && containerDims.w > 0 ? (
        <svg
          ref={svgRef}
          className={`behavior-track-overlay${useDebug ? " is-debug" : ""}`}
          width={containerDims.w}
          height={containerDims.h}
          viewBox={`0 0 ${containerDims.w} ${containerDims.h}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            overflow: "visible",
            zIndex: 6,
          }}
        >
          {Array.from(grouped.entries()).map(([behaviorId, segs]) => {
            const isActive = activeBehaviorId === behaviorId;
            const color = isActive ? trackActiveColor : trackColor;
            const strokeW = isActive ? trackActiveWidth : trackWidth;

            return (
              <g key={behaviorId} data-behavior-id={behaviorId} className={`behavior-track${isActive ? " is-active" : ""}`}>
                {/* Hit area (invisible, wider for easier interaction) */}
                {segs.map((seg, i) => (
                  <line
                    key={`hit-${i}`}
                    x1={seg.x} y1={seg.y}
                    x2={seg.x + seg.width} y2={seg.y}
                    stroke="transparent"
                    strokeWidth={HIT_HEIGHT}
                    style={{ pointerEvents: "stroke", cursor: "help" }}
                    onMouseEnter={() => onHover(behaviorId)}
                    onMouseLeave={() => onHover(null)}
                    onClick={(e) => { e.stopPropagation(); onSelect(behaviorId); }}
                  />
                ))}

                {/* Visible track line */}
                {segs.map((seg, i) => (
                  <line
                    key={`ln-${i}`}
                    x1={seg.x} y1={seg.y}
                    x2={seg.x + seg.width} y2={seg.y}
                    stroke={color}
                    strokeWidth={strokeW}
                    vectorEffect="non-scaling-stroke"
                    shapeRendering="geometricPrecision"
                  />
                ))}

                {/* Start dot (first segment) */}
                {segs.find((s) => s.isFirst) ? (
                  (() => {
                    const first = segs.find((s) => s.isFirst)!;
                    return (
                      <circle
                        cx={first.x}
                        cy={first.y}
                        r={dotRadius}
                        fill="var(--paper, #f8f6f0)"
                        stroke={color}
                        strokeWidth={strokeW}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })()
                ) : null}

                {/* End diamond (last segment) */}
                {segs.find((s) => s.isLast) ? (
                  (() => {
                    const last = segs.find((s) => s.isLast)!;
                    const cx = last.x + last.width;
                    const cy = last.y;
                    const hs = diamondSize / 2;
                    return (
                      <rect
                        x={cx - hs}
                        y={cy - hs}
                        width={diamondSize}
                        height={diamondSize}
                        transform={`rotate(45 ${cx} ${cy})`}
                        fill="var(--paper, #f8f6f0)"
                        stroke={color}
                        strokeWidth={strokeW}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })()
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : IS_DEV ? (
        <div style={{
          position: "absolute", top: 0, left: 0, zIndex: 9998,
          background: "rgba(255,0,0,0.15)", border: "2px dashed red",
          width: containerDims.w || "100%", height: containerDims.h || "100%",
          pointerEvents: "none", display: "flex", alignItems: "center",
          justifyContent: "center", color: "red", fontSize: "13px",
          fontFamily: "monospace",
        }}>
          SVG NOT RENDERED — segments:{segments.length} dims:{containerDims.w}x{containerDims.h}
        </div>
      ) : null}
    </>
  );
}
