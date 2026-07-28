"use client";

import { FormEvent, useState } from "react";
import { searchScopeLabels } from "@/lib/data-adapter";
import type { SearchScope } from "@/lib/types";

interface Props {
  initialValue?: string;
  initialScope?: SearchScope;
  onSearch: (query: string, scope: SearchScope) => void;
}

export function LetterSearchBar({ initialValue = "", initialScope = "fulltext", onSearch }: Props) {
  const [value, setValue] = useState(initialValue);
  const [scope, setScope] = useState<SearchScope>(initialScope);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(value.trim(), scope);
  }

  function clear() {
    setValue("");
    onSearch("", scope);
  }

  return (
    <form className="letter-search" onSubmit={submit} role="search">
      <label className="sr-only" htmlFor="letter-search-scope">检索范围</label>
      <select id="letter-search-scope" value={scope} onChange={(event) => setScope(event.target.value as SearchScope)}>
        {(Object.entries(searchScopeLabels) as Array<[SearchScope, string]>).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <label className="sr-only" htmlFor="letter-search-input">检索书信</label>
      <input
        id="letter-search-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={scope === "fulltext" ? "输入原文关键词" : scope === "recipient" ? "输入收信人姓名" : "输入来源或出版信息"}
        autoComplete="off"
      />
      {value ? <button className="search-clear" type="button" onClick={clear}>清除</button> : null}
      <button className="search-submit" type="submit">检索</button>
    </form>
  );
}
