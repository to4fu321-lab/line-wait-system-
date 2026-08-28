# お直し商材のフレキシブル化 設計案（ラケットガット張替え対応）

> 発端: 店舗「ビーストローク」から、バドミントン等の **ラケットガット張替え** をお直し管理で扱いたい要望。
> 目的は個別対応ではなく、**「お直しの商材」を業種に依存しないデータで表現できるようにする**こと。
>
> 前提ドキュメント: `docs/repair-master-data-design.md`（現行マスタの確定形）

---

## 0. 結論（先に3行）

1. **3階層マスタ（`服種 > 項目 > オプション`）はそのまま使える。** 構造はすでに業種非依存で、リネームも作り直しも要らない。
2. 足りないのは **語彙・入力フィールド・糸(商品)・ラケット個体・1本=1明細** の5点。新規テーブルは **`customer_rackets` の1枚だけ**、あとは既存テーブルへの列追加で足りる。
3. 直近の `slip_records`（テンプレ駆動の汎用受付）は**紙伝票OCR取り込み専用に留める**。ラケット店に必須の完了LINE通知・お渡し・POS・写真が繋がっていないため、こちらを本流にすると二重管理になる。

> **改訂履歴**: 初版は「材料マスタ `repair_materials` を新設」「顧客単位で前回設定を再現」としていたが、
> プロショップの実受付項目30件で再検証した結果いずれも誤りと判明し、§2-2・§3③・§3④・§5 を改訂した（`products` へ寄せる／ラケット個体単位にする）。

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
| 商品マスタ | `products`（maker/color_code/stock/barcode/`adjust_product_stock()`） | 低（`prices` のみ学校前提） | ✅ 糸はここに載る |
| **画面の文言** | 「服種」「お直し」「採寸」がコードに直書き | **高** | ❌ 要対応 |
| **入力項目の型** | `MeasurementDef {key,label,unit,required}` = 実質テキスト/mm数値のみ | **高** | ❌ 要対応 |
| **糸と作業の紐付け** | お直し明細から商品を参照する線がない | **高** | ❌ 要対応 |
| **預かり品の個体** | 概念なし（顧客と伝票しかない） | **高** | ❌ 要対応 |
| **明細の粒度** | `qty` で数える＝同一仕様前提 | 中 | ❌ 要対応（UIのみ） |
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

### 2-1. プロショップの受付項目を全部並べてみる

「フィールドを増やせば済む」で本当に足りるかを検証するため、実際の張替え受付伝票の項目を棚卸しした。

| # | 分類 | 項目 | 現行＋FieldDefで足りるか |
|---|---|---|---|
| 1 | ラケット | メーカー・機種名（アストロクス100ZZ） | ✅ `text` |
| 2 | ラケット | 色・年式（同機種で色違いが普通） | ✅ `text` |
| 3 | ラケット | **複数本の同時預かり（本ごとに別仕様）** | ❌ **構造** |
| 4 | ラケット | フレーム状態確認（キズ・塗装剥げ・変形） | ✅ 既存 `manual(danger)` |
| 5 | ラケット | グロメット状態（割れ→交換提案） | ✅ 既存 `quote_status:'pending'` |
| 6 | ラケット | **個体識別（取り違え防止）** | ❌ **構造** |
| 7 | 糸 | メーカー（ヨネックス/ゴーセン/トアルソン…） | ⚠️ 商品マスタ |
| 8 | 糸 | 銘柄（BG66アルティマックス） | ⚠️ 商品マスタ |
| 9 | 糸 | ゲージ・太さ（0.63/0.65/0.68mm、テニス1.25mm） | ⚠️ 商品マスタ |
| 10 | 糸 | **色（在庫はSKU＝銘柄×色×ゲージ単位）** | ⚠️ 商品マスタ |
| 11 | 糸 | ロール品 / パッケージ単張り | ⚠️ 商品マスタ |
| 12 | 糸 | 持ち込み / 店販 | ✅ `bool` |
| 13 | 糸 | ハイブリッド（縦ポリ・横ナイロン＝糸2本） | ✅ `material`×2 |
| 14 | 仕様 | テンション 縦(メイン)/横(クロス) 別 | ✅ `number`×2 |
| 15 | 仕様 | 単位 lbs / kg | ✅ `select` |
| 16 | 仕様 | 張り方（1本張り/2本張り/ATW） | ✅ `select` |
| 17 | 仕様 | ノット数（4ノット/6ノット） | ✅ `select` |
| 18 | 仕様 | プレストレッチ有無 | ✅ `bool` |
| 19 | 仕様 | **前回比指定（「前回＋1ポンド」）** | ❌ **構造** |
| 20 | 仕様 | 結び目位置・特殊指定 | ✅ `text` |
| 21 | 付帯 | グロメット交換 | ✅ option |
| 22 | 付帯 | グリップ交換（元グリップ/オーバー/下巻き） | ✅ item＋商品マスタ |
| 23 | 付帯 | バンパー交換 | ✅ item |
| 24 | 付帯 | 鉛テープ・バランス調整 | ✅ item |
| 25 | 運用 | 即日 / お預かり・仕上がり日時 | ✅ 既存 |
| 26 | 運用 | ストリンガー指名 | ✅ `select` |
| 27 | 運用 | 部活の一括受付（学校×20本） | ⏸ Phase 3 |
| 28 | 運用 | 会員価格・回数券 | ⏸ POS側 |
| 29 | 運用 | 破損免責の同意 | ✅ 既存 `manual(danger)` |
| 30 | 運用 | 余りガットの返却 | ✅ `bool` |

**判定: 30項目中18は素直に載る。5は商品マスタの話。3つが構造的に足りない。**

### 2-2. 構造的に足りない3点

1. **糸は「材料」ではなく「商品」だった（本書 初版の設計ミス）**
   `repair_materials` を新設すると既存 `products` と二重管理になる。ストリングは**張替えなしの単品販売もする＝POS商品**であり、商品マスタに置くのが正しい。→ §3 追加③ を全面改訂。

2. **「1受付＝複数ラケット、各々別仕様」が受付UIで表現できない**
   部活生は2〜3本持ち込み、試合用と練習用でテンションが違う。現行は `qty` で数えるため、**3本まとめると1行になり個別テンションが持てない**。
   DB側は「1お直し=1行・`slip_number` で束ねる」なので**表現力はある**。足りないのはUI動線だけ（`NewRepairModal` の `resetForNext()` が土台になる）。

3. **「前回と同じ」は顧客単位では機能しない（本書 初版の設計ミス）**
   2本持ちの客は本ごとに設定が違うので、顧客の最新1件を引く設計では**別のラケットの設定を引っ張る**。ラケット個体台帳が要る。→ §3 追加④ を全面改訂。

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

### 追加③ 糸＝商品マスタ `products` に載せる（★初版から全面改訂）

> **初版の `repair_materials` 新設案は撤回。** ストリングは「作業に付随する材料」ではなく、
> **張替えなしで単品販売もする商品**であり、専用テーブルを作ると `products` と二重管理になる。
> 在庫・原価・バーコード・POS販売がすべて二重になるのは事故のもと。

既存 `products` にそのまま載る:

| ストリングの属性 | 既存カラム | 備考 |
|---|---|---|
| メーカー | `maker` / `supplier_id` | 既存の `suppliers` を再利用 |
| 銘柄 | `name` | BG66アルティマックス |
| 色 | `color_code` | 在庫SKUの軸 |
| 分類 | `category` | `'string'` / `'grip'` / `'grommet'` |
| 材料費（店販価格） | `base_price_tax_in` | 学校非依存なのでラケット店でもそのまま使える |
| 在庫 | `stock` ＋ **既存 `adjust_product_stock(product_id, delta)`** | 20260713_pos_enhancements.sql で実装済み |
| バーコード | `barcode` | 仕入検品でそのまま使える |

**足りないのは実質1列だけ**:

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS group_name text;   -- 例: 'BG66アルティマックス'
COMMENT ON COLUMN public.products.group_name IS
  'バリアントのまとめ名。受付/POSで〈銘柄→色・ゲージ〉の2段選択に使う（null=単独商品）';
```

- SKU = **銘柄 × 色 × ゲージ = `products` 1行**。`stock` が行単位なので既存の在庫関数がそのまま効く。
- 受付UIは `group_name` でまとめて2段選択。30銘柄×4色＝120行あっても〈銘柄を選ぶ→色を選ぶ〉で捌ける。
- **ロール管理に新テーブルは不要**: `stock` を「張り数」で持てばよい（200mロール ÷ 1張り10m ＝ 20張り）。
  ロールを1本開けたら `adjust_product_stock(id, +20)`、1回張るごとに `-1`。
- 粗利は `prices.cost` を使いたいところだが、`prices` は `school_id NOT NULL`（制服専用設計）。
  ラケット店では **`products` に `cost_price` を1列足す**のが素直（`prices` には触らない）。

**価格式の拡張**（`lib/repairPricing.ts`）:

```
明細金額 = 工賃(base_price × 係数)
         + Σ 糸・部材(product.base_price_tax_in × 本数)   ← 持ち込み時は 0
         + Σ option.price_delta
```

- 「持ち込みガット」トグル1つで材料費が落ちる。**銘柄ごとにオプションを量産しなくて済む**のがポイント。
- `type:'material'` のフィールドを**2つ置けばハイブリッド張り**（縦ポリ・横ナイロン）が表現できる。
- `FieldDef.material_category` は `products.category` を指すことになる（`'string'` で絞る）。

> 制服店では `material_enabled:false` にしておけば **UIに一切出ない**。既存店に影響なし。

---

### 追加④ ラケット個体台帳 `customer_rackets`（★初版から全面改訂）

> **初版の「顧客の最新1件を prefill」は誤り。** 2本持ちの客は本ごとに設定が違うため、
> 顧客単位で引くと**別のラケットの設定を引っ張る**。個体を持たないと成立しない。

ガット張替えは3ヶ月周期のリピート商売で、受付の会話は事実上「前回と同じで」「前回より1ポンド硬く」しかない。**この2つが言えるかどうかが、このシステムを使う理由そのもの。**

```sql
CREATE TABLE public.customer_rackets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  child_id     uuid REFERENCES public.children(id) ON DELETE SET NULL,  -- 部活生は子ども単位
  maker        text,          -- ヨネックス
  model        text,          -- アストロクス100ZZ
  nickname     text,          -- 「赤の方」「試合用」← 現場が実際に呼ぶ名前
  identifier   text,          -- 個体識別（グリップ色 / 貼付シール番号）※取り違え防止
  -- 前回セッティング（受付完了時に更新）
  last_repair_id        uuid REFERENCES public.repair_histories(id) ON DELETE SET NULL,
  last_string_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  last_tension_main     numeric,
  last_tension_cross    numeric,
  last_tension_unit     text DEFAULT 'lbs',   -- lbs | kg
  last_strung_at        date,
  retired      boolean NOT NULL DEFAULT false,
  ...
);
```
`repair_histories` 側に `racket_id uuid` を1列追加して紐付ける。

受付画面（顧客を選ぶと個体が並ぶ）:
```
田中太郎さん のラケット
┌ 🏸 アストロクス100ZZ（赤／試合用）
│   BG66UM イエロー  縦24 / 横22 lbs    最終 3ヶ月前
│   [ 前回と同じ ]  [ 前回 +1 ポンド ]  [ 変更して受付 ]
├ 🏸 ナノフレア800（青／練習用）
│   NBG98 ホワイト   縦22 / 横20 lbs    最終 5ヶ月前
└ [ ＋ラケットを追加 ]
```

この1枚で4つ同時に解決する:
- **「前回と同じ」が本ごとに正しく効く**（顧客単位では成立しない）
- **「前回＋1ポンド」が計算できる** ＝ プロショップの実際の会話
- **取り違え防止**（¥3〜4万の預かり品。`identifier` ＋ intake写真 ＋ `slip_number` で3重）
- **張替えサイクル通知の精度**がラケット単位になる（Phase 3）

> 制服店では使わない。プロファイルが `racket` 等のときだけUIに出す。

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

### 追加⑥ 「1本＝1明細」の受付動線（★§2-2 の構造課題2）

現行の受付は `qty` で点数を数える。制服なら「同じ裾上げを3点」で正しいが、
**ラケットは3本とも別のガット・別のテンションになりうる**ので `qty=3` にすると情報が落ちる。

- **DB変更は不要**: 「1お直し＝1行、複数は `slip_number` で束ねる」という現行構造がそのまま答え。3本なら3行。
- **UIだけ足りない**: `NewRepairModal.tsx` には既に `resetForNext()`（`printQueue` に積んで次の1点へ戻る）がある。
  これを「もう1本追加」の明示ボタンに昇格させ、**2本目は1本目の設定をコピーして開始**する（部活生は3本とも同じ設定のことも多い）。
- ラケット個体（追加④）を選ぶと、その行の機種・前回設定が自動で入る。
- 確定時に `slip_number` で束ね、**預かり札は1枚・明細は3行**。LINE通知も1通にまとめる。

```
受付伝票 #2415  田中太郎さん   計 3本
 1. アストロクス100ZZ（赤）  BG66UM/イエロー  24×22 lbs   1,650
 2. アストロクス100ZZ（青）  BG66UM/イエロー  24×22 lbs   1,650
 3. ナノフレア800           持ち込み          22×20 lbs   1,100
                                                  合計   4,400
```

> `qty` は「同一仕様の複数本」のショートカットとして残す（3本とも同設定なら qty=3 で1行でもよい）。
> 現場が速いのは**既定を「1本ずつ」にして、同設定なら qty を上げる**動線。

---

## 4. ビーストローク向けプリセット案（そのままシードできる粒度）

| 種別（服種） | 作業（項目） | 工賃 | フィールド | オプション |
|---|---|---|---|---|
| 🏸 バドミントン | ガット張替え | 1,100 | ガット`material` / 縦`number`24(15-30) / 横`number`22 / 単位`select`(lbs·kg) / 持込`bool` / 余り糸返却`bool` | 即日 +550 ／ グロメット同時交換 +880 ／ プレストレッチ +0 ／ ノット数`single`(4/6) |
| 🏸 バドミントン | グリップ交換 | 550 | グリップ`material` / 種別`select`(オーバー/元) / 下巻き`bool` | — |
| 🎾 硬式テニス | ガット張替え | 1,650 | ガット`material` / 縦`number`50(35-65) / 横`number`48 / 持込`bool` | 即日 +550 ／ 張り方`single`(1本/2本) |
| 🎾 硬式テニス | ハイブリッド張り | 2,200 | 縦ガット`material` / 横ガット`material` / 縦`number` / 横`number` | 即日 +550 |
| 🥎 ソフトテニス | ガット張替え | 1,320 | ガット`material` / テンション`number`30 / 持込`bool` | 即日 +550 |
| 🔧 共通 | グロメット交換 | 1,100 | 交換箇所`text` | — |
| 🔧 共通 | ラケット修理 | 見積 | 症状`text` | `requires_quote: true` |

- **機種・色は項目フィールドではなく `customer_rackets`（追加④）から入る。** 毎回打たせない。
- 糸は `products`（`category='string'`）に銘柄×色で20〜40行。金額は仮値で入れて店舗側に調整させる（既存プリセットと同じ思想）。
- **免責同意・フレーム状態確認は `manual` の `severity:'danger'` で表現**（受付時に自動モーダル＋確認必須チェック）。新規実装は不要 — 既にある機能。

> ⚠️ **取り違え防止**が現場の最大リスク。ラケットは見た目が似ていて、1本 ¥3〜4万の預かり品。
> `customer_rackets.identifier` ＋ `intake_photo_required: true` ＋ 既存 `slip_number` の預かり札で3重に担保する。

---

## 5. 段階導入プラン

> **初版からの重要な訂正**: 「Phase 1 だけでガット張替えは受付できる」は楽観的すぎた。
> Phase 1 は**試験運用レベル**（糸は手入力・「前回と同じ」なし・複数本は個別入力）。
> プロショップの実務に乗るのは **Phase 2 まで込みが最小構成**。

| Phase | 内容 | 触るファイル | 到達点 | リスク |
|---|---|---|---|---|
| **1** | 業種プロファイル（語彙）＋ `FieldDef` 拡張 ＋ ラケットプリセット | `stores.repair_settings` migration / `types/repair.ts` / `lib/repairProfile.ts`(新) / `lib/repairPresets.ts` / `master/repair/page.tsx` / `NewRepairModal.tsx` / `constants.ts` | **試験運用レベル**。テンション・張り方は正しく取れるが、糸は自由入力で在庫も履歴も繋がらない | 小。既存は `type` 未指定でそのまま動く |
| **2** | ①糸を `products` へ（`group_name`＋2段選択）②`customer_rackets` ③1本＝1明細の動線 ④価格式に材料費＋持込トグル | 上記＋ migration 2本 / `lib/repairPricing.ts` / `products` マスタUI / 受付モーダル | **実務に乗る（ここが本当のゴール）**。「前回と同じ」「前回+1ポンド」が言える | 中。価格計算に手を入れる → `tests/` にユニットテスト必須 |
| **3** | ロール在庫の減算 ／ 張替えサイクル通知 ／ 部活一括受付 ／ 業種別ダッシュボード | 既存 notify・followup 基盤 | 継続来店の仕掛け・粗利の可視化 | 低 |

Phase 1・2 とも**破壊的変更ゼロ**（列とテーブルの追加のみ）。既存の制服店は `profile: 'uniform'` 既定でこれまで通り、`customer_rackets` も材料UIも出ない。

---

## 6. 採用しなかった案とその理由

| 案 | 内容 | 却下理由 |
|---|---|---|
| **A': 材料マスタ `repair_materials` 新設**（初版の案・撤回） | 糸・グリップを専用テーブルで持つ | ストリングは**張替えなしの単品販売もするPOS商品**。専用表を作ると `products` と在庫・原価・バーコード・売上が二重になる。既存 `products` ＋ `group_name` 1列で足りる（§3③） |
| **A'': 顧客単位で「前回と同じ」**（初版の案・撤回） | `repair_histories` を顧客の最新1件で prefill | 2本持ちの客は本ごとに設定が違うため、**別のラケットの設定を引く**。`customer_rackets` で個体を持たないと成立しない（§3④） |
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
