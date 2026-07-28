"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { actTypeMeta, eventTypeMeta } from "@/lib/config";
import { formatLetterDate, getLetter, normalizeActAnnotation, searchScopeLabels, splitLetterIntoTranslationPairs } from "@/lib/data-adapter";
import type { ActMention, Letter, SearchScope } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";
import { HighlightedText } from "./HighlightedText";

interface BehaviorBlock {
  start: number;
  end: number;
  text: string;
  act: ActMention | null;
}

/** Get a concise description for a behavior act. */
function getBehaviorDescription(act: ActMention): string {
  const text = (act.originalText ?? "").replace(/\s+/g, " ").trim();
  return text || act.type;
}

/**
 * Split letter text into behavior blocks at ACT boundaries.
 * Adjacent acts of the same type are merged into a single block to avoid
 * excessive fragmentation.
 */
function splitIntoBehaviorBlocks(text: string, acts: ActMention[]): BehaviorBlock[] {
  const sorted = [...acts].sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];

  // Phase 1: merge adjacent same-type acts
  const merged: ActMention[] = [];
  for (const act of sorted) {
    if (act.start >= act.end) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.type === act.type && act.start <= prev.end) {
      // Merge into previous: extend end, join text
      const extended: ActMention = {
        ...prev,
        end: Math.max(prev.end, act.end),
        originalText: (prev.originalText + act.originalText).replace(/\s+/g, " ").trim(),
      };
      merged[merged.length - 1] = extended;
    } else {
      merged.push({ ...act });
    }
  }

  // Phase 2: build blocks with plain-text gaps
  const blocks: BehaviorBlock[] = [];
  let cursor = 0;

  for (const act of merged) {
    if (act.start < cursor) continue;

    if (act.start > cursor) {
      const plain = text.slice(cursor, act.start);
      if (plain.trim()) {
        blocks.push({ start: cursor, end: act.start, text: plain, act: null });
      }
    }

    blocks.push({
      start: act.start,
      end: act.end,
      text: text.slice(act.start, act.end),
      act,
    });
    cursor = act.end;
  }

  if (cursor < text.length) {
    const tail = text.slice(cursor);
    if (tail.trim()) {
      blocks.push({ start: cursor, end: text.length, text: tail, act: null });
    }
  }

  return blocks;
}

export function LetterDetailPage({ id, query = "", scope = "fulltext", matchStart }: { id: string; query?: string; scope?: SearchScope; matchStart?: number }) {
  const letter = getLetter(id);
  const [showTranslation, setShowTranslation] = useState(true);
  const [layers, setLayers] = useState({ entity: true, event: true, act: false });
  // Show behavior blocks only when act layer is enabled
  const showAct = layers.act;

  const fallbackMatch = letter && query ? letter.text.toLocaleLowerCase("zh-CN").indexOf(query.toLocaleLowerCase("zh-CN")) : -1;
  const textMatchStart = scope === "fulltext" ? (typeof matchStart === "number" && matchStart >= 0 ? matchStart : fallbackMatch) : -1;
  const searchMatch = textMatchStart >= 0 ? { start: textMatchStart, length: query.length } : null;

  useEffect(() => {
    if (!query) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById("search-match")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    return () => cancelAnimationFrame(frame);
  }, [id, query, scope, textMatchStart]);

  if (!letter) return <main className="site-container page-state">未找到书信 {id}。</main>;

  const pairs = splitLetterIntoTranslationPairs(letter);
  const allActs: ActMention[] = normalizeActAnnotation(letter.id).sort((a, b) => a.start - b.start);
  const behaviorBlocks = showAct ? splitIntoBehaviorBlocks(letter.text, allActs) : [];

  return (
    <main className="letter-detail-page site-container">
      <Link className="back-link" href="/letters">← 返回书信检索</Link>
      <header className="letter-detail-heading"><span>LETTER {letter.number}</span><h1>致{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} markId="search-match" /> : letter.recipient}</h1><time>{formatLetterDate(letter)}</time></header>
      {query ? <p className="detail-match-note">由&ldquo;{searchScopeLabels[scope]}&rdquo;检索进入，已定位并标出&ldquo;{query}&rdquo;。</p> : null}
      <div className="detail-controls">
        <button type="button" className={showTranslation ? "selected" : ""} aria-pressed={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>显示白话文翻译 {showTranslation ? "✓" : ""}</button>
        {(["entity", "event"] as const).map((layer) => <button type="button" key={layer} className={layers[layer] ? "selected" : ""} aria-pressed={layers[layer]} onClick={() => setLayers((c) => ({ ...c, [layer]: !c[layer] }))}>{layer === "entity" ? "第一层标注" : "第二层标注"} {layers[layer] ? "✓" : ""}</button>)}
        <button type="button" className={showAct ? "selected" : ""} aria-pressed={showAct} onClick={() => setLayers((c) => ({ ...c, act: !c.act }))}>第三层行为 {showAct ? "✓" : ""}</button>
      </div>

      {/* ── Behavior block mode (act layer ON) ── */}
      {showAct ? (
        <article className="behavior-block-view">
          {behaviorBlocks.map((block, i) => (
            <div key={i} className={`behavior-block${block.act ? " has-act" : ""}`}>
              {/* Original text with layers 1 & 2 */}
              <div className="behavior-text">
                <AnnotatedLetterText
                  letter={letter as Letter}
                  showEntity={layers.entity}
                  showEvent={layers.event}
                  rangeStart={block.start}
                  rangeEnd={block.end}
                  searchMatch={searchMatch}
                />
              </div>

              {/* Behavior annotation below (single line: 类型：说明) */}
              {block.act ? (
                <div className="behavior-annotation">
                  <span className="behavior-type">{actTypeMeta[block.act.type]?.label ?? block.act.type}：</span>
                  <span className="behavior-description">{getBehaviorDescription(block.act)}</span>
                </div>
              ) : null}
            </div>
          ))}
        </article>
      ) : showTranslation ? (
        /* ── Parallel translation mode (act OFF) ── */
        <article className="parallel-reading">
          {pairs.map((pair, index) => (
            <section className="paragraph-pair" key={`${pair.event?.id ?? "plain"}-${index}`}>
              {pair.event ? <span className="pair-event">{eventTypeMeta[pair.event.type].label} · {pair.event.type}</span> : null}
              <div className="pair-annotated-original"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} rangeStart={pair.start} rangeEnd={pair.end} searchMatch={searchMatch} /></div>
              {pair.translation ? <div className="translation-paragraph"><span>白话</span><p>{pair.translation}</p></div> : <div className="translation-paragraph missing"><span>白话</span><p>暂无对应译文字段</p></div>}
            </section>
          ))}
        </article>
      ) : (
        /* ── Original-only mode (act OFF) ── */
        <article className="detail-original-only"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} searchMatch={searchMatch} /></article>
      )}

      <footer className="letter-record"><div><span>收信人</span><p>{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} /> : letter.recipient}</p></div><div><span>时间</span><p>{formatLetterDate(letter)}</p></div><div><span>来源</span><p>{scope === "source" && query ? <HighlightedText text={letter.source ?? "暂无来源字段"} query={query} markId="search-match" /> : letter.source ?? "暂无来源字段"}</p></div></footer>
    </main>
  );
}
