"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { entityTypeMeta } from "@/lib/config";
import { formatLetterDate, getAllLetters, getLetterEntitySummary, getLetterExcerpt, getSearchResultHref, searchLetters, searchScopeLabels } from "@/lib/data-adapter";
import type { SearchScope } from "@/lib/types";
import { HighlightedText } from "./HighlightedText";
import { LetterSearchBar } from "./LetterSearchBar";

export function LettersPage() {
  const [search, setSearch] = useState<{ query: string; scope: SearchScope }>({ query: "", scope: "fulltext" });
  const results = useMemo(() => search.query ? searchLetters(search.query, search.scope, 306) : [], [search]);
  const letters = useMemo(() => search.query ? results.map((result) => result.letter) : getAllLetters(), [results, search.query]);
  const resultMap = useMemo(() => new Map(results.map((result) => [result.letter.id, result])), [results]);

  return (
    <main className="letters-page">
      <div className="search-band"><div className="site-container"><LetterSearchBar initialValue={search.query} initialScope={search.scope} onSearch={(query, scope) => setSearch({ query, scope })} /></div></div>
      <div className="site-container letters-content">
        <header className="page-heading">
          <div><span>ALL CORRESPONDENCE</span><h1>书信检索</h1><p>可按全文、收信人或来源精确检索；未输入条件时展示全部书信。</p></div>
          <p><strong>{letters.length}</strong><span>{search.query ? `封符合“${searchScopeLabels[search.scope]}”条件` : "封书信"}</span></p>
        </header>

        {letters.length ? (
          <section className="letter-list" aria-label="全部书信列表">
            {letters.map((letter) => {
              const entities = getLetterEntitySummary(letter.id);
              const result = resultMap.get(letter.id);
              return (
                <article className="letter-list-item" key={letter.id}>
                  <span className="letter-list-number">{letter.number}</span>
                  <div className="letter-list-body">
                    <header><div><h2>致{search.query && search.scope === "recipient" ? <HighlightedText text={letter.recipient} query={search.query} /> : letter.recipient}</h2><p>收信人：{search.query && search.scope === "recipient" ? <HighlightedText text={letter.recipient} query={search.query} /> : letter.recipient}</p></div><time>{formatLetterDate(letter)}</time></header>
                    <p className="letter-excerpt">{result && search.scope === "fulltext" ? <HighlightedText text={result.snippet} query={search.query} matchStart={result.snippetMatchStart} /> : getLetterExcerpt(letter)}</p>
                    <footer>
                      <span>来源：{search.query && search.scope === "source" ? <HighlightedText text={letter.source ?? "暂无来源字段"} query={search.query} /> : letter.source ?? "暂无来源字段"}</span>
                      {entities.count ? <span>实体 {entities.count} 处 · {entities.types.slice(0, 4).map((type) => entityTypeMeta[type].label).join("、")}</span> : <span>实体数据整理中</span>}
                      <Link href={result ? getSearchResultHref(result, search.query) : `/letter/${encodeURIComponent(letter.id)}`}>{result ? "定位命中" : "阅读原信"} <i aria-hidden="true">→</i></Link>
                    </footer>
                  </div>
                </article>
              );
            })}
          </section>
        ) : <div className="empty-state"><span>〇</span><h2>未找到对应书信</h2><p>可尝试输入收信人、年份、干支、原文词句或三位书信编号。</p></div>}
      </div>
    </main>
  );
}
