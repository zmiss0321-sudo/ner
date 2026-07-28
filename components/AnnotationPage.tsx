"use client";

import { useState } from "react";
import { AnnotationLayerSidebar } from "./AnnotationLayerSidebar";
import { FeaturedLetterViewer } from "./FeaturedLetterViewer";
import { LetterSearchBar } from "./LetterSearchBar";
import { LetterSearchResults } from "./LetterSearchResults";
import type { SearchScope } from "@/lib/types";

export function AnnotationPage() {
  const [search, setSearch] = useState<{ query: string; scope: SearchScope }>({ query: "", scope: "fulltext" });
  return (
    <main>
      <div className="search-band"><div className="site-container"><LetterSearchBar initialValue={search.query} initialScope={search.scope} onSearch={(query, scope) => setSearch({ query, scope })} /></div></div>
      <div className="site-container annotation-layout">
        <AnnotationLayerSidebar />
        <div className="annotation-main">
          {search.query ? <LetterSearchResults query={search.query} scope={search.scope} onClear={() => setSearch((current) => ({ ...current, query: "" }))} /> : <FeaturedLetterViewer />}
        </div>
      </div>
    </main>
  );
}
