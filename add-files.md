# Add initial files for kerosene-delivery

## 概要

このプルリクエストは、以下の初期ファイルを追加するものです：

- `index.html` — メインの入力 UI  
- `customers.json` / `tanks.json` — 顧客およびタンクマスタ  
- `convert_customers.py` — CSV → JSON／JSON → CSV 変換スクリプト  
- 必要なスタイル、スクリプトファイル など

---

## 内容

| ファイル名 | 内容 |
|------------|------|
| index.html | UI 本体（給油入力／CSV 出力など含む） |
| customers.json | 顧客マスタ データ |
| tanks.json | タンクマスタ データ |
| convert_customers.py | マスタ変換用 Python スクリプト |
| README.md | プロジェクト概要と使い方 |

---

## 動作確認

1. リポジトリをクローン  
2. `convert_customers.py` でマスタ JSON を生成  
3. `index.html` をブラウザで開き、給油入力 → CSV 出力が動作すること  
4. 問題なければマージをお願いします。

---

## 補足

- JSON は UTF-8 エンコーディング  
- タンクマスタと顧客マスタを分離  
- 複数タンク対応・ID 項目あり  

