type TopicSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

/**
 * 专题内部搜索框 — 所有专题共用。
 */
export function TopicSearch({ value, onChange, placeholder }: TopicSearchProps) {
  return (
    <label className="topic-search">
      <span>专题内检索</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
