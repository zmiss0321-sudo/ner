"use client";

import Link from "next/link";
import { Fragment, MouseEvent, ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { getEntityHref, getEntityKey, normalizeEntityAnnotation, normalizeEventAnnotation } from "@/lib/data-adapter";
import { entityStyleVariables, entityTypeMeta, eventStyleVariables, eventTypeMeta } from "@/lib/config";
import type { EntityMention, Letter } from "@/lib/types";
import { EntityPreviewCard } from "./EntityPreviewCard";

interface Props {
  letter: Letter;
  showEntity: boolean;
  showEvent: boolean;
  rangeStart?: number;
  rangeEnd?: number;
  searchMatch?: { start: number; length: number } | null;
}

interface TextFragment {
  start: number; end: number; text: string;
  entityMention: EntityMention | null;
  eventId: string | null;
}

export const AnnotatedLetterText = forwardRef<HTMLDivElement, Props>(function AnnotatedLetterText({
  letter, showEntity, showEvent,
  rangeStart = 0, rangeEnd = letter.text.length,
  searchMatch = null,
}: Props, ref) {
  const [finePointer, setFinePointer] = useState(false);
  const [preview, setPreview] = useState<{ entity: EntityMention; anchor: HTMLElement; id: string } | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => innerRef.current!);

  const entities = showEntity ? normalizeEntityAnnotation(letter.id).filter((i) => i.start >= rangeStart && i.end <= rangeEnd) : [];
  const events = showEvent ? normalizeEventAnnotation(letter.id).filter((i) => i.start >= rangeStart && i.end <= rangeEnd) : [];

  const clearTimers = useCallback(() => { if (openTimer.current) clearTimeout(openTimer.current); if (closeTimer.current) clearTimeout(closeTimer.current); openTimer.current = null; closeTimer.current = null; }, []);
  const closePreview = useCallback(() => { clearTimers(); setPreview(null); }, [clearTimers]);
  const openPreview = useCallback((entity: EntityMention, anchor: HTMLElement, delay = 0) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    const id = `entity-preview-${letter.id}-${entity.start}`.replace(/[^\w-]/g, "-");
    openTimer.current = setTimeout(() => setPreview({ entity, anchor, id }), delay);
  }, [letter.id]);
  const scheduleClose = useCallback(() => { if (openTimer.current) clearTimeout(openTimer.current); if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setPreview(null), 160); }, []);

  useEffect(() => {
    const m = window.matchMedia("(hover: hover) and (pointer: fine)");
    const u = () => setFinePointer(m.matches); u();
    m.addEventListener("change", u); return () => m.removeEventListener("change", u);
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);
  useEffect(() => {
    try {
      const s = window.sessionStorage.getItem("ye-entity-return-position"); if (!s) return;
      const p = JSON.parse(s) as { letterId?: string; scrollY?: number };
      if (p.letterId !== letter.id) return;
      window.sessionStorage.removeItem("ye-entity-return-position");
      requestAnimationFrame(() => window.scrollTo({ top: p.scrollY ?? 0 }));
    } catch { /* ok */ }
  }, [letter.id]);

  function rememberReturnPosition() {
    try { window.sessionStorage.setItem("ye-entity-return-position", JSON.stringify({ letterId: letter.id, scrollY: window.scrollY })); } catch { /* ok */ }
  }

  function handleEntityClick(event: MouseEvent<HTMLAnchorElement>, mention: EntityMention) {
    const a = event.currentTarget;
    const sh = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!sh && event.detail !== 0 && preview?.anchor !== a) { event.preventDefault(); event.stopPropagation(); openPreview(mention, a); return; }
    rememberReturnPosition();
  }

  function renderTextSlice(from: number, to: number): ReactNode[] {
    if (from >= to) return [];
    if (!searchMatch || searchMatch.start < 0 || searchMatch.length <= 0) return [letter.text.slice(from, to)];
    const me = searchMatch.start + searchMatch.length;
    if (me <= from || searchMatch.start >= to) return [letter.text.slice(from, to)];
    const vs = Math.max(from, searchMatch.start), ve = Math.min(to, me);
    const n: ReactNode[] = [];
    if (vs > from) n.push(letter.text.slice(from, vs));
    n.push(<mark id={vs === searchMatch.start ? "search-match" : undefined} className="search-match" key={`mk-${vs}`}>{letter.text.slice(vs, ve)}</mark>);
    if (ve < to) n.push(letter.text.slice(ve, to));
    return n;
  }

  function computeFragments(): TextFragment[] {
    const b = new Set<number>(); b.add(rangeStart); b.add(rangeEnd);
    for (const e of entities) { b.add(e.start); b.add(e.end); }
    for (const ev of events) { b.add(ev.start); b.add(ev.end); }
    const sorted = [...b].filter((n) => n >= rangeStart && n <= rangeEnd).sort((a, b) => a - b);
    const frags: TextFragment[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i], e = sorted[i + 1]; if (s >= e) continue;
      frags.push({ start: s, end: e, text: letter.text.slice(s, e),
        entityMention: entities.find((en) => en.start <= s && en.end >= e) ?? null,
        eventId: events.find((ev) => ev.start <= s && ev.end >= e)?.id ?? null,
      });
    }
    return frags;
  }

  function renderFragments(): ReactNode[] {
    const frags = computeFragments();
    const nodes: ReactNode[] = [];
    for (const frag of frags) {
      let content: ReactNode = renderTextSlice(frag.start, frag.end);

      // Layer 1: entity
      if (frag.entityMention) {
        const m = frag.entityMention;
        const aid = `entity-${letter.id}-${m.start}`.replace(/[^\w-]/g, "-");
        content = (
          <Link className={`entity-annotation entity-${m.type.toLowerCase()}`} style={entityStyleVariables(m.type)}
            key={`${m.type}-${m.start}`} id={aid} href={getEntityHref(m)} data-entity-id={getEntityKey(m)}
            aria-label={`查看${entityTypeMeta[m.type].label}实体：${m.canonical}`}
            aria-describedby={preview?.anchor.id === aid ? preview.id : undefined}
            onMouseEnter={(ev) => finePointer && openPreview(m, ev.currentTarget, 125)}
            onMouseLeave={finePointer ? scheduleClose : undefined}
            onFocus={(ev) => finePointer && openPreview(m, ev.currentTarget)} onBlur={finePointer ? scheduleClose : undefined}
            onClick={(ev) => handleEntityClick(ev, m)}>
            {content}<span className="sr-only">，规范实体{m.canonical}</span>
          </Link>
        );
      }

      // Layer 2: event highlighter
      if (frag.eventId) {
        const ev = events.find((e) => e.id === frag.eventId)!;
        content = (
          <span className={`event-range event-${ev.type.toLowerCase()}`} style={eventStyleVariables(ev.type)}
            key={ev.id} tabIndex={0}
            data-event={`${eventTypeMeta[ev.type].label} · ${ev.type}`}
            aria-label={`${eventTypeMeta[ev.type].label}事件范围`}>
            {content}
          </span>
        );
      }

      nodes.push(content);
    }
    return nodes;
  }

  return (
    <div className="annotated-text" ref={innerRef}>
      <p>{renderFragments().map((n, i) => <Fragment key={i}>{n}</Fragment>)}</p>
      {preview ? <EntityPreviewCard anchor={preview.anchor} entity={preview.entity} isFinePointer={finePointer} previewId={preview.id} onClose={closePreview} onNavigate={rememberReturnPosition} /> : null}
    </div>
  );
});
