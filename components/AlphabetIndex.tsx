import { ALPHABET } from "@/lib/pinyin";

export type LetterCounts = Record<string, number>;

type AlphabetIndexProps = {
  /** 每个字母对应的实体数量（已考虑其他筛选条件） */
  counts: LetterCounts;
  /** 当前选中的字母，null = 全部 */
  selected: string | null;
  /** 选中字母回调，null = 全部 */
  onSelect: (letter: string | null) => void;
  /** 实体总数 */
  totalCount: number;
};

/**
 * A—Z 拼音首字母索引 — 所有专题共用。
 * 显示每个字母的实体数量，空字母灰化不可点击。
 */
export function AlphabetIndex({ counts, selected, onSelect, totalCount }: AlphabetIndexProps) {
  return (
    <nav className="alphabet-index" aria-label="拼音首字母索引">
      <button
        type="button"
        className={`alpha-btn alpha-all${selected === null ? " alpha-selected" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span className="alpha-letter">全部</span>
        <span className="alpha-count">{totalCount}</span>
      </button>
      {ALPHABET.map((letter) => {
        const count = counts[letter] ?? 0;
        const hasEntries = count > 0;
        const isSelected = selected === letter;
        return (
          <button
            key={letter}
            type="button"
            className={`alpha-btn${isSelected ? " alpha-selected" : ""}${!hasEntries ? " alpha-disabled" : ""}`}
            disabled={!hasEntries}
            onClick={() => hasEntries && onSelect(letter)}
            aria-label={`字母 ${letter}，${count} 个实体`}
          >
            <span className="alpha-letter">{letter}</span>
            <span className="alpha-count">{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
