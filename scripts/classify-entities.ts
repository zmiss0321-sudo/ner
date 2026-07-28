/**
 * 基于规则自动推断所有实体类型的二级分类（subtype），直接写入 generated.json。
 * 不改动任何组件或 lib 代码。
 * 用法：npx tsx scripts/classify-entities.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

interface EntityCatalogEntry {
  type: string;
  canonical: string;
  aliases: string[];
  subtypes: string[];
  count: number;
  letterIds: string[];
}

interface Letter {
  id: string;
  recipient: string;
}

interface Dataset {
  generatedAt: string;
  letters: Letter[];
  entitiesByLetter: Record<string, any[]>;
  eventsByLetter: Record<string, any[]>;
  entityCatalog: EntityCatalogEntry[];
  entityStats: Record<string, any>;
  eventStats: Record<string, any>;
  actStats: Record<string, any>;
}

const dataPath = "data/generated.json";
const raw = readFileSync(dataPath, "utf-8");
const dataset: Dataset = JSON.parse(raw);

// ─── Recipients ───
const recipients = new Set(dataset.letters.map((l) => l.recipient));

// ─── Alias → canonical lookup for PER ───
const perAliasToCanonical = new Map<string, string>();
for (const e of dataset.entityCatalog) {
  if (e.type !== "PER") continue;
  for (const a of e.aliases) perAliasToCanonical.set(a, e.canonical);
}

function namesOf(entry: EntityCatalogEntry): string[] {
  return [entry.canonical, ...entry.aliases];
}

// ═══════════════════════════════════════════
// PER Classification
// ═══════════════════════════════════════════
function classifyPER(entry: EntityCatalogEntry): string[] {
  const names = namesOf(entry);
  const allText = names.join(" ");

  // 1. PER-SELF: 叶德辉本人
  if (/^叶德辉$|^叶徳辉$|^徳辉$|^德辉$|^郋园$|^丽廔$/.test(entry.canonical)) {
    return ["PER-SELF"];
  }
  for (const n of names) {
    if (/^叶德辉$|^叶徳辉$/.test(n)) return ["PER-SELF"];
  }

  // 2. PER-JAPANESE: 日本人
  const jpPatterns = [
    "白岩龙平", "松崎鹤雄", "水野梅晓", "后藤朝太郎",
    "岩崎弥之助", "内藤", "佐藤", "竹添", "岛田", "藤田",
    "田中", "盐谷", "安井", "竹柏", "本田",
  ];
  if (jpPatterns.some((p) => allText.includes(p))) return ["PER-JAPANESE"];
  if (/^(白岩|松崎|水野|后藤|岩崎|内藤|佐藤|竹添|岛田|藤田|田中|盐谷|安井|竹柏|本田)/.test(entry.canonical)) {
    return ["PER-JAPANESE"];
  }

  // 3. PER-FAMILY: 叶氏家族
  const yeFamilyPatterns = [
    "叶永倬", "尚农", "叶梦得", "叶燮", "已畦", "横山",
    "叶绍袁", "天寥", "叶小鸾", "叶永慕", "习斋",
    "叶衍兰", "叶盛", "叶印濂", "叶砺甫", "叶永倌",
    "石君先生", "石君公", "石林先生",
  ];
  if (yeFamilyPatterns.some((p) => allText.includes(p))) return ["PER-FAMILY"];
  // 叶姓 + family indicator
  if (entry.canonical.startsWith("叶") && !recipients.has(entry.canonical)) {
    // Check if it's 叶昌炽 or 叶恭绰 (these are contemporaries, not family)
    if (/^叶(昌炽|恭绰|德辉)$/.test(entry.canonical)) {
      // 叶昌炽 and 叶恭绰 are contemporaries, not family
    } else {
      return ["PER-FAMILY"];
    }
  }

  // 4. PER-HISTORICAL: 历史人物（清代以前）
  const historicalSet = new Set([
    "孔子", "仓颉", "孟子", "荀子", "庄子", "老子", "墨子", "韩非子",
    "屈原", "司马迁", "班固", "张衡", "郑玄", "孔安国", "贾逵",
    "伏羲", "神农", "黄帝", "尧", "舜", "禹", "周文王", "周武王",
    "周公", "召公", "太公", "管仲", "晏婴", "孙武", "吴起",
    "秦始皇", "汉高祖", "汉文帝", "汉武帝", "光武帝",
    "曹操", "诸葛亮", "关羽", "张飞", "刘备", "孙权",
    "王羲之", "陶渊明", "谢灵运", "李白", "杜甫", "白居易",
    "韩愈", "柳宗元", "苏轼", "欧阳修", "王安石", "司马光",
    "朱熹", "陆九渊", "王守仁", "王阳明", "顾炎武", "黄宗羲",
    "王夫之", "颜元", "李贽", "戴震", "段玉裁", "钱大昕",
    "毛晋", "钱谦益", "朱彝尊", "何焯", "卢文弨", "鲍廷博",
    "黄丕烈", "顾广圻", "吴骞", "陈鳣", "张金吾", "瞿镛",
    "赵孟𫖯", "颜真卿", "柳公权", "欧阳询", "虞世南", "褚遂良",
    "范仲淹", "黄庭坚", "米芾", "赵佶", "文天祥", "郑思肖",
  ]);
  if (historicalSet.has(entry.canonical)) return ["PER-HISTORICAL"];

  // 5. PER-ADDRESSEE: 收信人
  const isRecipient = names.some((n) => recipients.has(n));
  if (isRecipient) return ["PER-ADDRESSEE"];

  // 6. PER-CONTEMPORARY: 同时代人（默认）
  return ["PER-CONTEMPORARY"];
}

// ═══════════════════════════════════════════
// BOK Classification (经史子集 + 现代 + 工具书 + 先祖)
// ═══════════════════════════════════════════

// 经部 关键词
const classicsSet = new Set([
  "易", "周易", "易经", "易传", "归藏", "连山",
  "尚书", "书经", "今文尚书", "古文尚书", "书序",
  "诗经", "毛诗", "鲁诗", "齐诗", "韩诗", "诗序", "诗谱",
  "周礼", "周官", "考工记",
  "仪礼", "士礼", "礼经",
  "礼记", "大戴礼记", "小戴礼记",
  "春秋", "左传", "左氏", "左氏传", "公羊", "公羊传", "穀梁", "穀梁传",
  "春秋繁露", "春秋释例", "春秋集传", "春秋集解",
  "论语", "论语义疏", "论语集解",
  "孝经", "孝经注",
  "孟子", "孟子注", "孟子集注",
  "尔雅", "尔雅注", "尔雅疏", "小尔雅", "广雅", "方言", "释名",
  "四书", "四书章句", "四书集注",
  "十三经", "十三经注疏", "十一经", "九经", "七经", "五经", "六经",
  "经义", "经解", "经说", "经传", "经学",
  "说文", "说文解字", "说文系传", "说文解字注", "说文段注",
  "字林", "玉篇", "类篇", "字汇", "正字通", "康熙字典",
  "经典释文", "经传释词", "经义述闻", "经籍纂诂",
  "六书", "六书故", "六书古微", "六书略", "文字蒙求",
  "急就章", "急就篇", "千字文", "仓颉篇",
  "古籀", "古籀补", "古籀拾遗", "古籀余论",
  "隶释", "隶续", "金石粹编", "金石录",
  "切韵", "广韵", "集韵", "礼部韵略", "平水韵", "佩文韵府",
  "声类", "声韵", "音学", "音韵",
]);

const historySet = new Set([
  "史记", "汉书", "后汉书", "三国志", "晋书", "宋书", "南齐书", "梁书",
  "陈书", "魏书", "北齐书", "周书", "隋书", "南史", "北史",
  "旧唐书", "新唐书", "旧五代史", "新五代史", "宋史", "辽史", "金史",
  "元史", "明史", "清史稿",
  "资治通鉴", "通鉴纲目", "续资治通鉴", "通鉴纪事本末",
  "国语", "战国策", "竹书纪年", "逸周书", "世本", "路史",
  "东观汉记", "建康实录", "十国春秋",
  "通典", "通志", "文献通考", "续通典", "续通志", "续文献通考",
  "唐会要", "五代会要", "宋会要", "西汉会要", "东汉会要",
  "水经注", "水经", "山海经", "禹贡", "职方",
  "郡国志", "地理志", "舆地", "方舆", "一统志", "元和郡县",
  "史通", "文史通义", "廿二史札记", "十七史商榷",
  "国史", "实录", "起居注", "圣政", "宝训", "会典",
  "碑传集", "耆献", "列女传", "高僧传",
]);

const thinkersSet = new Set([
  "老子", "道德经", "庄子", "南华经", "列子", "冲虚经",
  "荀子", "韩非子", "墨子", "公孙龙子", "尹文子", "慎子",
  "管子", "商君书", "邓析子", "尸子", "鹖冠子", "鬼谷子",
  "吕氏春秋", "淮南子", "白虎通", "白虎通义", "论衡",
  "法言", "新语", "新书", "说苑", "新序", "盐铁论", "潜夫论",
  "申鉴", "中论", "人物志", "金楼子", "颜氏家训",
  "抱朴子", "本生经", "道藏", "道书", "佛经", "大藏",
  "金刚经", "法华经", "楞严经", "华严经", "涅槃经", "般若",
  "五灯会元", "景德传灯录", "高僧传", "续高僧传",
  "世说新语", "酉阳杂俎", "梦溪笔谈", "容斋随笔",
  "困学纪闻", "日知录", "十驾斋养新录",
  "艺文类聚", "太平御览", "册府元龟", "永乐大典", "古今图书集成",
  "初学记", "北堂书钞", "白孔六帖", "事类赋", "玉海",
  "四库全书", "四库", "四库总目", "四库提要",
  "书目答问", "郡斋读书志", "直斋书录解题",
  "崇文总目", "文渊阁书目", "天禄琳琅",
  "三教搜神大全", "五行大义", "观画百咏",
  "参寥", "披沙集", "石门",
]);

const literatureSet = new Set([
  "楚辞", "离骚", "九歌", "九章", "天问", "招魂",
  "文选", "古文苑", "文苑英华", "唐文粹", "宋文鉴", "元文类",
  "全上古三代文", "全汉文", "全唐文", "全唐诗", "全宋词", "全金诗",
  "元诗选", "明诗综", "列朝诗集", "明诗纪事",
  "乐府诗集", "玉台新咏", "古诗源", "古诗纪", "唐诗纪事", "宋诗纪事",
  "河岳英灵集", "中兴间气集", "才调集", "花间集", "尊前集",
  "陶诗", "陶渊明集", "李太白集", "杜工部集",
  "韩昌黎集", "柳河东集", "白氏长庆集",
  "苏东坡集", "欧阳文忠集", "临川集",
  "石林诗话", "石林燕语", "避暑录话",
  "建康集", "遗书", "天寥年谱", "甲行日注",
  "郋园", "观古", "书林",
]);

const modernSet = new Set([
  "书林清话", "书林余话", "藏书十约", "观古堂藏书目",
  "郋园读书志", "郋园山居文录", "郋园北游文存",
  "四部丛刊", "古逸丛书", "续古逸丛书",
  "百衲本二十四史", "四部备要", "丛书集成",
]);

const referenceSet = new Set([
  "书目答问", "四库全书总目", "四库简明目录",
  "郋园读书志", "观古堂藏书目", "皕宋楼藏书志",
  "铁琴铜剑楼藏书目", "善本书室藏书志", "艺风藏书记",
  "八千卷楼书目", "海源阁书目", "经籍访古志",
]);

const ancestorWorksSet = new Set([
  "石林燕语", "避暑录话", "建康集", "石林诗话",
  "石林词", "石林奏议", "石林家训",
  "已畦集", "已畦诗集", "原诗",
  "天寥年谱", "甲行日注", "形园遗书",
]);

function classifyBOK(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;
  const allNames = namesOf(entry).join(" ");

  // Precise lookups first
  if (ancestorWorksSet.has(name) || /^(石林|已畦|天寥|小鸾|郋园|观古|形园)/.test(name)) return ["BOK-ANCESTOR"];
  if (modernSet.has(name)) return ["BOK-MODERN"];
  if (referenceSet.has(name)) return ["BOK-REFERENCE"];
  if (classicsSet.has(name)) return ["BOK-CLASSICS"];
  if (historySet.has(name)) return ["BOK-HISTORY"];
  if (thinkersSet.has(name)) return ["BOK-THINKERS"];
  if (literatureSet.has(name)) return ["BOK-LITERATURE"];

  // Pattern-based classification
  // 经部 patterns
  if (/[经]$/.test(name) && !/[记传志录]$/.test(name)) return ["BOK-CLASSICS"];
  if (/^(易|诗|书|礼|春秋|孝|论|孟|尔)/.test(name) && name.length <= 4) return ["BOK-CLASSICS"];
  if (/[疏注解诂训释笺]$/.test(name) && name.length <= 6) return ["BOK-CLASSICS"];
  if (/[说文解字]/.test(name) && /^(说文|说字|六书|字|韵|声|音|切|篆|隶|古籀)/.test(name)) return ["BOK-CLASSICS"];

  // 史部 patterns
  if (/[史志谱表纪传]$/.test(name) && name.length <= 4) return ["BOK-HISTORY"];
  if (/^(汉书|后汉|三国|晋书|宋书|唐书|五代|明史|清史)/.test(name)) return ["BOK-HISTORY"];
  if (/[通鉴会要实录]$/.test(name)) return ["BOK-HISTORY"];
  if (/[地理志郡国]$/.test(name)) return ["BOK-HISTORY"];
  if (/[金石碑]$/.test(name) && /[录粹记集编]$/.test(name)) return ["BOK-HISTORY"];

  // 子部 patterns
  if (/[子]$/.test(name) && name.length <= 3 && !/[女子]/.test(name)) return ["BOK-THINKERS"];
  if (/^(老子|庄子|荀子|韩非|墨子|列子|抱朴|淮南)/.test(name)) return ["BOK-THINKERS"];
  if (/^(世说|梦溪|容斋|困学|日知|十驾)/.test(name)) return ["BOK-THINKERS"];
  if (/[藏]$/.test(name) && name.length <= 3) return ["BOK-THINKERS"];
  if (/[经]$/.test(name) && /^(佛|道|释|涅|法华|华严|金刚|楞严|般若)/.test(name)) return ["BOK-THINKERS"];
  if (/书$/.test(name) && /^(类|丛|集成|汇)/.test(name)) return ["BOK-THINKERS"];
  if (/^(艺文|太平|册府|永乐|古今)/.test(name)) return ["BOK-THINKERS"];
  if (/^(书目|书录|读书|藏书|经籍)/.test(name)) return ["BOK-REFERENCE"];

  // 集部 patterns
  if (/[集]$/.test(name) && name.length <= 4) return ["BOK-LITERATURE"];
  if (/[诗钞词]$/.test(name)) return ["BOK-LITERATURE"];
  if (/^(文选|古文苑|文苑|唐文|宋文|元文|明文|全唐|全宋)/.test(name)) return ["BOK-LITERATURE"];
  if (/[先生集公集]$/.test(name)) return ["BOK-LITERATURE"];

  // 现代
  if (/^(书林|郋园|观古|皕宋|藏书|版本)/.test(name)) return ["BOK-MODERN"];
  if (/^(四部|古逸|百衲)/.test(name)) return ["BOK-MODERN"];

  // 工具书
  if (/^(书目|书录|目录|藏书记)$/.test(name)) return ["BOK-REFERENCE"];
  if (/[书目答问]$/.test(name)) return ["BOK-REFERENCE"];

  // Default: general classification
  if (/[经义训诂小学字书音韵]/u.test(name)) return ["BOK-CLASSICS"];
  if (/[史志谱表传记录]/u.test(name) && name.length <= 5) return ["BOK-HISTORY"];

  // Fallback for most books: 子部 as the broadest category
  return ["BOK-THINKERS"];
}

// ═══════════════════════════════════════════
// VER Classification
// ═══════════════════════════════════════════
function classifyVER(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;

  // Japanese
  if (/和刻|日本|倭刻/.test(name)) return ["VER-JAPANESE"];

  // Song
  if (/^宋/.test(name) && /[本刻板刊印]$/.test(name)) return ["VER-SONG"];
  if (/^仿宋/.test(name)) return ["VER-FACSIMILE"];
  if (/宋元/.test(name) && /[本板]$/.test(name)) return ["VER-SONG"]; // 宋元本 → prefer SONG

  // Yuan
  if (/^元/.test(name) && /[本刻板刊]$/.test(name)) return ["VER-YUAN"];
  if (/^元刊/.test(name)) return ["VER-YUAN"];

  // Ming
  if (/^明/.test(name) && /[本刻板刊翻]$/.test(name)) return ["VER-MING"];
  if (/^明刊/.test(name)) return ["VER-MING"];
  if (/^明翻元/.test(name)) return ["VER-MING"];

  // Qing
  if (/^清/.test(name) && /[本刻]$/.test(name)) return ["VER-QING"];
  if (/^(殿本|武英殿)/.test(name)) return ["VER-QING"];

  // Manuscript variants
  if (/[抄钞]$/.test(name) && /[本]$/.test(name)) return ["VER-MANUSCRIPT"];
  if (/^抄本$|^钞本$|^稿本$|^写本$/.test(name)) return ["VER-MANUSCRIPT"];
  if (/校本/.test(name) && !/^宋|^元|^明|^清/.test(name)) return ["VER-MANUSCRIPT"];
  if (/稿$/.test(name) && name.length <= 3) return ["VER-MANUSCRIPT"];

  // Movable type
  if (/活字|排印|聚珍/.test(name)) return ["VER-MOVABLE"];

  // Rubbing
  if (/拓本|碑帖|碑本/.test(name)) return ["VER-RUBBING"];

  // Facsimile
  if (/影印|石印|影宋|影元|影明|影钞|影抄/.test(name)) return ["VER-FACSIMILE"];
  if (/^仿宋/.test(name)) return ["VER-FACSIMILE"];

  // Generic block print
  if (/[刻本刊本板本]$/.test(name)) return ["VER-BLOCK"];
  if (/[刻刊]$/.test(name) && name.length <= 3) return ["VER-BLOCK"];
  if (/^[新原旧]刻$/.test(name)) return ["VER-BLOCK"];

  // Qualifiers (generic version descriptions)
  if (/^(旧本|原本|新刻|足本|旧刻|原刻|初刻|重刻|翻刻)$/.test(name)) return ["VER-QUALIFIER"];
  if (/^[家汪孙祁胡张李刘陈徐黄赵吴朱杨王马]$/.test(name) && /[刻本]$/.test(name)) return ["VER-BLOCK"];
  if (/^[家汪孙祁胡张李刘陈徐黄赵吴朱杨王马].*[刻本]$/.test(name)) return ["VER-BLOCK"];

  // Catch-all: try to parse
  if (/[宋]$/.test(name) && /[本刻板]$/.test(name)) return ["VER-SONG"];
  if (/[元]$/.test(name) && /[本刻板刊]$/.test(name)) return ["VER-YUAN"];
  if (/[明]$/.test(name) && /[本刻板]$/.test(name)) return ["VER-MING"];
  if (/[清]$/.test(name) && /[本刻]$/.test(name)) return ["VER-QING"];
  if (/[刻刊]$/.test(name)) return ["VER-BLOCK"];
  if (/[抄钞]$/.test(name)) return ["VER-MANUSCRIPT"];
  if (/[注]$/.test(name) && name.endsWith("本")) return ["VER-QUALIFIER"];
  if (/本$/.test(name)) return ["VER-QUALIFIER"];

  return ["VER-QUALIFIER"];
}

// ═══════════════════════════════════════════
// TIM Classification
// ═══════════════════════════════════════════
function classifyTIM(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;

  // Historical periods
  if (/^(康熙|乾隆|光绪|同治|道光|咸丰|嘉庆|雍正|顺治|万历|嘉靖|永乐|洪武|宣统|民国|乾嘉|咸同|同光)/.test(name))
    return ["TIM-PERIOD"];
  if (/[朝代]$/.test(name) && name.length <= 3) return ["TIM-PERIOD"];
  if (/^(汉|唐|宋|元|明|清)/.test(name) && /[代季末初]$/.test(name)) return ["TIM-PERIOD"];

  // Duration/interval
  if (/^(间|之间|之际|以还|以来|之后|而后|至于今|至今)/.test(name)) return ["TIM-DURATION"];
  if (/^(从|自|由).*(至|到|迄)/.test(name)) return ["TIM-DURATION"];
  if (/^(数年|数月|数日|数载|累年|积年|历年|连年|近年|比年)/.test(name)) return ["TIM-DURATION"];
  if (/^[一二三四五六七八九十百千万]/.test(name) && /[年月日载岁春秋冬夏期]$/.test(name)) return ["TIM-DURATION"];
  if (/^(平生|终身|毕生|一世|有生|生平)/.test(name)) return ["TIM-DURATION"];
  if (/^(长|久|暂|永|俄|旋|转瞬|刹那|须臾)/.test(name) && name.length <= 3) return ["TIM-DURATION"];

  // Absolute dates
  if (/^[一二三四五六七八九十百千万]/.test(name) && /[年月日]$/.test(name)) return ["TIM-ABSOLUTE"];
  if (/^[0-9]/.test(name)) return ["TIM-ABSOLUTE"];
  if (/^(正月|二月|三月|四月|五月|六月|七月|八月|九月|十月|冬月|腊月)/.test(name)) return ["TIM-ABSOLUTE"];
  if (/^(春|夏|秋|冬)$/.test(name)) return ["TIM-ABSOLUTE"];
  if (/^(元日|元旦|除夕|除夜|岁除|岁暮|岁杪)/.test(name)) return ["TIM-ABSOLUTE"];
  if (/^(立春|雨水|惊蛰|春分|清明|谷雨|立夏|小满|芒种|夏至|小暑|大暑|立秋|处暑|白露|秋分|寒露|霜降|立冬|小雪|大雪|冬至|小寒|大寒)/.test(name))
    return ["TIM-ABSOLUTE"];
  if (/^(上巳|端午|七夕|中元|中秋|重阳|腊八|元宵|上元|中元|下元|花朝|寒食)/.test(name)) return ["TIM-ABSOLUTE"];

  // Relative time (the bulk of TIM entities)
  if (/^(今日|今朝|今年|今夜|今晚)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(去年|去岁|上年|昨年)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(昨日|昨|前夕|前夜)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(明日|明朝|明年|来年|翌年|他年|他日|异日|后日|后年)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(近日|近来|日来|比来|迩来|顷来)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(此时|此刻|现在|现今|当今|如今|于今|方今|目今|目下|眼前)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(当时|其时|彼时|那时|向时|昔时|畴昔)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(一时|不时|时时|时时|常|往往|每每|屡屡|频|迭)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(将来|日后|往后|此后|嗣后|尔后|今后|从此|自此|由是)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(今|昔|古|顷|时|近|暂|久|早|晚|暮|旦|晨|夙|夜)$/.test(name)) return ["TIM-RELATIVE"];
  if (/^(平日|素日|寻常|平时|日常)/.test(name)) return ["TIM-RELATIVE"];
  if (/^(曩|向|先是|先是|始|初|末|终|竟)/.test(name) && name.length <= 2) return ["TIM-RELATIVE"];
  if (/^(前|后|先)/.test(name) && /[者时日]$/.test(name)) return ["TIM-RELATIVE"];
  if (/^(不日|有顷|无何|有间|少间|移时|有顷)/.test(name)) return ["TIM-RELATIVE"];

  // Default to relative
  return ["TIM-RELATIVE"];
}

// ═══════════════════════════════════════════
// OFF Classification
// ═══════════════════════════════════════════
function classifyOFF(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;

  // Diplomatic / foreign
  if (/^(领事|副领事|星使|外交|公使|大使)/.test(name)) return ["OFF-DIPLOMATIC"];
  if (/^(日本邮便)/.test(name)) return ["OFF-DIPLOMATIC"];

  // Modern positions
  if (/^(大总统|总统|总理|议员|议绅|议长|局长|委员|科长|科员|部长|院长|军长|师长|教育长)$/.test(name))
    return ["OFF-MODERN"];
  if (/^(省议员|谘议局长|市政总理|督促委员|总文案|统制|督办)/.test(name)) return ["OFF-MODERN"];
  if (/^(劝业道|巡警道)/.test(name)) return ["OFF-MODERN"];

  // Academic
  if (/^(编修|庶吉士|学使|学政|学官|学台|学司|学丞|提学|提学使|祭酒|司业|直学士|学士|校官|讲学大夫|小学元士)$/.test(name))
    return ["OFF-ACADEMIC"];
  if (/^(教习|教谕|教授|训导|山长)/.test(name)) return ["OFF-ACADEMIC"];

  // Military
  if (/^(将军|都督|督军|统制|军长|校官|武职|都统|提督|总兵|参将)$/.test(name))
    return ["OFF-MILITARY"];

  // Central officials
  if (/^(中堂|尚书|相|相国|丞相|宰辅|宰相|司徒|司空|司寇|司农|司马|太师|太傅|太保|少保)$/.test(name))
    return ["OFF-CENTRAL"];
  if (/^(侍郎|太史|太史令|史臣|黄门侍郎|大理卿|部郎|郎部|郎中|京堂|宫保|宫詹|阁学|内阁中书|中书|中车府令)$/.test(name))
    return ["OFF-CENTRAL"];
  if (/^(都御史|副都御史|佥都御史|御史|给事中|谏议大夫|侍中|常侍)$/.test(name))
    return ["OFF-CENTRAL"];
  if (/^(部院大臣|大臣|大司空|大司成|五品卿衔)$/.test(name))
    return ["OFF-CENTRAL"];
  if (/^(奉常|少府|大司农|治粟内史|将作大匠|宗正|廷尉|卫尉|太仆|典客|典属国|主爵都尉)$/.test(name))
    return ["OFF-CENTRAL"];

  // Local officials
  if (/^(省长|督|督宪|总督|制军|巡抚|抚|藩台|臬台|方伯|道员|观察|太守|知府|知县|知事|县事|刺史|县令|令尹|关道|盐运使|盐差|粮道|河道)$/.test(name))
    return ["OFF-LOCAL"];
  if (/^(中丞|廉访|布政使|按察使|监司|郡守|牧伯|州牧)$/.test(name))
    return ["OFF-LOCAL"];

  // Check for central patterns
  if (/^(中|内|殿|阁|堂|部|院)$/.test(name) && name.length <= 3) return ["OFF-CENTRAL"];

  // Default
  return ["OFF-CENTRAL"];
}

// ═══════════════════════════════════════════
// ORG Classification
// ═══════════════════════════════════════════
function classifyORG(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;

  // Company / Bank
  if (/公司|银行/.test(name)) return ["ORG-COMPANY"];

  // Publishing
  if (/书[局馆店坊肆]/.test(name)) return ["ORG-PUBLISH"];
  if (/印书|印行|刊行|刻书|藏板|藏版/.test(name)) return ["ORG-PUBLISH"];
  if (/^(商务|中华|世界|大东|开明|文明|扫叶山房|文瑞楼|锦章|千顷堂|来青阁|中国书店|修绠堂)/.test(name))
    return ["ORG-PUBLISH"];

  // Library / Book collection
  if (/图书馆|藏书[楼阁堂室处]/.test(name)) return ["ORG-LIBRARY"];
  if (/(楼|阁|堂|室)$/.test(name) && /[藏书古籍]/.test(name)) return ["ORG-LIBRARY"];
  if (/^(涵芬|汲古|士礼|皕宋|平津|铁琴铜剑|八千卷|海源|艺风|丽宋|嘉业)/.test(name))
    return ["ORG-LIBRARY"];
  if (/^(江南|南京|京师|北京|浙江|湖南|湖北)/.test(name) && /图书馆/.test(name))
    return ["ORG-LIBRARY"];

  // Education
  if (/学堂|学校|书院|学[宫塾舍]/.test(name)) return ["ORG-EDUCATION"];
  if (/^(时务|南菁|格致|求是|广雅|两湖|自强|南洋公学|京师大学|通艺|校经)/.test(name))
    return ["ORG-EDUCATION"];

  // Political
  if (/[党]$/.test(name)) return ["ORG-POLITICAL"];
  if (/[派系]$/.test(name)) return ["ORG-POLITICAL"];
  if (/^(民党|国民党|共和党|进步党|北洋|安福|康党|革党|同盟会|兴中会|光复会)/.test(name))
    return ["ORG-POLITICAL"];

  // Government
  if (/[部院厅司署局处所]$/.test(name) && name.length >= 3) return ["ORG-GOVERNMENT"];
  if (/^(警厅|军事厅|外交司|邮传部|财政部|国务院|军政府|筹饷局|省议会|北京政府|北政府|湘政府|翰林院|清史馆)/.test(name))
    return ["ORG-GOVERNMENT"];

  // Studio / hall name
  if (/(楼|阁|堂|斋|室|轩|庵|馆)$/.test(name) && name.length <= 5) return ["ORG-STUDIO"];
  if (/^(勤有|世彩|面宋|艺芸|诵芬|知不足|拜经|爱日|守山|别下|琳琅)/.test(name))
    return ["ORG-STUDIO"];

  // Default
  return ["ORG-GOVERNMENT"];
}

// ═══════════════════════════════════════════
// KIN Classification
// ═══════════════════════════════════════════
function classifyKIN(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;

  // Collective
  if (/^(一家|一族|本家|敝族|寒家|寒族|吾家|同族|同族人|远支|浙族|世家|一支|一族|之后)$/.test(name))
    return ["KIN-COLLECTIVE"];
  if (/^(诸从子|诸公子|诸子侄|诸祖|族先辈|族兄弟|子姪辈|子侄|舍姪辈|儿辈|从子辈)$/.test(name))
    return ["KIN-COLLECTIVE"];

  // Affinal
  if (/^(夫人|妇|妻|妾|室家|内人|嫂夫人|兄妇|偶|孀妇)$/.test(name))
    return ["KIN-AFFINAL"];
  if (/^(内弟|妻弟|妻妹|外舅|舅|舅氏|姨姪|甥)$/.test(name))
    return ["KIN-AFFINAL"];
  if (/^(姻亲|姻戚|姻长亲|至戚|亲|戚|近亲|亲戚)$/.test(name))
    return ["KIN-AFFINAL"];
  if (/^(夫妇|婚姻)/.test(name)) return ["KIN-AFFINAL"];

  // Ancestor
  if (/^(先|祖|宗)/.test(name) && /[德君世公祖人辈慈]/.test(name)) return ["KIN-ANCESTOR"];
  if (/^(先祖|先人|先君|先德|先公|先世|先慈|先父|先弟|先二十五|三代祖|六世祖|七世祖|八世从孙|诸祖|祖辈|祖先辈|族祖辈|四祖辈|三祖|二祖|尊公|尊人|先祖辈|祖姑)$/.test(name))
    return ["KIN-ANCESTOR"];
  if (/^(先代|上世|先世|先辈|先正|先哲)/.test(name)) return ["KIN-ANCESTOR"];

  // Descendant
  if (/^(子|子孙|儿子|子息|子姪|子侄|儿辈|儿女|子女|男|女)$/.test(name) && name.length <= 3) {
    if (!/^(子|子孙|儿子)/.test(name)) return ["KIN-PATERNAL"];
    return ["KIN-DESCENDANT"];
  }
  if (/^(八子|二子|五子|大儿|生儿|嗣|嗣君|嗣贤|继子|孙子|姪孙|从子|舍姪|孤|孤儿)$/.test(name))
    return ["KIN-DESCENDANT"];
  if (/^(子孙|子姪辈|儿辈|从子辈|姪|诸从子|舍姪辈)$/.test(name))
    return ["KIN-DESCENDANT"];
  if (/^(后嗣|后裔|裔|曾孙|玄孙|来孙|晜孙|仍孙|云孙|耳孙)$/.test(name))
    return ["KIN-DESCENDANT"];

  // Paternal (default)
  if (/^(父|父子|兄弟|弟|兄|从弟|从兄|舍弟|胞兄|大兄|昆仲|叔姪|伯|叔|姑|姨)$/.test(name))
    return ["KIN-PATERNAL"];
  if (/^(族人|宗人|同族|同族人|近房|隔房|远支|浙族|嫡支|嫡派|第三房|二房|四房)/.test(name))
    return ["KIN-PATERNAL"];
  if (/^(家母|家慈|母|母亲|老母|家大人|伯太夫人|堂上|令兄|令弟|令子|公)$/.test(name))
    return ["KIN-PATERNAL"];
  if (/^(父兄|子弟|族兄弟|族人)/.test(name)) return ["KIN-PATERNAL"];
  if (/^(舍弟|两舍弟|三舍弟|四舍弟|舍妹|舍姪)$/.test(name)) return ["KIN-PATERNAL"];
  if (/^(乔梓|父兄|子弟|兄弟|从兄弟|族兄弟|本家|寒家)/.test(name))
    return ["KIN-PATERNAL"];

  // Default
  return ["KIN-PATERNAL"];
}

// ═══════════════════════════════════════════
// AST Classification
// ═══════════════════════════════════════════
function classifyAST(entry: EntityCatalogEntry): string[] {
  const name = entry.canonical;

  // Yijing / divination
  if (/^(易学|八卦|卦气|爻辰|卦变|爻变|卦象|爻象|卦辞|爻辞|先天|后天|河图|洛书|太极|两仪|四象)$/.test(name))
    return ["AST-YIXUE"];
  if (/^(卜筮|占卜|占筮|占验|龟蓍|筮|龟|蓍|符命|谶纬)$/.test(name))
    return ["AST-DIVINATION"];

  // Divination / Fengshui
  if (/^(风水|堪舆|相地|相宅|相墓|形法|地理|龙脉|穴位|明堂)$/.test(name))
    return ["AST-DIVINATION"];
  if (/^(九宫|六壬|奇门|遁甲|太乙|紫微|六爻|金钱卦|梅花易数|铁板神数|皇极经世)$/.test(name))
    return ["AST-DIVINATION"];
  if (/^(杂占|诸占|百占|杂占)$/.test(name)) return ["AST-DIVINATION"];

  // Xingxiu / stars
  if (/^(星命|星宿|星次|星官|星野|星野内盘|星宫|星气|星历|星盘|星纪)$/.test(name))
    return ["AST-XINGSU"];
  if (/^(列宿|二十八宿|十二次|十二宫|七政|分野|摩羯|磨蝎|人马|宝瓶|天蝎|双鱼|狮子|巨蟹|天秤|金牛|白羊|双子|室女|射手)$/.test(name))
    return ["AST-XINGSU"];
  if (/^(鹑火|鹑尾|鹑首|寿星|大火|析木|星纪|玄枵|娵訾|诹訾|降娄|大梁|实沈|析木)$/.test(name))
    return ["AST-XINGSU"];
  if (/^(三十六禽|十二禽|属禽|禽星|演禽)$/.test(name))
    return ["AST-XINGSU"];

  // Mingli / Bazi
  if (/^(命理|命造|命宫|命学|贵造|八字|四柱|推命|算命|行运|流年|行年|大运|小运|旺运|衰运|劫运|杀运|财官)$/.test(name))
    return ["AST-MINGLI"];
  if (/^(禄命|纳音|身旺|身弱|用神|忌神|官杀|官鬼|印绶|妻财|子孙|兄弟|父母)$/.test(name) && name.length <= 3)
    return ["AST-MINGLI"];
  if (/^(本命|元辰|日主|日元|命主|身主|胎元|命宫|身宫)$/.test(name))
    return ["AST-MINGLI"];
  if (/^(子平|滴天髓|三命通会|渊海子平|穷通宝鉴|千里命稿|兰台妙选|玉照定真经|李虚中命书)$/.test(name))
    return ["AST-MINGLI"];
  if (/^(比肩|劫财|枭神|伤官|食神|正印|偏印|正官|偏官|七杀|正财|偏财)$/.test(name))
    return ["AST-MINGLI"];

  // Wuxing / Ganzhi
  if (/^(五行|干支|天干|地支|纳甲|六十花甲|六十甲子|花甲)$/.test(name))
    return ["AST-WUXING"];
  if (/^(甲乙|丙丁|戊己|庚辛|壬癸|甲木|乙木|丙火|丁火|戊土|己土|庚金|辛金|壬水|癸水)$/.test(name))
    return ["AST-WUXING"];
  if (/^(阴阳|五行生克|天干之合|地支之冲|地支之合|三合|六合|三刑|刑害|冲合)$/.test(name))
    return ["AST-WUXING"];
  if (/^(海中金|剑锋金|大林木|路傍土|天河水)$/.test(name))
    return ["AST-WUXING"];
  if (/^(阴阳消长|制日|伐日|专日|义日|宝日)$/.test(name))
    return ["AST-WUXING"];

  // Check for specific ganzhi patterns
  if (/^[甲乙丙丁戊己庚辛壬癸]/.test(name) && /[木火土金水]$/.test(name)) return ["AST-WUXING"];
  if (/^([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])$/.test(name)) return ["AST-WUXING"];

  // Other mingli patterns
  if (/(财|官|印|杀|比|劫|食|伤)$/.test(name) && name.length <= 3) return ["AST-MINGLI"];
  if (/(运|格|局)$/.test(name) && name.length <= 4) return ["AST-MINGLI"];

  // Default
  return ["AST-WUXING"];
}

// ═══════════════════════════════════════════
// Main classification loop
// ═══════════════════════════════════════════
const classifiers: Record<string, (e: EntityCatalogEntry) => string[]> = {
  PER: classifyPER,
  LOC: undefined!, // LOC already has subtypes
  BOK: classifyBOK,
  VER: classifyVER,
  TIM: classifyTIM,
  OFF: classifyOFF,
  ORG: classifyORG,
  KIN: classifyKIN,
  AST: classifyAST,
};

let changed = 0;
const report: Record<string, Record<string, number>> = {};

for (const entry of dataset.entityCatalog) {
  const classifier = classifiers[entry.type];
  if (!classifier) continue; // LOC already classified, skip

  const subtypes = classifier(entry);
  if (subtypes.length > 0) {
    const old = JSON.stringify(entry.subtypes);
    entry.subtypes = subtypes;
    if (old !== JSON.stringify(subtypes)) changed++;

    // Track stats
    if (!report[entry.type]) report[entry.type] = {};
    for (const s of subtypes) {
      report[entry.type][s] = (report[entry.type][s] ?? 0) + 1;
    }
  }
}

// Write back
writeFileSync(dataPath, JSON.stringify(dataset, null, 2), "utf-8");

// Report
console.log(`Updated ${changed} entities with subtype classifications.\n`);
for (const [type, counts] of Object.entries(report).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${type} (${Object.values(counts).reduce((a, b) => a + b, 0)} entities):`);
  for (const [sub, count] of Object.entries(counts).sort(([a], [b]) => b - a)) {
    console.log(`  ${sub}: ${count}`);
  }
  console.log();
}
