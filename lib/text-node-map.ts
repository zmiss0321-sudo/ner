/**
 * Builds a mapping from source text offsets to DOM Text nodes.
 * Used by BehaviorTrackOverlay to create accurate DOM Ranges for getClientRects().
 *
 * IMPORTANT: The walker traverses ALL Text nodes within the root element,
 * not just those inside the first <p>. Wrapper elements (Links, spans for
 * entity/event/behavior layers) are transparent to the walk — only their
 * inner Text nodes contribute to the offset mapping.
 */

export interface TextNodeEntry {
  node: Text;
  sourceStart: number;  // inclusive
  sourceEnd: number;    // exclusive
}

/**
 * Walk the DOM subtree, collecting all Text nodes that contribute to the
 * source text, along with their source offset ranges.
 *
 * Source offset counter increments by each text node's actual character length.
 */
export function buildTextNodeMap(root: HTMLElement): TextNodeEntry[] {
  const map: TextNodeEntry[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Skip sr-only accessibility text
      if (parent.classList.contains("sr-only")) return NodeFilter.FILTER_REJECT;
      // Skip script/style
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
      // Skip non-source-text elements that appear in the container:
      // event type labels, translation paragraphs, floating labels, popovers
      let el: HTMLElement | null = parent;
      while (el) {
        if (
          el.classList.contains("pair-event") ||
          el.classList.contains("translation-paragraph") ||
          el.classList.contains("behavior-float-label") ||
          el.classList.contains("behavior-popover")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        // Also skip elements marked with data-no-source
        if (el.dataset.noSource === "true") return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let cursor = 0;
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? "";
    const len = text.length;
    if (len === 0) continue;
    map.push({ node, sourceStart: cursor, sourceEnd: cursor + len });
    cursor += len;
  }

  return map;
}

/**
 * Find the Text node and its internal offset for a given source position.
 *
 * For positions that fall exactly at a boundary between two text nodes
 * (offset == entry.sourceEnd), we prefer the NEXT text node with offset 0.
 * This ensures Range.setStart/setEnd land at the correct side of the boundary.
 *
 * For the very end of the text (offset == last entry's sourceEnd), we clamp
 * to the last text node's end.
 */
export function findTextNode(
  map: TextNodeEntry[],
  sourcePos: number,
): { node: Text; offset: number } | null {
  if (map.length === 0) return null;

  // Clamp to valid range
  if (sourcePos < 0) {
    return { node: map[0].node, offset: 0 };
  }

  const lastEntry = map[map.length - 1];
  if (sourcePos >= lastEntry.sourceEnd) {
    return {
      node: lastEntry.node,
      offset: lastEntry.sourceEnd - lastEntry.sourceStart,
    };
  }

  // For positions that fall at an entry boundary (sourcePos == entry.sourceEnd),
  // prefer the NEXT entry with offset 0 to ensure we're at the right side.
  for (let i = 0; i < map.length; i++) {
    const entry = map[i];
    if (sourcePos >= entry.sourceStart && sourcePos < entry.sourceEnd) {
      // Position is strictly inside this text node
      return { node: entry.node, offset: sourcePos - entry.sourceStart };
    }
    if (sourcePos === entry.sourceStart) {
      // Position is at the start of this entry
      return { node: entry.node, offset: 0 };
    }
    // sourcePos == entry.sourceEnd: continue to next entry (or handle below)
  }

  // Fallback: find the entry where sourcePos <= sourceEnd
  for (const entry of map) {
    if (sourcePos <= entry.sourceEnd) {
      return {
        node: entry.node,
        offset: Math.min(sourcePos - entry.sourceStart, entry.sourceEnd - entry.sourceStart),
      };
    }
  }

  // Last resort: clamp to last node
  return {
    node: lastEntry.node,
    offset: lastEntry.sourceEnd - lastEntry.sourceStart,
  };
}

/**
 * Create a DOM Range covering source offsets [start, end) (exclusive end).
 *
 * The Range is created using the mapped Text nodes — if the node structure
 * has changed since the map was built, this may fail gracefully.
 */
export function createSourceRange(
  map: TextNodeEntry[],
  start: number,
  end: number,
): Range | null {
  if (map.length === 0) return null;

  const startInfo = findTextNode(map, start);
  if (!startInfo) return null;

  // For end, we use end - 1 to find the inclusive position for the end boundary,
  // then add 1 to the offset. But findTextNode handles this naturally:
  // - If end lands at a boundary (sourceEnd of a node), findTextNode returns
  //   the next node with offset 0, which is correct for exclusive end.
  // - If end == sourceEnd of the last node, findTextNode clamps to the last
  //   node's end offset, which is also correct.
  const endInfo = end > start ? findTextNode(map, end) : startInfo;
  if (!endInfo) return null;

  try {
    const range = document.createRange();
    const maxStartOffset = (startInfo.node.textContent ?? "").length;
    range.setStart(startInfo.node, Math.min(startInfo.offset, maxStartOffset));

    const maxEndOffset = (endInfo.node.textContent ?? "").length;
    range.setEnd(endInfo.node, Math.min(endInfo.offset, maxEndOffset));
    return range;
  } catch {
    return null;
  }
}
