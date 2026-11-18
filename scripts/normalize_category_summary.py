#!/usr/bin/env python3
"""Normalize private, already-aggregated NDB category CSV; never publish its output."""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

CATEGORIES = ("ALL", "A_基本診療料", "B_医学管理等", "C_在宅医療", "D_検査", "E_画像診断", "F_投薬", "G_注射", "H_リハビリテーション", "I_精神科専門療法料", "J_処置", "K_手術", "K_輸血料", "L_麻酔", "M_放射線治療", "N_病理診断", "O_その他")
FIELDS = ("固定点数の参考換算額（円）", "公開数値セル数", "秘匿セル数", "点数なしセル数", "欠測セル数")
AKITA = {
    "0501": ("大館・鹿角", "0501", "県北"), "0502": ("北秋田", "0501", "県北"), "0503": ("能代・山本", "0501", "県北"),
    "0504": ("秋田周辺", "0502", "県央"), "0505": ("由利本荘・にかほ", "0502", "県央"),
    "0506": ("大仙・仙北", "0503", "県南"), "0507": ("横手", "0503", "県南"), "0508": ("湯沢・雄勝", "0503", "県南"),
}

def normalize(source):
    out = {"fiscalYear": 2024, "categories": CATEGORIES, "scopes": {s: {g: {} for g in ("pref", "secondary")} for s in ("include", "exclude")}}
    seen = set()
    original_area_codes = set()
    original_totals = defaultdict(int)
    with source.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            grain, scope, code, name, category = (row[k] for k in ("地域粒度", "公費区分", "地域コード", "地域名", "診療報酬区分"))
            assert row["年度"] == "2024" and grain in ("pref", "secondary") and scope in out["scopes"] and category in CATEGORIES
            code = code.zfill(2 if grain == "pref" else 4)
            key = (grain, scope, code, category)
            assert key not in seen, key
            seen.add(key)
            values = [int(row[k]) for k in FIELDS]
            assert all(v >= 0 for v in values)
            if category == "ALL":
                original_totals[(scope, grain)] += values[0]
            if grain == "secondary":
                original_area_codes.add(code)
                if code.startswith("05"):
                    old, code, new = AKITA[code]
                    assert name == old, (name, old)
                    name = new
            region = out["scopes"][scope][grain].setdefault(code, {"name": name, "values": {}})
            assert region["name"] == name
            dest = region["values"].setdefault(category, [0] * len(FIELDS))
            for i, value in enumerate(values):
                dest[i] += value
    assert len(seen) == 12988 and len(original_area_codes) == 335
    for scope, grains in out["scopes"].items():
        for grain, regions in grains.items():
            assert len(regions) == (47 if grain == "pref" else 330)
            for code, region in regions.items():
                v = region["values"]
                assert set(v) == set(CATEGORIES), code
                assert all(sum(v[c][i] for c in CATEGORIES[1:]) == v["ALL"][i] for i in range(len(FIELDS))), code
            assert sum(r["values"]["ALL"][0] for r in regions.values()) == original_totals[(scope, grain)]
    return out

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path, help="private output path OUTSIDE public repo")
    parser.add_argument("--current-regional", type=Path, help="optional existing private regional.json, for exact code verification")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    assert not args.output.resolve().is_relative_to(root), "Output must be outside public repository"
    data = normalize(args.source)
    if args.current_regional:
        current = json.loads(args.current_regional.read_text(encoding="utf-8"))
        for scopes in data["scopes"].values():
            assert set(scopes["secondary"]) == set(current), "Current deployed area codes do not match"
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("PASS: 12,988 source rows; 47 prefectures and 330 areas per scope; reconciled all five fields; totals preserved")

if __name__ == "__main__":
    main()
