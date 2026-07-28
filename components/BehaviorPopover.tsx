"use client";

import { actTypeMeta } from "@/lib/config";
import type { ActMention } from "@/lib/types";

interface Props {
  act: ActMention;
}

/**
 * Detail content for the selected behavior. Positioning is owned by the single
 * shared BehaviorCallout so this panel can never drift away from its range.
 */
export function BehaviorPopover({ act }: Props) {
  const typeLabel = actTypeMeta[act.type]?.label ?? act.type;
  const quote = act.originalText.replace(/\s+/g, "");

  const desc = actTypeMeta[act.type]?.definition
    ?? (act.originalText.length > 60 ? `${act.originalText.slice(0, 58)}…` : act.originalText);

  return (
    <div
      id={`behavior-popover-${act.id}`}
      className="behavior-popover"
      role="region"
      aria-label={`行为标注：${typeLabel}`}
    >
      <span className="behavior-popover-type">{typeLabel}</span>
      <blockquote className="behavior-popover-quote">{quote}</blockquote>
      {desc ? <span className="behavior-popover-desc">{desc}</span> : null}
    </div>
  );
}
