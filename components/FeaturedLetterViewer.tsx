"use client";

import Link from "next/link";
import { useState } from "react";
import { actTypeMeta } from "@/lib/config";
import { formatLetterDate, getFeaturedLetters, normalizeActAnnotation } from "@/lib/data-adapter";
import type { ActMention } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";

// ── Behavior block types ──

interface BehaviorBlock {
  start: number;
  end: number;
  text: string;
  act: ActMention | null;
}

function getDescription(act: ActMention): string {
  const text = (act.originalText ?? "").replace(/\s+/g, " ").trim();
  return text || act.type;
}

/**
 * Split text into behavior blocks, merging adjacent same-type acts
 * so that semantic units stay together instead of fragmenting.
 */
function buildBehaviorBlocks(text: string, acts: ActMention[]): BehaviorBlock[] {
  const sorted = [...acts].sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];

  // Phase 1: merge adjacent same-type acts
  const merged: ActMention[] = [];
  for (const act of sorted) {
    if (act.start >= act.end) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.type === act.type && act.start <= prev.end) {
      merged[merged.length - 1] = {
        ...prev,
        end: Math.max(prev.end, act.end),
        originalText: (prev.originalText + act.originalText).replace(/\s+/g, " ").trim(),
      };
    } else {
      merged.push({ ...act });
    }
  }

  // Phase 2: build blocks
  const blocks: BehaviorBlock[] = [];
  let cursor = 0;
  for (const act of merged) {
    if (act.start < cursor) continue;
    if (act.start > cursor) {
      const plain = text.slice(cursor, act.start);
      if (plain.trim()) blocks.push({ start: cursor, end: act.start, text: plain, act: null });
    }
    blocks.push({ start: act.start, end: act.end, text: text.slice(act.start, act.end), act });
    cursor = act.end;
  }
  if (cursor < text.length) {
    const tail = text.slice(cursor);
    if (tail.trim()) blocks.push({ start: cursor, end: text.length, text: tail, act: null });
  }
  return blocks;
}

// ── Component ──

export function FeaturedLetterViewer() {
  const letters = getFeaturedLetters();
  const [index, setIndex] = useState(0);
  // Three independent layer states — Layer 3 defaults OFF
  const [showLayer1, setShowLayer1] = useState(true);
  const [showLayer2, setShowLayer2] = useState(true);
  const [showLayer3, setShowLayer3] = useState(false);
  const letter = letters[index];

  if (!letter) return <p>暂无优秀示例配置。</p>;

  const allActs: ActMention[] = showLayer3
    ? normalizeActAnnotation(letter.id).sort((a, b) => a.start - b.start)
    : [];
  const blocks = showLayer3 ? buildBehaviorBlocks(letter.text, allActs) : [];
  const hasActData = allActs.length > 0;

  function hideAll() {
    setShowLayer1(false);
    setShowLayer2(false);
    setShowLayer3(false);
  }

  return (
    <section className="featured-viewer" aria-labelledby="featured-title">
      <div className="viewer-heading">
        <div><span>FEATURED ANNOTATION</span><h1 id="featured-title">优秀标注示例</h1></div>
        <div className="letter-switcher" aria-label="切换优秀示例">
          <button type="button" onClick={() => setIndex((index - 1 + letters.length) % letters.length)} aria-label="上一封">←</button>
          <b>{String(index + 1).padStart(2, "0")} <i>/</i> {String(letters.length).padStart(2, "0")}</b>
          <button type="button" onClick={() => setIndex((index + 1) % letters.length)} aria-label="下一封">→</button>
        </div>
      </div>

      <div className="annotation-controls" aria-label="标注显示控制">
        <span>标注显示</span>
        <button type="button" aria-pressed={showLayer1} className={showLayer1 ? "selected" : ""} onClick={() => setShowLayer1((v) => !v)}>
          <i className="control-dot entity-dot" /> 第一层标注 {showLayer1 ? "✓" : ""}
        </button>
        <button type="button" aria-pressed={showLayer2} className={showLayer2 ? "selected" : ""} onClick={() => setShowLayer2((v) => !v)}>
          <i className="control-dot event-dot" /> 第二层标注 {showLayer2 ? "✓" : ""}
        </button>
        <button type="button" aria-pressed={showLayer3} className={showLayer3 ? "selected" : ""} onClick={() => setShowLayer3((v) => !v)}>
          <i className="control-dot act-dot" /> 第三层行为 {showLayer3 ? "✓" : ""}
        </button>
        <button className="hide-all" type="button" onClick={hideAll}>隐藏全部</button>
      </div>

      <article className="letter-reading">
        <header className="letter-heading">
          <span className="letter-id">书信 {letter.number}</span>
          <h2>致{letter.recipient}</h2>
          <time>{formatLetterDate(letter)}</time>
        </header>

        {/* ── Behavior block view (layer 3 ON) ── */}
        {showLayer3 ? (
          hasActData ? (
            <div className="behavior-block-view">
              {blocks.map((block, i) => (
                <div key={i} className={`behavior-block${block.act ? " has-act" : ""}`}>
                  <div className="behavior-text">
                    <AnnotatedLetterText
                      letter={letter}
                      showEntity={showLayer1}
                      showEvent={showLayer2}
                      rangeStart={block.start}
                      rangeEnd={block.end}
                    />
                  </div>
                  {block.act ? (
                    <div className="behavior-annotation">
                      <span className="behavior-type">{actTypeMeta[block.act.type]?.label ?? block.act.type}：</span>
                      <span className="behavior-description">{getDescription(block.act)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <>
              <AnnotatedLetterText letter={letter} showEntity={showLayer1} showEvent={showLayer2} />
              <p className="behavior-empty-hint">该书信暂未添加行为标注</p>
            </>
          )
        ) : (
          /* ── Continuous text (layer 3 OFF) ── */
          <AnnotatedLetterText letter={letter} showEntity={showLayer1} showEvent={showLayer2} />
        )}

        <footer className="source-citation">
          <span>来源</span><p>{letter.source ?? "暂无来源字段"}</p>
          <Link className="letter-detail-link" href={`/letter/${encodeURIComponent(letter.id)}`}>查看完整书信信息 <i aria-hidden="true">→</i></Link>
        </footer>
      </article>
    </section>
  );
}
