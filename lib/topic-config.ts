import type { EntityType } from "./types";

export interface SecondaryCategory {
  code: string;
  label: string;
  description: string;
}

/**
 * 专题级配置：搜索占位文字、二级分类等。
 * 各专题实体由 entityCode 与真实数据自动配对，此处只写死 UI 结构。
 */
export interface TopicUIConfig {
  searchPlaceholder: string;
  secondaryCategories: SecondaryCategory[];
}

const LOC_CATEGORIES: SecondaryCategory[] = [
  { code: "ADM0", label: "国家", description: "国家及具有国家属性的地理实体" },
  { code: "ADM1", label: "省／省级", description: "省及省级行政区域" },
  { code: "ADM2", label: "府／州／县级", description: "府、州、县及相近行政层级" },
  { code: "URB", label: "城市", description: "城市、城镇及常用城市名称" },
  { code: "STR", label: "街道／具体地点", description: "街道、坊巷及具体地点" },
  { code: "REG", label: "地区／模糊区域", description: "江南、湘中、吴中等范围性地名" },
  { code: "MTN", label: "山岳", description: "山、岭、峰等自然地理实体" },
  { code: "WAT", label: "水体", description: "江、河、湖、海及其他水域" },
  { code: "FAC", label: "设施／建筑", description: "具有明确空间属性的设施与建筑" },
];

const PER_CATEGORIES: SecondaryCategory[] = [
  { code: "PER-SELF", label: "叶德辉本人", description: "书信作者叶德辉本人" },
  { code: "PER-ADDRESSEE", label: "收信人", description: "书信收信人" },
  { code: "PER-CONTEMPORARY", label: "同时代人", description: "与叶德辉同时代的人物" },
  { code: "PER-FAMILY", label: "叶氏家族", description: "叶德辉家族成员" },
  { code: "PER-JAPANESE", label: "日本人士", description: "日本相关人物" },
  { code: "PER-HISTORICAL", label: "历史人物", description: "历史人物" },
  { code: "PER-AMBIG", label: "待考", description: "身份待考证的人物" },
];

const BOK_CATEGORIES: SecondaryCategory[] = [
  { code: "BOK-CLASSICS", label: "经部", description: "经部典籍" },
  { code: "BOK-HISTORY", label: "史部", description: "史部典籍" },
  { code: "BOK-THINKERS", label: "子部", description: "子部典籍" },
  { code: "BOK-LITERATURE", label: "集部", description: "集部典籍" },
  { code: "BOK-MODERN", label: "今人著作", description: "近现代著作" },
  { code: "BOK-REFERENCE", label: "工具书", description: "工具书、参考书" },
  { code: "BOK-ANCESTOR", label: "先祖著作", description: "叶氏先祖著作" },
];

const VER_CATEGORIES: SecondaryCategory[] = [
  { code: "VER-SONG", label: "宋本／宋刻", description: "宋代刻本" },
  { code: "VER-YUAN", label: "元本／元刻", description: "元代刻本" },
  { code: "VER-MING", label: "明本／明刻", description: "明代刻本" },
  { code: "VER-QING", label: "清本／清刻", description: "清代刻本" },
  { code: "VER-BLOCK", label: "刻本／刊本", description: "各类刻本、刊本" },
  { code: "VER-MANUSCRIPT", label: "抄本／稿本／写本", description: "手抄、稿本、写本" },
  { code: "VER-MOVABLE", label: "活字本／排印本", description: "活字、排印本" },
  { code: "VER-RUBBING", label: "拓本／碑帖", description: "拓本、碑帖" },
  { code: "VER-FACSIMILE", label: "影印本／石印本", description: "影印、石印本" },
  { code: "VER-QUALIFIER", label: "版本状态", description: "版本质量、状态描述" },
  { code: "VER-JAPANESE", label: "和刻本", description: "日本刻本" },
];

const TIM_CATEGORIES: SecondaryCategory[] = [
  { code: "TIM-RELATIVE", label: "相对时间", description: "相对时间表达" },
  { code: "TIM-ABSOLUTE", label: "绝对时间", description: "绝对年月日" },
  { code: "TIM-DURATION", label: "时段／频率", description: "时间段或频率" },
  { code: "TIM-PERIOD", label: "历史时期", description: "朝代、年号等历史时期" },
];

const OFF_CATEGORIES: SecondaryCategory[] = [
  { code: "OFF-CENTRAL", label: "中央文官", description: "中央文官职位" },
  { code: "OFF-LOCAL", label: "地方官", description: "地方官职" },
  { code: "OFF-MILITARY", label: "武职", description: "军事职位" },
  { code: "OFF-ACADEMIC", label: "学官／文教", description: "学术、教育官职" },
  { code: "OFF-MODERN", label: "民国新职", description: "民国时期新设职位" },
  { code: "OFF-DIPLOMATIC", label: "外交／涉外", description: "外交和涉外职位" },
];

const ORG_CATEGORIES: SecondaryCategory[] = [
  { code: "ORG-PUBLISH", label: "出版／书店", description: "出版社、书店" },
  { code: "ORG-LIBRARY", label: "图书馆／藏书机构", description: "图书馆和藏书机构" },
  { code: "ORG-EDUCATION", label: "学校／书院", description: "学校和书院" },
  { code: "ORG-GOVERNMENT", label: "政府／衙门", description: "政府机关和衙门" },
  { code: "ORG-POLITICAL", label: "政党／派系", description: "政党和派系" },
  { code: "ORG-COMPANY", label: "公司／银行", description: "公司和银行" },
  { code: "ORG-STUDIO", label: "书斋／堂号", description: "书斋和堂号" },
];

const KIN_CATEGORIES: SecondaryCategory[] = [
  { code: "KIN-ANCESTOR", label: "祖先／先世", description: "祖先和先世" },
  { code: "KIN-DESCENDANT", label: "子孙／后嗣", description: "子孙后代" },
  { code: "KIN-PATERNAL", label: "父系／宗族", description: "父系和宗族关系" },
  { code: "KIN-AFFINAL", label: "姻亲／婚姻", description: "姻亲和婚姻关系" },
  { code: "KIN-COLLECTIVE", label: "家族合称", description: "家族集体称谓" },
];

const AST_CATEGORIES: SecondaryCategory[] = [
  { code: "AST-WUXING", label: "五行／干支", description: "五行和干支" },
  { code: "AST-XINGSU", label: "星宿／星次", description: "星宿和星次" },
  { code: "AST-MINGLI", label: "命理／八字", description: "命理和八字" },
  { code: "AST-YIXUE", label: "易学／占卜", description: "易学和占卜" },
  { code: "AST-DIVINATION", label: "杂占／风水", description: "杂占和风水" },
];

const CATEGORY_MAP: Record<EntityType, SecondaryCategory[]> = {
  LOC: LOC_CATEGORIES,
  PER: PER_CATEGORIES,
  BOK: BOK_CATEGORIES,
  VER: VER_CATEGORIES,
  TIM: TIM_CATEGORIES,
  OFF: OFF_CATEGORIES,
  ORG: ORG_CATEGORIES,
  KIN: KIN_CATEGORIES,
  AST: AST_CATEGORIES,
};

export function getSecondaryCategories(entityCode: EntityType): SecondaryCategory[] {
  return CATEGORY_MAP[entityCode] ?? [];
}

export function getSearchPlaceholder(topicName: string): string {
  const placeholders: Record<string, string> = {
    "地点": "搜索地点、别名或相关表述……",
    "人物": "搜索人物、称谓或规范人名……",
    "书籍": "搜索书名、简称或相关表述……",
    "版本": "搜索版本、刻本类型或相关表述……",
    "时间": "搜索时间、年号或干支……",
    "官职": "搜索官职、官衔或相关表述……",
    "机构": "搜索机构、衙署或相关表述……",
    "亲属": "搜索亲属、称谓或相关表述……",
    "星命": "搜索星命、术数或相关表述……",
  };
  return placeholders[topicName] ?? `搜索${topicName}……`;
}
