type TopicMetric = {
  value: string | number;
  label: string;
};

type TopicHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: TopicMetric[];
};

/**
 * 紧凑型专题标题区 — 所有专题共用。
 * 上下 padding 控制在 32px–44px，不使用大高度。
 */
export function TopicHeader({ eyebrow, title, description, metrics }: TopicHeaderProps) {
  return (
    <header className="topic-header">
      <div className="topic-header-copy">
        <span className="topic-header-eyebrow">{eyebrow}</span>
        <h1 className="topic-header-title">{title}</h1>
        <p className="topic-header-desc">{description}</p>
      </div>
      <dl className="topic-header-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.value}</dt>
            <dd>{metric.label}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
