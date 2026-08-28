# お直し商材のフレキシブル化 設計案（ラケットガット張替え対応）

> 発端: 店舗「ビーストローク」から、バドミントン等の **ラケットガット張替え** をお直し管理で扱いたい要望。
> 目的は個別対応ではなく、**「お直しの商材」を業種に依存しないデータで表現できるようにする**こと。
>
> 前提ドキュメント: `docs/repair-master-data-design.md`（現行マスタの確定形）

---

## 0. 結論（先に3行）

1. **新しいテーブル群は作らない。** 現行の `服種 > 項目 > オプション` 3階層は構造としてはすでに業種非依存で、ガット張替えの9割はマスタ登録だけで表現できる。
2. 足りないのは **語彙・入力フィールド・材料（消耗品）・リピート** の4点。ここだけを足せば「新業種はSQLシード1本で開店」にできる。
3. 直近の `slip_records`（テンプレ駆動の汎用受付）は**紙伝票OCR取り込み専用に留める**。ラケット店に必須の完了LINE通知・お渡し・POS・写真が繋がっていないため、こちらを本流にすると二重管理になる。

---

## 1. 現状の棚卸し — どこまで既に汎用か

| レイヤー | 実体 | 業種依存度 | 判定 |
|---|---|---|---|
| 3階層マスタ | `repair_garment_types` > `repair_items` > `repair_options` | **なし**（名前が制服語なだけ） | ✅ そのまま使える |
| 価格計算 | `lib/repairPricing.ts` `base_price × 係数 + Σ price_delta` | なし | ✅ 使える |
| 見積もり逃がし | `pricing_mode` / `quote_status` | なし | ✅ 使える |
| 写真 | `repair_photos.phase`（intake/after/…） | なし | ✅ 預かり品の証跡としてそのまま有効 |
| 外注 | `repair_vendors` / `sent_to_vendor_at` / `inspected_at` | なし | ✅ 使える |
| 納期・通知・お渡し・POS | 既存フロー一式 | なし | ✅ 使える |
| **画面の文言** | 「服種」「お直し」「採寸」がコードに直書き | **高** | ❌ 要対応 |
| **入力項目の型** | `MeasurementDef {key,label,unit,required}` = 実質テキスト/mm数値のみ | **高** | ❌ 要対応 |
| **材料（モノ）** | 概念なし。オプションの固定加算しかない | **高** | ❌ 要対応 |
| **クイックボタン** | `constants.ts: REPAIR_TYPES_DEF` に裾上げ/袖丈…を直書き | 高 | ❌ 要対応 |
| **プリセット** | `lib/repairPresets.ts: REPAIR_PRESET` が制服1種のみ | 高 | ❌ 要対応 |

> つまり **「器」は合っている。中身と呼び名がハードコードされているだけ。**

---

## 2. ガット張替えを今の器に載せてみる（マッピング）

| 現行の階層 | ラケット店での意味 | 例 |
|---|---|---|
| 服種 `garment_type` | **競技・ラケット種別** | バドミントン / 硬式テニス / ソフトテニス |
| 項目 `item`（基本料金） | **作業＝工賃** | ガット張替え / ハイブリッド張り / グリップ交換 / グロメット交換 |
| オプション `option`（差分） | **仕上げ・特急・持込** | 即日仕上げ +550 / 持ち込みガット ±0 / 元グリップ同時交換 +880 |
| 採寸 `measurements` | **仕様の指定** | テンション縦 24lbs / 横 22lbs / ラケット機種 |
| 写真 `photos` | **預かり時の状態証跡** | 受付時のフレーム傷・取り違え防止 |
| 外注 | ストリンガー外注 | そのまま |

### 詰まる4点

1. **テンションが数値として扱えない。** 今の `measurements` は単位付きテキスト同然で、既定値も範囲チェックもない。ラケット店では「縦24／横22」が毎回の主入力で、範囲外（例: 35lbs）は事故になる。
2. **ガット銘柄が「モノ」なのに表現できない。** 銘柄ごとに `repair_options` を作れば動くが、**在庫も原価も持てない**。ラケット店の粗利はロール（200m）を1張り10mで割った材料原価で決まるので、ここが無いと商売の数字が出ない。
3. **持ち込みガットの切替が構造化されていない。** 「持込＝工賃のみ／店販＝工賃＋材料費」は受付で最初に分岐する最重要フラグ。オプションの固定マイナス値で表現すると銘柄ごとに破綻する。
4. **テニスのハイブリッド張りで材料が2つ要る。** 縦ポリ／横ナイロン。1明細に材料1つ、では足りない。

---

## 3. 提案 — 4つの追加だけで汎用化する

### 設計の芯: 3つを分離する

| 分離軸 | どこに置くか | 新業種の追加コスト |
|---|---|---|
| **何を売るか（商材）** | マスタデータ（DB） | シード1本 |
| **何を聞くか（入力）** | `fields` JSONB（DB） | シード1本 |
| **何と呼ぶか（語彙）** | 業種プロファイル（DB） | 辞書1個 |

→ **コード側は「3階層＋フィールド＋材料」という器だけを持ち、業種名を一切書かない。**

---

### 追加① 業種プロファイル（語彙レイヤー）

テーブルはリネームしない（`repair_garment_types` のままでよい）。**表示ラベルだけ差し替える。**

```jsonc
// stores.repair_settings (jsonb) 新設
{
  "profile": "racket",          // uniform | racket | custom
  "labels": {                   // 未指定はプロファイル既定にフォールバック
    "domain":      "張替え・修理",   // 「お直し」
    "garment":     "競技・種別",     // 「服種」
    "item":        "作業",           // 「項目」
    "option":      "オプション",
    "measurement": "仕様",           // 「採寸」
    "unit_count":  "本"              // 「点」
  },
  "material_enabled": true,     // 材料モジュールON
  "intake_photo_required": true
}
```

- 実装: `lib/repairProfile.ts` に既定辞書＋`useRepairLabels(storeId)`。`app/[storeId]/admin/master/repair/page.tsx` と `NewRepairModal.tsx` の直書き文言を置換。
- **スキーマ変更ゼロで効果が最も大きい**（現場が「服種」と書かれた画面でラケットを受け付けるのは無理）。
- ⚠️ `stores` はカラム単位GRANT方式。`GRANT SELECT (repair_settings) ... TO anon, authenticated;` を同じマイグレーションに必ず書く（CLAUDE.md規約）。

---

### 追加② `MeasurementDef` → `FieldDef`（入力の一般化）★本丸

現行:
```ts
interface MeasurementDef { key: string; label: string; unit: string; required?: boolean }
```

提案（**後方互換**: `type` 未指定は従来どおりテキスト扱い）:
```ts
export type FieldType = 'text' | 'number' | 'select' | 'bool' | 'material'

export interface FieldDef {
  key:       string
  label:     string
  type?:     FieldType          // 省略時 'text' = 現行挙動
  unit?:     string
  required?: boolean
  default?:  string | number | boolean
  min?:      number             // number: 範囲ガード（テンション 15〜30lbs）
  max?:      number
  step?:     number             // ±ボタンの刻み
  choices?:  { value: string; label: string; price_delta?: number }[]  // select
  material_category?: string    // type='material' のとき materials を絞る
  affects_price?: boolean       // 価格計算に参入するか
}
```

これで表現できるようになるもの:

| 業種 | フィールド例 |
|---|---|
| ラケット | テンション縦 `number` 既定24 / 範囲15-30、テンション横 `number` 既定22、ラケット機種 `text`、ガット `material`、持ち込み `bool` |
| 制服 | 既存の `hem_length_mm` 等はそのまま（`type:'number', unit:'mm'`）— 移行不要 |
| 靴修理 | ソール種別 `select`、サイズ `number` |
| 時計 | 電池型番 `select`、防水検査 `bool` |

- 保存先は既存の `repair_histories.inputs` (JSONB) のままで変更不要。
- UI: `NewRepairModal.tsx` の `renderMeasurement()` を `renderField()` に拡張（±ボタン・スライダー・セレクト・トグル）。**テンションは大きい±ボタン**にすると現場が速い。
- DBは `repair_items.measurements` を `fields` に**論理的に読み替えるだけ**（列名は据え置き＋新列 `fields` を追加して両読みが安全）。

---

### 追加③ 材料マスタ `repair_materials`（価格の第2軸）★商売の数字が出る

オプション（＝作業の差分）と材料（＝モノ）は性質が違うので**分ける**。

```sql
CREATE TABLE public.repair_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category        text NOT NULL,          -- 'string' | 'grip' | 'grommet' ... 店舗自由
  maker           text,                   -- ヨネックス / ゴーセン
  name            text NOT NULL,          -- BG66アルティマックス
  sell_price      integer NOT NULL DEFAULT 0,  -- 1施工あたり販売額（材料費）
  cost_price      integer,                     -- 1施工あたり原価
  roll_length_m   numeric,                -- 200m ロール
  use_length_m    numeric,                -- 1張り 10m → 20張り取れる
  stock_qty       numeric,                -- 残り（張り数 or 本数）
  bring_in_allowed boolean NOT NULL DEFAULT true,  -- 持ち込み可否
  sort_order      integer NOT NULL DEFAULT 100,
  active          boolean NOT NULL DEFAULT true,
  ...
);
```

**価格式の拡張**（`lib/repairPricing.ts`）:

```
明細金額 = 工賃(base_price × 係数)
         + Σ 材料費(material.sell_price × 本数)     ← 持ち込み時は 0
         + Σ option.price_delta
```

- 「持ち込みガット」トグル1つで材料費が落ちる。**銘柄ごとにオプションを量産しなくて済む**のがポイント。
- `type:'material'` のフィールドを**2つ置けばハイブリッド張り**（縦・横で別銘柄）が表現できる。
- 在庫: 受付確定時に `use_length_m` 分だけ `stock_qty` を減算（Phase 3。まずは表示のみでも十分）。
- 粗利: `sell_price - cost_price` で項目別粗利が出る → 既存の実績ダッシュボードに乗る。

> 制服店では `material_enabled:false` にしておけば **UIに一切出ない**。既存店に影響なし。

---

### 追加④ 顧客カルテ＝「前回と同じ」ワンタップ（リピート受注）

**これがラケット店に一番効く。** ガット張替えは3ヶ月に1回のリピート商売で、受付の会話は事実上「前回と同じで」しかない。

- 実装は軽い: 受付モーダルで顧客確定時に `repair_histories` をその顧客の最新1件だけ引き、`inputs` / `selected_options` / 材料を prefill。
  ```
  ┌ 前回: バドミントン ガット張替え
  │ BG66アルティマックス  縦24 / 横22 lbs   （3ヶ月前）
  └ [ 前回と同じで受付 ]  ← 1タップで明細完成
  ```
- 発展（Phase 3）: 平均張替えサイクルを計算して「そろそろ張り替え時期です」LINE。既存の `notify-repair` / followup 基盤に乗る。**新規機能というより既存資産の再利用**で、店舗への訴求が大きい。

---

### 追加⑤（おまけ）業種プリセットの複数化

`lib/repairPresets.ts` の `REPAIR_PRESET`（制服1種）を業種別に分ける:

```ts
export const PRESETS_BY_PROFILE: Record<string, PresetGarment[]> = {
  uniform: UNIFORM_PRESET,   // 既存をそのまま移設
  racket:  RACKET_PRESET,    // 新規
}
```

マスタ画面の「標準お直し一式を取り込み」CTA に業種選択を足すだけ。`seedRepairPresets()` は冪等・追記式なのでロジック変更不要。

---

## 4. ビーストローク向けプリセット案（そのままシードできる粒度）

| 種別（服種） | 作業（項目） | 工賃 | フィールド | オプション |
|---|---|---|---|---|
| 🏸 バドミントン | ガット張替え | 1,100 | ガット`material` / 縦`number`24 / 横`number`22 / 機種`text` / 持込`bool` | 即日 +550 ／ グロメット同時交換 +880 |
| 🏸 バドミントン | グリップ交換 | 550 | グリップ`material` / 種別`select`(オーバー/元) | — |
| 🎾 硬式テニス | ガット張替え | 1,650 | ガット`material` / 縦`number`50 / 横`number`48 / 機種`text` / 持込`bool` | 即日 +550 |
| 🎾 硬式テニス | ハイブリッド張り | 2,200 | 縦ガット`material` / 横ガット`material` / 縦`number` / 横`number` | 即日 +550 |
| 🥎 ソフトテニス | ガット張替え | 1,320 | ガット`material` / テンション`number`30 / 機種`text` / 持込`bool` | 即日 +550 |
| 🔧 共通 | ラケット修理 | 見積 | 症状`text` | `requires_quote: true` |

材料（`repair_materials`）は銘柄を20〜30件登録すれば実運用に乗る。金額は仮値で入れて店舗側に調整させる（既存プリセットと同じ思想）。

> ⚠️ **取り違え防止**が現場の最大リスク。ラケットは見た目が似ている。`intake_photo_required: true` ＋ 機種フィールド ＋ 既存 `slip_number` の預かり札で3重に担保する。

---

## 5. 段階導入プラン

| Phase | 内容 | 触るファイル | 効果 | リスク |
|---|---|---|---|---|
| **1** | 業種プロファイル（語彙）＋ `FieldDef` 拡張 ＋ ラケットプリセット | `stores.repair_settings` migration / `types/repair.ts` / `lib/repairProfile.ts`(新) / `lib/repairPresets.ts` / `master/repair/page.tsx` / `NewRepairModal.tsx` / `constants.ts` | **これだけでガット張替えは受付できる**（材料は仮でオプション運用） | 小。既存は `type` 未指定でそのまま動く |
| **2** | `repair_materials` ＋ 価格式に材料費 ＋ 持ち込みトグル ＋ 「前回と同じ」 | 上記＋ migration / `lib/repairPricing.ts` / マスタ画面に材料タブ | 粗利が見える。受付が実用速度に | 中。価格計算に手を入れる → テスト必須 |
| **3** | 在庫減算 ／ 張替えサイクル通知 ／ 業種別ダッシュボード | 既存 notify・followup 基盤 | 継続来店の仕掛け | 低 |

Phase 1 は**破壊的変更ゼロ**（追加のみ）。既存の制服店は `profile: 'uniform'` 既定でこれまで通り。

---

## 6. 採用しなかった案とその理由

| 案 | 内容 | 却下理由 |
|---|---|---|
| **B: `slip_records` を本流にする** | 直近の「テンプレ駆動の汎用受付」で任意伝票として受ける | 受付は作れるが、**完了LINE通知・お渡し・入金・写真・外注・実績集計が繋がっていない**。ラケット店は「張り上がりました」通知が価値の中心なので致命的。お直し系と受付が二系統になり、以後の機能追加が常に二重コストになる。→ **紙伝票OCRの取り込み口に留め、確定時は repair_histories に流し込む**のが正解 |
| **C: 商材を完全EAV化** | すべてを属性テーブルで汎用表現 | 現場UI（アルバイトが迷わないボタン動線）が作れなくなる。「崩さず逃がす」原則の `pricing_mode:'manual'` で既に例外は吸収できている |
| **D: ラケット専用テーブルを新設** | `racket_stringings` を別に作る | 業種が増えるたびに全機能を作り直す。今回の要望の本質（＝フレキシブル化）に反する |
| **E: `repair_garment_types` を `repair_categories` にリネーム** | 名前から制服色を消す | 参照箇所が広く、得るものは表示名だけ。**表示ラベルの差し替えで同じ効果が得られる**ため見送り（将来ビュー経由で改名は可能） |

---

## 7. 実装時の注意（CLAUDE.md規約より）

- `stores` に列を足したら **同じマイグレーションにカラムGRANTを書く**（漏れるとクライアントのSELECTがクエリごと失敗する）
- 新テーブルは **RLS ＋ `is_staff_of(store_id)` ポリシー** を同時に書く
- スキーマ変更後は `npm run gen:types`
- `NewRepairModal.tsx` は1,145行。フィールド描画に手を入れる前に **`FieldRenderer` を切り出してから**実装する（「次に触るときに分割」ルール）
- 価格計算の変更は `lib/repairPricing.ts` のユニットテストを先に足す（`tests/` 配下）
