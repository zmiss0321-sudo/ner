import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(projectRoot, "..");
const lettersRoot = path.join(sourceRoot, "all_letters");
const personRoot = path.join(
  sourceRoot,
  "NER/NER_first/PER/person_ner_all306_v15_fresh_20260712",
);
const placeRoot = path.join(sourceRoot, "NER/NER_first/LOC/letters 地名");
const eventRoot = path.join(sourceRoot, "NER/NER_second/evt8 2");
const structuredLettersPath = path.join(sourceRoot, "ye_project/data/letters.json");
const theoryPath = path.join(
  sourceRoot,
  "yedehui_theory/yedehui_副本/理论/叶德辉书信交际意图标注_理论与方法.md",
);
const outputPath = path.join(projectRoot, "data/generated.json");
const projectContentPath = path.join(projectRoot, "data/project-content.json");
const standardEntityRoots = {
  OFF: path.join(sourceRoot, "NER/NER_first/OFF"),
  AST: path.join(sourceRoot, "NER/NER_first/AST"),
  TIM: path.join(sourceRoot, "NER/NER_first/TIM"),
  KIN: path.join(sourceRoot, "NER/NER_first/KIN"),
  BOK: path.join(sourceRoot, "NER/NER_first/BOK"),
  VER: path.join(sourceRoot, "NER/NER_first/VER"),
  ORG: path.join(sourceRoot, "NER/NER_first/ORG"),
};

const readText = (filePath) => fs.readFileSync(filePath, "utf8").trim();
const letterFiles = fs
  .readdirSync(lettersRoot)
  .filter((name) => name.endsWith(".txt"))
  .sort();

const parseFilename = (filename) => {
  const id = filename.replace(/\.txt$/, "");
  const [number, year, ...recipientParts] = id.split("_");
  return {
    id,
    number,
    year: year === "0" || year === "未知" ? null : year,
    recipient: recipientParts.join("_"),
  };
};

const extractGanzhiDate = (text) => {
  const matches = [
    ...text.matchAll(
      /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][^。]{0,20}(?:日|月))/g,
    ),
  ];
  return matches.at(-1)?.[1] ?? null;
};

const structuredLetters = fs.existsSync(structuredLettersPath)
  ? JSON.parse(fs.readFileSync(structuredLettersPath, "utf8"))
  : [];
const structuredLetterByNumber = new Map(
  structuredLetters.map((letter) => [String(letter.id).padStart(3, "0"), letter]),
);

const letters = letterFiles.map((filename) => {
  const metadata = parseFilename(filename);
  const text = readText(path.join(lettersRoot, filename));
  const structured = structuredLetterByNumber.get(metadata.number);
  return {
    ...metadata,
    recipient: structured?.recipient || metadata.recipient,
    text,
    dateLabel: structured?.date || null,
    ganzhiDate: extractGanzhiDate(text),
    source: structured?.source || structured?.sourse || structured?.sourece || null,
    summary: structured?.notes || null,
  };
});

const letterById = new Map(letters.map((letter) => [letter.id, letter]));
const entitiesByLetter = Object.fromEntries(letters.map((letter) => [letter.id, []]));

const locateMentions = (letterId, mentions) => {
  const raw = letterById.get(letterId)?.text ?? "";
  let cursor = 0;
  return mentions.map((mention) => {
    let start = raw.indexOf(mention.surface, cursor);
    if (start < 0) start = raw.indexOf(mention.surface);
    const end = start < 0 ? -1 : start + mention.surface.length;
    if (end >= 0) cursor = end;
    return { ...mention, start, end };
  });
};

for (const filename of fs.readdirSync(personRoot).filter((name) => name.endsWith(".tagged.md"))) {
  const letterId = filename.replace(/\.tagged\.md$/, "");
  if (!letterById.has(letterId)) continue;
  const tagged = readText(path.join(personRoot, filename));
  const mentions = [...tagged.matchAll(/【([^｜】]+)｜PER(?:｜([^】]+))?】/g)].map((match) => ({
    type: "PER",
    surface: match[1],
    canonical: match[2] || match[1],
    subtype: null,
  }));
  entitiesByLetter[letterId].push(...locateMentions(letterId, mentions));
}

for (const filename of fs.readdirSync(placeRoot).filter((name) => name.endsWith(".txt"))) {
  const letterId = filename.replace(/\.txt$/, "");
  if (!letterById.has(letterId)) continue;
  const tagged = readText(path.join(placeRoot, filename));
  const mentions = [...tagged.matchAll(/〖=([^|〗]+)\|([^|〗]+)\|([^〗]+)〗/g)].map((match) => ({
    type: "LOC",
    surface: match[1],
    canonical: match[2],
    subtype: match[3],
  }));
  entitiesByLetter[letterId].push(...locateMentions(letterId, mentions));
}

for (const [type, root] of Object.entries(standardEntityRoots)) {
  for (const filename of fs.readdirSync(root).filter((name) => name.endsWith(".txt"))) {
    const letterId = filename.replace(/\.txt$/, "");
    if (!letterById.has(letterId)) continue;
    const tagged = readText(path.join(root, filename));
    const expression = new RegExp(`【([^｜】]+)｜${type}(?:｜([^】]+))?】`, "g");
    const mentions = [...tagged.matchAll(expression)].map((match) => ({
      type,
      surface: match[1],
      canonical: match[2] || match[1],
      subtype: null,
    }));
    entitiesByLetter[letterId].push(...locateMentions(letterId, mentions));
  }
}

for (const mentions of Object.values(entitiesByLetter)) {
  mentions.sort((a, b) => a.start - b.start || b.end - a.end);
}

const eventFiles = [];
for (const batch of fs.readdirSync(eventRoot)) {
  const batchPath = path.join(eventRoot, batch);
  if (!fs.statSync(batchPath).isDirectory()) continue;
  for (const filename of fs.readdirSync(batchPath)) {
    if (filename.endsWith(".events.jsonl")) eventFiles.push(path.join(batchPath, filename));
  }
}
eventFiles.sort();

const eventsByLetter = Object.fromEntries(letters.map((letter) => [letter.id, []]));
for (const filePath of eventFiles) {
  const letterId = path.basename(filePath).replace(/\.events\.jsonl$/, "");
  if (!letterById.has(letterId)) continue;
  const raw = letterById.get(letterId).text;
  let cursor = 0;
  for (const line of readText(filePath).split("\n").filter(Boolean)) {
    const event = JSON.parse(line);
    const originalText = event.original_text ?? "";
    let start = raw.indexOf(originalText, cursor);
    if (start < 0) start = raw.indexOf(originalText);
    const end = start < 0 ? -1 : start + originalText.length;
    if (end >= 0) cursor = end;
    eventsByLetter[letterId].push({
      id: event.event_mention_id ?? `${letterId}-${eventsByLetter[letterId].length + 1}`,
      type: event.event_type,
      subtype: event.event_subtype ?? null,
      stage: event.event_stage ?? null,
      modes: event.event_mode ?? [],
      originalText,
      paraphrase: event.paraphrase ?? null,
      participants: event.agent ?? [],
      objects: event.object ?? [],
      locations: event.location ?? [],
      timeText: event.time_text ?? null,
      start,
      end,
    });
  }
}

const entityCatalogMap = new Map();
for (const [letterId, mentions] of Object.entries(entitiesByLetter)) {
  for (const mention of mentions) {
    const key = `${mention.type}:${mention.canonical}`;
    const current = entityCatalogMap.get(key) ?? {
      type: mention.type,
      canonical: mention.canonical,
      aliases: new Set(),
      subtypes: new Set(),
      count: 0,
      letterIds: new Set(),
    };
    if (mention.surface !== mention.canonical) current.aliases.add(mention.surface);
    if (mention.subtype) current.subtypes.add(mention.subtype);
    current.count += 1;
    current.letterIds.add(letterId);
    entityCatalogMap.set(key, current);
  }
}

const entityCatalog = [...entityCatalogMap.values()]
  .map((entry) => ({
    ...entry,
    aliases: [...entry.aliases].sort(),
    subtypes: [...entry.subtypes].sort(),
    letterIds: [...entry.letterIds].sort(),
  }))
  .sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical, "zh-CN"));

const entityTypes = ["PER", "LOC", "BOK", "VER", "TIM", "OFF", "ORG", "KIN", "AST"];
const entityStats = Object.fromEntries(
  entityTypes.map((type) => {
    const entries = entityCatalog.filter((entry) => entry.type === type);
    return [
      type,
      {
        canonicalCount: entries.length,
        mentionCount: entries.reduce((sum, entry) => sum + entry.count, 0),
        letterCount: new Set(entries.flatMap((entry) => entry.letterIds)).size,
      },
    ];
  }),
);

const eventTypes = ["BIB", "ACA", "SOC", "POL", "FAM"];
const eventStats = Object.fromEntries(
  eventTypes.map((type) => {
    const matching = Object.entries(eventsByLetter).flatMap(([letterId, events]) =>
      events.filter((event) => event.type === type).map((event) => ({ letterId, event })),
    );
    return [type, { eventCount: matching.length, letterCount: new Set(matching.map((item) => item.letterId)).size }];
  }),
);

const output = {
  generatedAt: new Date().toISOString(),
  letters,
  entitiesByLetter,
  eventsByLetter,
  entityCatalog,
  entityStats,
  eventStats,
  actStats: Object.fromEntries(
    ["REQ", "DSP", "INF", "PRS", "MNT", "INS", "NEG"].map((code) => [
      code,
      { paragraphCount: 0, letterCount: 0 },
    ]),
  ),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);

const extractBetween = (text, start, end) => {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) return "";
  const contentStart = startIndex + start.length;
  const endIndex = end ? text.indexOf(end, contentStart) : text.length;
  return text.slice(contentStart, endIndex < 0 ? text.length : endIndex);
};

const cleanMarkdown = (text) => text
  .replace(/^```[^\n]*\n?/gm, "")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^>\s?/gm, "")
  .replace(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/gm, "")
  .replace(/^\|(.+)\|\s*$/gm, (_, cells) => cells.split("|").map((cell) => cell.trim()).join(" ｜ "))
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/^---+\s*$/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

if (fs.existsSync(theoryPath)) {
  const theory = fs.readFileSync(theoryPath, "utf8");
  const projectContent = {
    introduction: cleanMarkdown(extractBetween(theory, "## 一、我们在做什么", "## 二、理论框架")),
    background: cleanMarkdown(extractBetween(theory, "### 2.1 为什么这个项目在理论上是成立的", "### 2.2 理论来源与分工")),
    sources: cleanMarkdown(extractBetween(theory, "### 2.2 理论来源与分工", "### 2.3 理论架构图")),
    entityStandards: cleanMarkdown(extractBetween(theory, "### 3.1 第一层：实体层（NER）", "### 3.2 第二层：事件层（EVT）")),
    annotationLayers: cleanMarkdown(extractBetween(theory, "### 3.2 第二层：事件层（EVT）", "## 五、标注流程")),
    usage: cleanMarkdown(extractBetween(theory, "## 五、标注流程", "## 六、研究产出")),
  };
  fs.writeFileSync(projectContentPath, `${JSON.stringify(projectContent, null, 2)}\n`);
}
console.log(`Generated ${outputPath}`);
console.log(`Generated ${projectContentPath}`);
console.log(
  JSON.stringify(
    {
      letters: letters.length,
      entityStats,
      eventStats,
      unresolvedEntitySpans: Object.values(entitiesByLetter).flat().filter((item) => item.start < 0).length,
      unresolvedEventSpans: Object.values(eventsByLetter).flat().filter((item) => item.start < 0).length,
    },
    null,
    2,
  ),
);
