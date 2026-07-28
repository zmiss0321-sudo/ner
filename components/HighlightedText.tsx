import { Fragment } from "react";

interface Props {
  text: string;
  query: string;
  matchStart?: number;
  markId?: string;
}

export function HighlightedText({ text, query, matchStart, markId }: Props) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const start = matchStart ?? text.toLocaleLowerCase("zh-CN").indexOf(needle.toLocaleLowerCase("zh-CN"));
  if (start < 0) return <>{text}</>;
  return (
    <Fragment>
      {text.slice(0, start)}
      <mark id={markId} className="search-match">{text.slice(start, start + needle.length)}</mark>
      {text.slice(start + needle.length)}
    </Fragment>
  );
}
