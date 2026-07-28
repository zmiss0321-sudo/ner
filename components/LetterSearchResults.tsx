"use client";

import Link from "next/link";
import { formatLetterDate, getSearchResultHref, searchLetters, searchScopeLabels } from "@/lib/data-adapter";
import type { SearchScope } from "@/lib/types";
import { HighlightedText } from "./HighlightedText";

export function LetterSearchResults({ query, scope, onClear }: { query: string; scope: SearchScope; onClear: () => void }) {
  const results = searchLetters(query, scope);
  return (
    <section className="search-results" aria-live="polite">
      <div className="results-title">
        <div><span>LETTER SEARCH · {searchScopeLabels[scope]}</span><h1>书信检索结果</h1><p>“{query}” · 共显示 {results.length} 封</p></div>
        <button type="button" onClick={onClear}>返回优秀示例</button>
      </div>
      {results.length ? (
        <div className="result-list">
          {results.map((result) => {
            const { letter, snippet, snippetMatchStart } = result;
            return (
            <article className="result-item" key={letter.id}>
              <span className="result-number">{letter.number}</span>
              <div>
                <p><b>致{scope === "recipient" ? <HighlightedText text={letter.recipient} query={query} /> : letter.recipient}</b><time>{formatLetterDate(letter)}</time></p>
                <blockquote>
                  {scope === "fulltext" ? <HighlightedText text={snippet} query={query} matchStart={snippetMatchStart} /> : scope === "source" ? <>来源：<HighlightedText text={letter.source ?? "暂无来源字段"} query={query} /></> : <>收信人：<HighlightedText text={letter.recipient} query={query} /></>}
                </blockquote>
                <Link href={getSearchResultHref(result, query)}>定位到命中位置 →</Link>
              </div>
            </article>
          );})}
        </div>
      ) : (
        <div className="empty-state"><span>〇</span><h2>未找到对应书信</h2><p>可尝试输入收信人、年份、干支、原文词句或三位书信编号。</p></div>
      )}
    </section>
  );
}
