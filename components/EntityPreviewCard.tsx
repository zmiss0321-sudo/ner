"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { annotationStyles, entityTypeMeta } from "@/lib/config";
import { getEntityHref } from "@/lib/data-adapter";
import type { EntityMention } from "@/lib/types";

interface Props {
  anchor: HTMLElement;
  entity: EntityMention;
  isFinePointer: boolean;
  previewId: string;
  onClose: () => void;
  onNavigate: () => void;
}

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;
const HEADER_CLEARANCE = 92;

export function EntityPreviewCard({ anchor, entity, isFinePointer, previewId, onClose, onNavigate }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  const meta = entityTypeMeta[entity.type];

  const positionCard = useCallback(() => {
    const card = cardRef.current;
    if (!card || !anchor.isConnected) return;

    const anchorRect = anchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const mainRect = anchor.closest(".annotation-main")?.getBoundingClientRect();
    const minLeft = Math.max(VIEWPORT_MARGIN, mainRect?.left ?? VIEWPORT_MARGIN);
    const maxLeft = Math.max(minLeft, window.innerWidth - cardRect.width - VIEWPORT_MARGIN);
    const centeredLeft = anchorRect.left + anchorRect.width / 2 - cardRect.width / 2;
    const left = Math.min(Math.max(centeredLeft, minLeft), maxLeft);
    const fitsAbove = anchorRect.top - ANCHOR_GAP - cardRect.height >= HEADER_CLEARANCE;
    const preferredTop = fitsAbove
      ? anchorRect.top - cardRect.height - ANCHOR_GAP
      : anchorRect.bottom + ANCHOR_GAP;
    const top = Math.min(
      Math.max(preferredTop, HEADER_CLEARANCE),
      Math.max(HEADER_CLEARANCE, window.innerHeight - cardRect.height - VIEWPORT_MARGIN),
    );

    setStyle({ left, top, opacity: 1, "--entity-preview-color": annotationStyles.entity[entity.type].color } as CSSProperties);
  }, [anchor, entity.type]);

  useLayoutEffect(() => positionCard(), [positionCard, entity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!cardRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onScroll = () => onClose();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", positionCard);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", positionCard);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [anchor, onClose, positionCard]);

  return createPortal(
    <div
      className="entity-preview-card"
      id={previewId}
      ref={cardRef}
      role={isFinePointer ? "tooltip" : "dialog"}
      aria-label={`${meta.label}实体：${entity.canonical}`}
      style={style}
    >
      <div className="entity-preview-type"><span>{meta.label}</span><i aria-hidden="true">·</i><b>{entity.type}</b></div>
      <p className="entity-preview-name">
        {entity.surface !== entity.canonical ? <><span>{entity.surface}</span><i aria-hidden="true">→</i><strong>{entity.canonical}</strong></> : <strong>{entity.canonical}</strong>}
      </p>
      {entity.subtype ? <small className="entity-preview-code">{entity.subtype}</small> : null}
      {!isFinePointer ? <Link className="entity-preview-action" href={getEntityHref(entity)} onClick={onNavigate}>进入实体条目 <span aria-hidden="true">→</span></Link> : null}
    </div>,
    document.body,
  );
}
