import Link from "next/link";
import {
  actionStyleVariables,
  actTypeMeta,
  entityStyleVariables,
  entityTypeMeta,
  eventStyleVariables,
  eventTypeMeta,
} from "@/lib/config";
import { dataset } from "@/lib/data-adapter";
import type { ActType, EntityType, EventType } from "@/lib/types";

const entityCodes = Object.keys(dataset.entityStats) as EntityType[];
const eventCodes = Object.keys(dataset.eventStats) as EventType[];
const actCodes = Object.keys(dataset.actStats) as ActType[];

export function TopicsPage() {
  return (
    <main className="topics-page site-container">
      <header className="topics-heading">
        <span>ANNOTATION CLASSIFICATION</span>
        <h1>实体分类检索</h1>
        <p>依照项目真实标注数据，将第一层实体、第二层事件与第三层行动分开呈现，可进入各层专题查看条目、出现次数与相关书信。</p>
      </header>

      <div className="classification-layers">
        <section className="classification-layer" aria-labelledby="first-layer-title">
          <header><span>01 · NER</span><div><h2 id="first-layer-title">第一层标注分类</h2><p>实体层回答“信中提到了谁、哪里、什么书”，类别与数量由完整第一层标注文件生成。</p></div></header>
          <div className="classification-grid">
            {entityCodes.map((code) => {
              const stats = dataset.entityStats[code];
              return (
                <Link href={`/category/entity/${code}`} className="classification-card entity-classification-card" key={code}>
                  <span className="entity-legend" style={entityStyleVariables(code)}><strong>{entityTypeMeta[code].label}</strong><small>{code}</small></span>
                  <p>{entityTypeMeta[code].prompt}</p>
                  <dl><div><dt>{stats.canonicalCount.toLocaleString("zh-CN")}</dt><dd>规范实体</dd></div><div><dt>{stats.mentionCount.toLocaleString("zh-CN")}</dt><dd>出现次数</dd></div><div><dt>{stats.letterCount}</dt><dd>相关书信</dd></div></dl>
                  <b>查看专题 <i aria-hidden="true">→</i></b>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="classification-layer" aria-labelledby="second-layer-title">
          <header><span>02 · EVT</span><div><h2 id="second-layer-title">第二层标注分类</h2><p>事件层回答“信里提到了什么事”，按真实事件数据中的类型分别汇总。</p></div></header>
          <div className="classification-grid compact-grid">
            {eventCodes.map((code) => {
              const stats = dataset.eventStats[code];
              return (
                <Link href={`/category/event/${code}`} className="classification-card event-classification-card" key={code}>
                  <span className="event-legend" style={eventStyleVariables(code)}><strong>{eventTypeMeta[code].label}</strong><small>{code}</small></span>
                  <p>{eventTypeMeta[code].definition}</p>
                  <dl><div><dt>{stats.eventCount.toLocaleString("zh-CN")}</dt><dd>标注事件</dd></div><div><dt>{stats.letterCount}</dt><dd>相关书信</dd></div></dl>
                  <b>查看专题 <i aria-hidden="true">→</i></b>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="classification-layer" aria-labelledby="third-layer-title">
          <header><span>03 · ACT</span><div><h2 id="third-layer-title">第三层标注分类</h2><p>行动层回答“这一段为什么写”。当前文件夹尚无第三层标注数据，分类结构完整保留，接入后可直接汇总。</p></div></header>
          <div className="classification-grid compact-grid">
            {actCodes.map((code) => {
              const stats = dataset.actStats[code];
              return (
                <Link href={`/category/act/${code}`} className="classification-card act-classification-card" key={code}>
                  <span className="act-legend" style={actionStyleVariables(code)}><strong>{actTypeMeta[code].label}</strong><small>{code}</small></span>
                  <p>{actTypeMeta[code].definition}</p>
                  <dl><div><dt>{stats.paragraphCount || "—"}</dt><dd>标注段落</dd></div><div><dt>{stats.letterCount || "—"}</dt><dd>相关书信</dd></div></dl>
                  <b>{stats.paragraphCount ? "查看专题" : "数据整理中"} <i aria-hidden="true">→</i></b>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
