#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
灯油配送管理システム - マスタデータ変換スクリプト v2.0

CSVファイル（Shift-JIS）をJSON（UTF-8）に変換します。

【改善点】
- customers.jsonにtanks配列を含めない（データ構造の統一）
- エラーハンドリング強化
- 処理結果の詳細表示
"""

import csv
import json
from pathlib import Path
import sys

# ディレクトリ設定
INPUT_DIR = Path("input")
OUTPUT_DIR = Path("output")

CUSTOMERS_CSV = INPUT_DIR / "customers.csv"
TANKS_CSV = INPUT_DIR / "tanks.csv"

CUSTOMERS_JSON = OUTPUT_DIR / "customers.json"
TANKS_JSON = OUTPUT_DIR / "tanks.json"


def read_csv_shiftjis(path):
    """Shift-JISエンコードのCSVファイルを読み込み"""
    try:
        with open(path, encoding="cp932", newline="") as f:
            return list(csv.DictReader(f))
    except FileNotFoundError:
        print(f"❌ エラー: {path} が見つかりません")
        return None
    except Exception as e:
        print(f"❌ エラー: {path} の読み込みに失敗しました - {e}")
        return None


def convert_customers(customers):
    """
    顧客データを変換
    
    【旧構造】tanks配列を含む
    【新構造】tanks配列を含まない（tanks.jsonで管理）
    """
    customers_out = []
    for c in customers:
        customers_out.append({
            "customerCode": c.get("customerCode", ""),
            "officialName": c.get("officialName", ""),
            "officialKana": c.get("officialKana", ""),
            "unitPrice": int(c.get("unitPrice") or 0)
        })
    return customers_out


def convert_tanks(tanks):
    """タンクデータを変換（そのまま出力）"""
    return tanks


def save_json(data, path):
    """JSONファイルとして保存（UTF-8、整形あり）"""
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"❌ エラー: {path} の保存に失敗しました - {e}")
        return False


def main():
    print("=" * 60)
    print("灯油配送管理システム - マスタデータ変換 v2.0")
    print("=" * 60)
    print()
    
    # 出力ディレクトリ作成
    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"📁 出力先: {OUTPUT_DIR.absolute()}")
    print()
    
    # 顧客CSVを読み込み
    print(f"📖 顧客マスタ読み込み: {CUSTOMERS_CSV}")
    customers = read_csv_shiftjis(CUSTOMERS_CSV)
    if customers is None:
        sys.exit(1)
    print(f"   ✅ {len(customers)}件の顧客データを読み込みました")
    print()
    
    # タンクCSVを読み込み
    print(f"📖 タンクマスタ読み込み: {TANKS_CSV}")
    tanks = read_csv_shiftjis(TANKS_CSV)
    if tanks is None:
        sys.exit(1)
    print(f"   ✅ {len(tanks)}件のタンクデータを読み込みました")
    print()
    
    # 顧客データ変換
    print("🔄 顧客データ変換中...")
    customers_out = convert_customers(customers)
    print(f"   ✅ {len(customers_out)}件の顧客データを変換しました")
    print()
    
    # タンクデータ変換
    print("🔄 タンクデータ変換中...")
    tanks_out = convert_tanks(tanks)
    print(f"   ✅ {len(tanks_out)}件のタンクデータを変換しました")
    print()
    
    # JSON保存
    print(f"💾 JSON保存: {CUSTOMERS_JSON}")
    if save_json(customers_out, CUSTOMERS_JSON):
        print(f"   ✅ customers.json を保存しました")
    else:
        sys.exit(1)
    print()
    
    print(f"💾 JSON保存: {TANKS_JSON}")
    if save_json(tanks_out, TANKS_JSON):
        print(f"   ✅ tanks.json を保存しました")
    else:
        sys.exit(1)
    print()
    
    # 完了
    print("=" * 60)
    print("✅ 変換完了！")
    print("=" * 60)
    print()
    print("📋 変換結果:")
    print(f"   - 顧客: {len(customers_out)}件")
    print(f"   - タンク: {len(tanks_out)}件")
    print()
    print("💡 次のステップ:")
    print("   1. output フォルダの customers.json と tanks.json を確認")
    print("   2. ブラウザで灯油配送管理システムを開く")
    print("   3. データ管理セクションから JSON を取り込む")
    print()
    
    # 顧客ごとのタンク数を表示
    print("📊 顧客ごとのタンク数:")
    tank_count = {}
    for t in tanks_out:
        code = t.get("customerCode")
        tank_count[code] = tank_count.get(code, 0) + 1
    
    for c in customers_out:
        code = c.get("customerCode")
        count = tank_count.get(code, 0)
        print(f"   {code} ({c.get('officialName')}): {count}基")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print("⚠️ 処理が中断されました")
        sys.exit(1)
    except Exception as e:
        print()
        print(f"❌ 予期しないエラーが発生しました: {e}")
        sys.exit(1)
