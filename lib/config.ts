import type { CSSProperties } from "react";
import type { ActType, EntityType, EventType, TopicDefinition } from "./types";

export const featuredLetterIds = [
  "171_1913_缪荃孙",
  "063_1914_松崎鹤雄",
  "064_1914_松崎鹤雄",
  "172_1914_缪荃孙",
] as const;

export const entityTypeMeta: Record<EntityType, { label: string; prompt: string }> = {
  PER: { label: "人物", prompt: "信中出现的人物、称谓与规范人名" },
  LOC: { label: "地点", prompt: "信中出现的地名及规范地点" },
  BOK: { label: "书籍", prompt: "信中提及的书名" },
  VER: { label: "版本", prompt: "书籍的刻本、抄本与版本信息" },
  TIM: { label: "时间", prompt: "年、月、日与干支时间" },
  OFF: { label: "官职", prompt: "人物的官职与职衔" },
  ORG: { label: "机构", prompt: "政府、学校与社会机构" },
  KIN: { label: "亲属", prompt: "亲属关系与亲属称谓" },
  AST: { label: "星命", prompt: "星命与术数相关表达" },
};

/**
 * 实体专题总入口的唯一配置源。后续新增专题时，只需在这里补充定义，
 * 总入口和专题路由会自动读取同一份配置。
 */
export const topicDefinitions: TopicDefinition[] = [
  { id: "person", name: "人物", slug: "people", englishLabel: "PER", kind: "entity", entityCode: "PER", description: entityTypeMeta.PER.prompt },
  { id: "place", name: "地点", slug: "places", englishLabel: "LOC", kind: "entity", entityCode: "LOC", description: entityTypeMeta.LOC.prompt },
  { id: "organization", name: "机构", slug: "organizations", englishLabel: "ORG", kind: "entity", entityCode: "ORG", description: entityTypeMeta.ORG.prompt },
  { id: "time", name: "时间", slug: "times", englishLabel: "TIM", kind: "entity", entityCode: "TIM", description: entityTypeMeta.TIM.prompt },
  { id: "office", name: "官职", slug: "offices", englishLabel: "OFF", kind: "entity", entityCode: "OFF", description: entityTypeMeta.OFF.prompt },
  { id: "book", name: "书籍", slug: "books", englishLabel: "BOK", kind: "entity", entityCode: "BOK", description: entityTypeMeta.BOK.prompt },
  { id: "edition", name: "版本", slug: "editions", englishLabel: "VER", kind: "entity", entityCode: "VER", description: entityTypeMeta.VER.prompt },
  { id: "event", name: "事件", slug: "events", englishLabel: "EVT", kind: "event", description: "书信中标注的文献、学术、交往、时局与家族事件" },
  { id: "astrology", name: "星命", slug: "astrology", englishLabel: "AST", kind: "entity", entityCode: "AST", description: entityTypeMeta.AST.prompt },
  { id: "kinship", name: "亲属", slug: "kinship", englishLabel: "KIN", kind: "entity", entityCode: "KIN", description: entityTypeMeta.KIN.prompt },
];

export const eventTypeMeta: Record<EventType, { label: string; definition: string }> = {
  BIB: { label: "文献活动", definition: "购书、借书、索取拓片、刻印、版本评价、著书计划与撰书进展。" },
  ACA: { label: "学术活动", definition: "考证、鉴定、论学、学术史评价及著作学术贡献评价。" },
  SOC: { label: "社会交往", definition: "通信、通报近况、会晤、请托、行迹、叙旧与友朋交往。" },
  POL: { label: "政治时局", definition: "战乱议论、时局影响、国际关系与文化批判。" },
  FAM: { label: "家族事务", definition: "修谱、葬事、先君先慈、家母寿庆与家族话题。" },
};

export const actTypeMeta: Record<ActType, { label: string; definition: string }> = {
  REQ: { label: "请求", definition: "提出请求、委托或期望对方采取行动。" },
  DSP: { label: "展示", definition: "展示学识、成果、收藏或个人立场。" },
  INF: { label: "告知", definition: "向收信人传递事实、进展或近况。" },
  PRS: { label: "赞扬", definition: "表达赞许、敬重或正面评价。" },
  MNT: { label: "维系", definition: "维护关系、问候、致意或延续交往。" },
  INS: { label: "训导", definition: "提出教诲、规劝或学术指导。" },
  NEG: { label: "协商", definition: "讨论条件、安排与可协调事项。" },
};

type EntityAnnotationStyle = {
  color: string;
  hover: string;
  selected: string;
  fontWeight: CSSProperties["fontWeight"];
  fontStyle: CSSProperties["fontStyle"];
  decoration: CSSProperties["textDecorationLine"];
  decorationStyle: CSSProperties["textDecorationStyle"];
};

type EventAnnotationStyle = {
  accent: string;
  background: string;
  hover: string;
  selected: string;
  border: string;
};

type ActionAnnotationStyle = {
  color: string;
  border: string;
  background: string;
  hover: string;
  selected: string;
};

/**
 * The single visual source of truth for the three annotation layers.
 * Both the directory legends and the letter text consume these tokens.
 */
export const annotationStyles: {
  entity: Record<EntityType, EntityAnnotationStyle>;
  event: Record<EventType, EventAnnotationStyle>;
  action: Record<ActType, ActionAnnotationStyle>;
} = {
  entity: {
    PER: { color: "#8b4c4c", hover: "#f2e8e5", selected: "#ead8d4", fontWeight: 600, fontStyle: "normal", decoration: "none", decorationStyle: "solid" },
    LOC: { color: "#566b82", hover: "#e9eef1", selected: "#dce5e9", fontWeight: 400, fontStyle: "italic", decoration: "none", decorationStyle: "solid" },
    BOK: { color: "#8a6b37", hover: "#f2ecde", selected: "#e9dfc9", fontWeight: 400, fontStyle: "normal", decoration: "underline", decorationStyle: "wavy" },
    VER: { color: "#735f82", hover: "#eee9f1", selected: "#e3daea", fontWeight: 400, fontStyle: "normal", decoration: "underline", decorationStyle: "dashed" },
    TIM: { color: "#86664d", hover: "#f1ebe4", selected: "#e7dcd1", fontWeight: 400, fontStyle: "italic", decoration: "none", decorationStyle: "solid" },
    OFF: { color: "#5d6287", hover: "#eaebf1", selected: "#dddfea", fontWeight: 400, fontStyle: "normal", decoration: "none", decorationStyle: "solid" },
    ORG: { color: "#4f7075", hover: "#e7eeee", selected: "#d9e5e5", fontWeight: 400, fontStyle: "normal", decoration: "none", decorationStyle: "solid" },
    KIN: { color: "#966471", hover: "#f1e8ea", selected: "#e8d9dd", fontWeight: 400, fontStyle: "normal", decoration: "none", decorationStyle: "solid" },
    AST: { color: "#477064", hover: "#e6eeea", selected: "#d6e4de", fontWeight: 400, fontStyle: "normal", decoration: "underline", decorationStyle: "solid" },
  },
  event: {
    BIB: { accent: "#746d91", background: "rgba(145, 118, 154, 0.24)", hover: "rgba(145, 118, 154, 0.30)", selected: "rgba(145, 118, 154, 0.34)", border: "rgba(145, 118, 154, 0.28)" },
    ACA: { accent: "#557985", background: "rgba(99, 139, 151, 0.24)", hover: "rgba(99, 139, 151, 0.30)", selected: "rgba(99, 139, 151, 0.34)", border: "rgba(99, 139, 151, 0.28)" },
    SOC: { accent: "#956d71", background: "rgba(162, 125, 100, 0.24)", hover: "rgba(162, 125, 100, 0.30)", selected: "rgba(162, 125, 100, 0.34)", border: "rgba(162, 125, 100, 0.28)" },
    POL: { accent: "#88764f", background: "rgba(145, 131, 98, 0.24)", hover: "rgba(145, 131, 98, 0.30)", selected: "rgba(145, 131, 98, 0.34)", border: "rgba(145, 131, 98, 0.28)" },
    FAM: { accent: "#687d70", background: "rgba(110, 132, 118, 0.24)", hover: "rgba(110, 132, 118, 0.30)", selected: "rgba(110, 132, 118, 0.34)", border: "rgba(110, 132, 118, 0.28)" },
  },
  action: {
    REQ: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
    DSP: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
    INF: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
    PRS: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
    MNT: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
    INS: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
    NEG: { color: "#5f5870", border: "#9c96a6", background: "#f8f6f0", hover: "#efedf2", selected: "#e5e1eb" },
  },
};

export function entityStyleVariables(type: EntityType): CSSProperties {
  const style = annotationStyles.entity[type];
  return {
    "--annotation-color": style.color,
    "--annotation-hover": style.hover,
    "--annotation-selected": style.selected,
    "--annotation-weight": style.fontWeight,
    "--annotation-style": style.fontStyle,
    "--annotation-decoration": style.decoration,
    "--annotation-decoration-style": style.decorationStyle,
  } as CSSProperties;
}

export function eventStyleVariables(type: EventType): CSSProperties {
  const style = annotationStyles.event[type];
  return {
    "--annotation-accent": style.accent,
    "--annotation-background": style.background,
    "--annotation-hover": style.hover,
    "--annotation-selected": style.selected,
    "--annotation-border": style.border,
  } as CSSProperties;
}

export function actionStyleVariables(type: ActType): CSSProperties {
  const style = annotationStyles.action[type];
  return {
    "--annotation-color": style.color,
    "--annotation-border": style.border,
    "--annotation-background": style.background,
    "--annotation-hover": style.hover,
    "--annotation-selected": style.selected,
  } as CSSProperties;
}
