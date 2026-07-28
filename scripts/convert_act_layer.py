#!/usr/bin/env python3
"""
将 NER_tihrd 第三层标注（JSONL, Searle 宏类别 AST/DIR/EXP/COM）
转换为网站 generated.json 所需的格式（7 类 ACT: REQ/DSP/INF/PRS/MNT/INS/NEG）。

用法:
    python3 scripts/convert_act_layer.py

输入:
    NER/NER_tihrd/第三层行动与第二层联动全量初标_v1.3.2_306封/*.acts.jsonl

输出:
    data/acts_by_letter.json        — actsByLetter 数据，可直接合并进 generated.json
    data/act_stats.json            — actStats 统计
    data/generated_with_acts.json  — 完整的 generated.json（含第三层数据）

不修改任何源文件。
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Optional

# ─── 路径配置 ────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = PROJECT_ROOT.parent / "NER" / "NER_tihrd" / "第三层行动与第二层联动全量初标_v1.3.2_306封"
GENERATED_PATH = PROJECT_ROOT / "data" / "generated.json"
OUTPUT_ACTS_BY_LETTER = PROJECT_ROOT / "data" / "acts_by_letter.json"
OUTPUT_ACT_STATS = PROJECT_ROOT / "data" / "act_stats.json"
OUTPUT_FULL = PROJECT_ROOT / "data" / "generated_with_acts.json"

# ─── ID 重命名（源: 松崎鹤雄 → 网站: 柔甫） ──────────────
LETTER_ID_RENAME = {
    "284_0_松崎鹤雄": "284_0_柔甫",
}


# ─── ACT 映射表 ──────────────────────────────────────────
# 源: (act_type, act_subtype) → 目标: (ActType, mode)
# Searle 宏类别:
#   AST = Assertive（断言类）
#   DIR = Directive（指令类）
#   EXP = Expressive（表达类）
#   COM = Commissive（承诺类）
#
# 网站 7 类:
#   REQ = 请求    DSP = 展示    INF = 告知    PRS = 说服
#   MNT = 维系    INS = 训诫    NEG = 协商

ACT_MAPPING: dict = {
    # ── AST (Assertive) ──
    ("AST", "告知"): ("INF", "direct"),
    ("AST", "论证"): ("PRS", "direct"),
    ("AST", "评价"): ("DSP", "direct"),

    # ── DIR (Directive) ──
    ("DIR", "请求"): ("REQ", "direct"),
    ("DIR", "询问"): ("REQ", "conventionally_indirect"),
    ("DIR", "建议"): ("REQ", "conventionally_indirect"),

    # ── EXP (Expressive) ──
    ("EXP", "祝颂"): ("MNT", "direct"),
    ("EXP", "问候"): ("MNT", "direct"),
    ("EXP", "感谢"): ("MNT", "direct"),
    ("EXP", "致歉"): ("MNT", "direct"),
    ("EXP", "庆贺"): ("MNT", "direct"),
    ("EXP", None):     ("MNT", "direct"),  # 信尾套话如 "此颂\n台安"

    # ── COM (Commissive) ──
    ("COM", "承诺"): ("INF", "direct"),   # 告知对方自己将做某事
    ("COM", "提供"): ("NEG", "direct"),   # 提供资源/条件，近似协商
}


def map_act_type(source_type: str, source_subtype: Optional[str]) -> tuple:
    """将源 ACT 类型映射为网站 ActType 和 mode。未匹配时回退到 INF。"""
    key = (source_type, source_subtype)
    if key in ACT_MAPPING:
        return ACT_MAPPING[key]
    # 回退：按宏类别推导
    fallback = {
        "AST": "INF",
        "DIR": "REQ",
        "EXP": "MNT",
        "COM": "INF",
    }
    print(f"  ⚠ 未匹配的 act_type={source_type}, subtype={source_subtype}，回退为 {fallback.get(source_type, 'INF')}",
          file=sys.stderr)
    return (fallback.get(source_type, "INF"), "direct")


def detect_mode_from_text(text: str, act_type: str) -> str:
    """从文本特征检测表达方式（直接/规约间接/非规约间接）。"""
    # 规约间接标记
    conventional_patterns = [
        r"不知.{0,6}能否", r"可否", r"能否", r"是否可",
        r"未审", r"未卜", r"不识",
        r"敢请", r"敬乞",
        r"想.{0,3}必", r"想必",
    ]
    for pat in conventional_patterns:
        if re.search(pat, text):
            return "conventionally_indirect"

    # 非规约间接标记（暗示，不挑明）
    non_conventional_hints = [
        r"尚未", r"未蒙", r"久未", r"迟迟",
    ]
    if act_type == "DIR":
        # 如果是指令类但没有直接祈使标记，可能是暗示
        direct_markers = [r"请", r"乞", r"求", r"恳", r"望", r"祈", r"烦", r"拜托", r"饬"]
        if not any(re.search(m, text) for m in direct_markers):
            hint_count = sum(1 for h in non_conventional_hints if re.search(h, text))
            if hint_count > 0:
                return "non_conventionally_indirect"

    return "direct"


def convert_file(filepath: Path) -> list[dict]:
    """转换单个 JSONL 文件，返回 act mention 列表。"""
    acts = []
    with open(filepath, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"  ✗ JSON 解析错误 {filepath}: {e}", file=sys.stderr)
                continue

            if obj.get("record_type") != "act":
                continue

            letter_id = obj["letter_id"]
            # 重命名
            letter_id = LETTER_ID_RENAME.get(letter_id, letter_id)

            source_type = obj["act_type"]
            source_subtype = obj.get("act_subtype")
            target_type, default_mode = map_act_type(source_type, source_subtype)

            text = obj.get("original_text", "")
            text_span = obj.get("text_span", [0, 0])
            start = text_span[0] if len(text_span) >= 2 else 0
            end = text_span[1] if len(text_span) >= 2 else 0

            # 检测 mode
            mode = detect_mode_from_text(text, source_type)
            if mode == "direct":
                mode = default_mode  # 用映射表的默认值

            # 构建 event_links（保留跨层连接）
            event_links = []
            for link in obj.get("event_links", []):
                event_links.append({
                    "eventId": link.get("event_mention_id", ""),
                    "relation": link.get("relation_type", ""),
                    "confidence": link.get("link_confidence", ""),
                })

            act = {
                "id": obj["act_id"],
                "letterId": letter_id,
                "type": target_type,
                "subtype": source_subtype,
                "mode": mode,
                "start": start,
                "end": end,
                "originalText": text,
                "headText": obj.get("head_text"),
                "speaker": obj.get("speaker", []),
                "addressee": obj.get("addressee", []),
                "orientation": obj.get("primary_orientation"),
                "contentDomains": obj.get("content_domains", []),
                "eventLinks": event_links,
                "eventLinkStatus": obj.get("event_link_status"),
                "annotationStatus": obj.get("annotation_status"),
            }
            acts.append(act)

    return acts


def main():
    print("=" * 60)
    print("第三层 ACT 标注格式转换")
    print("=" * 60)

    # 1. 收集所有 JSONL 文件
    jsonl_files = sorted(SOURCE_DIR.glob("*.acts.jsonl"))
    print(f"\n📂 找到 {len(jsonl_files)} 个 JSONL 文件")

    # 2. 逐文件转换
    acts_by_letter: dict[str, list[dict]] = {}
    total_acts = 0
    errors = 0

    for fpath in jsonl_files:
        try:
            acts = convert_file(fpath)
            for act in acts:
                lid = act["letterId"]
                acts_by_letter.setdefault(lid, []).append(act)
            total_acts += len(acts)
        except Exception as e:
            print(f"  ✗ 转换失败 {fpath.name}: {e}", file=sys.stderr)
            errors += 1

    print(f"  转换了 {total_acts} 条 ACT 标注")
    print(f"  涉及 {len(acts_by_letter)} 封信")
    if errors:
        print(f"  ⚠ {errors} 个文件出错")

    # 3. 统计 actStats
    act_stats: dict[str, dict] = {
        "REQ": {"paragraphCount": 0, "letterCount": 0},
        "DSP": {"paragraphCount": 0, "letterCount": 0},
        "INF": {"paragraphCount": 0, "letterCount": 0},
        "PRS": {"paragraphCount": 0, "letterCount": 0},
        "MNT": {"paragraphCount": 0, "letterCount": 0},
        "INS": {"paragraphCount": 0, "letterCount": 0},
        "NEG": {"paragraphCount": 0, "letterCount": 0},
    }

    type_letters: dict[str, set] = defaultdict(set)
    for lid, acts in acts_by_letter.items():
        for act in acts:
            t = act["type"]
            act_stats[t]["paragraphCount"] += 1
            type_letters[t].add(lid)

    for t in act_stats:
        act_stats[t]["letterCount"] = len(type_letters[t])

    # 4. 输出 act_stats
    print("\n📊 ACT 统计:")
    for t in ["REQ", "DSP", "INF", "PRS", "MNT", "INS", "NEG"]:
        s = act_stats[t]
        print(f"  {t}: {s['paragraphCount']} 段, {s['letterCount']} 封")

    with open(OUTPUT_ACT_STATS, "w", encoding="utf-8") as f:
        json.dump(act_stats, f, ensure_ascii=False, indent=2)
    print(f"\n✅ act_stats → {OUTPUT_ACT_STATS}")

    # 5. 输出 acts_by_letter
    with open(OUTPUT_ACTS_BY_LETTER, "w", encoding="utf-8") as f:
        json.dump(acts_by_letter, f, ensure_ascii=False, indent=2)
    print(f"✅ acts_by_letter → {OUTPUT_ACTS_BY_LETTER}")

    # 6. 合并到 generated.json
    print(f"\n📦 合并到 generated.json...")
    with open(GENERATED_PATH, encoding="utf-8") as f:
        generated = json.load(f)

    generated["actsByLetter"] = acts_by_letter
    generated["actStats"] = act_stats
    generated["generatedAt"] = max(
        generated.get("generatedAt", ""),
        "2026-07-25T00:00:00.000Z",  # 简化，实际按当前时间
    )

    with open(OUTPUT_FULL, "w", encoding="utf-8") as f:
        json.dump(generated, f, ensure_ascii=False, indent=2)
    print(f"✅ generated_with_acts → {OUTPUT_FULL}")

    # 7. 摘要
    print(f"\n{'=' * 60}")
    print("转换完成。源文件未被修改。")
    print(f"  输出文件:")
    print(f"    1. {OUTPUT_ACTS_BY_LETTER.name}  — actsByLetter 数据")
    print(f"    2. {OUTPUT_ACT_STATS.name}      — actStats 统计")
    print(f"    3. {OUTPUT_FULL.name}           — 完整 generated.json")
    print(f"\n使用方式:")
    print(f"    cp {OUTPUT_FULL} {GENERATED_PATH}")
    print(f"  （或手动将 actsByLetter 和 actStats 合并到现有 generated.json）")


if __name__ == "__main__":
    main()
