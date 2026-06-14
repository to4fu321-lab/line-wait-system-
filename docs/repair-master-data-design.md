# お直し受付システム — マスタデータ設計案

> 学生服販売店／お直し専門店向け。アルバイトでも「服種 > 項目 > オプション」で迷わず受付でき、特殊ケースはマニュアル画像で補助、受付・完了写真を実績として残し、マスタにない特殊対応は個別見積もりで吸収する——を満たす設計。
>
> 既存実装（`repair_histories` テーブル / `types/crm.ts` の `RepairType` / マルチテナント `store_id`）との接続を前提にしています。

---

## ✅ 実装版（確定 / 2026-06-14 ゼロから再構築）

設計案を実装するにあたり「シンプル・分かりやすい・拡張可能」を優先し、当初案の8テーブルから
**実用上冗長な2テーブルを JSONB へ折りたたみ**、取引は既存アプリ互換のためフラット構造に統一した。

| 区分 | テーブル | 備考 |
|---|---|---|
| マスタ | `repair_garment_types` | 服種 |
| マスタ | `repair_items` | 項目=基本料金。`measurements`(採寸定義)・`manual`(参考画像) を JSONB 内包 |
| マスタ | `repair_options` | オプション=価格差分。`group_label`/`group_select` で option_groups を内包 |
| 取引 | `repair_histories` | **1お直し=1行**（複数項目は `slip_number` で束ねる）。マスタ連携・`pricing_mode`・`quote_status`・`selected_options`/`inputs`(JSONB) を追加。既存カラムは互換維持 |
| 取引 | `repair_photos` | 実績写真。`phase`(intake/before/after/rework/delivery)、`repair_id`→repair_histories |

**折りたたみ判断**
- `repair_manuals` → 項目/オプションの `manual`(JSONB) に内包（多項目で共有したくなれば独立テーブルへ切出し可）
- `repair_option_groups` → `repair_options.group_label`/`group_select` に内包
- `repair_orders` + `repair_order_lines`（ヘッダ+明細の正規化）→ **廃止**。既存アプリ（CRM/配送/受付/通知/統計）が `repair_histories` フラット前提のため過剰と判断。多項目受付は伝票番号で束ねる

**関連ファイル**: `sql/repair-system-rebuild.sql` / `sql/repair-system-seed.sql` / `types/repair.ts` /
`lib/repairPricing.ts`（価格計算）/ `app/[storeId]/admin/master/repair/`（マスタ管理UI）/
`app/[storeId]/admin/repairs/_components/NewRepairModal.tsx`（受付UI）

> 以下は当初の設計案（理論編）。正規化版(orders/lines)の記述が残るが、上表が実装の確定形。

---

## 0. 設計の3原則

| 原則 | 内容 |
|---|---|
| **マスタと実績の分離** | 「価格表（マスタ）」と「1件の受付（トランザクション）」を物理的に分ける。受付時にマスタの値を **スナップショットコピー** して保存し、後からマスタを改定しても過去伝票の金額は変わらない。 |
| **3階層 + フラット併用** | `服種 (garment) > 項目 (item) > オプション (option)` の3階層でアルバイトの選択動線を作る。ただし内部はフラットな参照で持ち、階層の深さに縛られない。 |
| **崩さず逃がす** | 「マスタにない・採寸が要る・難物」は、マスタを汚さず `pricing_mode = 'manual'`（個別見積もり）として同じ伝票構造に逃がす。マスタの正規価格と個別見積もりが1つの会計に同居できる。 |

---

## 1. 概念モデル（全体像）

```
┌─────────────── マスタ（価格表・滅多に変わらない）───────────────┐
│  repair_garment_types  服種     例) 上着 / スラックス / スカート        │
│        └─ repair_items        項目     例) 裾上げ / ウエスト出し / 刺繍   │
│              └─ repair_options  オプション 例) +千鳥 / +すべり止め / 特殊素材 │
│  repair_manuals          マニュアル画像（特殊ケースの注意書き・参考写真）  │
└──────────────────────────────────────────────────────────┘
                       │ 受付時にスナップショット
                       ▼
┌─────────────── トランザクション（1件ごとの受付）─────────────────┐
│  repair_orders          受付伝票（顧客・納期・合計・ステータス）         │
│        └─ repair_order_lines  明細（選んだ項目＋オプション＋確定金額）   │
│              └─ repair_photos    実績写真（受付前 / 完成 / 再加工）       │
└──────────────────────────────────────────────────────────┘
```

- 既存の `repair_histories` は「1受付＝1行（自由テキスト content + 単一 price）」。本設計はこれを **`repair_orders`（ヘッダ）＋ `repair_order_lines`（明細）** に拡張する位置づけです（後述「§7 既存テーブルとの接続」で段階移行案を提示）。

---

## 2. マスタデータ設計（JSONスキーマ）

> Supabase(PostgreSQL) 前提。**正規列で持つ部分**と、拡張に強い **JSONB 列で持つ部分**を意図的に分けています。検索・集計に使う値は列、店舗ごとに増減する付帯情報は JSONB。

### 2-1. 服種マスタ `repair_garment_types`

```jsonc
{
  "id": "gt_uuid",
  "store_id": "store_uuid",
  "code": "jacket",                 // 安定キー（UIアイコン・集計キー）
  "name": "上着（ブレザー・学ラン）",
  "icon": "🧥",
  "sort_order": 10,
  "active": true,
  // 学校・性別での絞り込みに使う任意タグ（無ければ全対象）
  "applies_to": {
    "genders": ["male", "female", "unisex"],
    "school_ids": []                // 空＝全校共通。指定があればその学校だけ
  },
  "created_at": "...", "updated_at": "..."
}
```

### 2-2. 項目マスタ `repair_items`（基本料金はここ）

```jsonc
{
  "id": "it_uuid",
  "store_id": "store_uuid",
  "garment_type_id": "gt_uuid",     // どの服種にぶら下がるか
  "code": "hem",                    // 既存 RepairType と対応（hem/sleeve/waist/embroidery/badge/button/tear...）
  "name": "裾上げ",
  "icon": "✂️",

  // ── 基本料金（課題の「基本料金」） ──
  "base_price": 1200,               // 税抜 or 税込は store 設定に従う（§6）
  "price_unit": "per_item",         // per_item | per_pair(2本一組) | per_cm | per_name(刺繍文字)
  "tax_mode": "inherit",            // inherit | tax_in | tax_out

  // ── 採寸入力（受付で数値を聞く項目） ──
  "measurements": [
    { "key": "hem_length_mm", "label": "仕上がり丈", "unit": "mm", "required": true },
    { "key": "fold_keep_mm",  "label": "折り返し残し", "unit": "mm", "required": false }
  ],

  // ── このボタンを押すと出るオプション群（§2-3を参照） ──
  "option_group_ids": ["og_thread", "og_finish"],

  // ── 特殊ケース誘導：このマニュアルを受付時に出す ──
  "manual_ids": ["mn_special_fabric"],

  // ── 標準納期（営業日）。空欄なら店舗デフォルト ──
  "lead_time_days": 5,

  // ── 個別見積もり強制フラグ ──
  "requires_quote": false,          // true の項目は金額を空で受付→見積もり待ちにできる

  "sort_order": 10, "active": true,
  "extra": {}                       // 店舗独自の任意フィールド（将来拡張用 JSONB）
}
```

**ポイント**
- `price_unit` で「2本一組（スラックス）」「cm単価」「刺繍1文字単価」など煩雑な単価ルールを表現。
- `measurements` を JSONB 配列で持つことで、項目ごとに「聞くべき数字」をマスタ側から制御 → アルバイトの入力漏れを防止。
- `base_price` はあくまで**標準値**。受付時に明細へコピーされ、そこから加算/上書きされる。

### 2-3. オプションマスタ `repair_option_groups` / `repair_options`

オプションは「グループ（排他 or 複数選択）」＋「選択肢」の2段で持つと、UI（ラジオ/チェック）にそのまま対応します。

```jsonc
// グループ
{
  "id": "og_thread",
  "store_id": "store_uuid",
  "name": "ステッチ・仕様",
  "select_type": "multi",           // single(ラジオ) | multi(チェック)
  "required": false,
  "sort_order": 10
}
```

```jsonc
// 選択肢（1つ1つが価格差分を持つ）
{
  "id": "op_chidori",
  "store_id": "store_uuid",
  "group_id": "og_thread",
  "code": "chidori",
  "name": "千鳥がけ",
  "price_delta": 300,               // ＋加算。マイナスも可（割引・素材違いの減額）
  "price_unit": "per_item",
  "default_selected": false,
  "manual_ids": [],                 // この選択肢固有の注意画像があれば
  "requires_quote": false,          // 「特殊素材」など、選ぶと自動で見積もりモードへ
  "sort_order": 10, "active": true,
  "extra": {}
}
```

**価格計算ロジック（マスタ正規時）**

```
明細金額 = (item.base_price × 数量係数)
         + Σ option.price_delta（選択したオプション）
         + （per_cm/per_name 等の従量計算）

  数量係数: per_item → qty,  per_pair → qty(=本数), per_cm → 長さcm, per_name → 文字数
```

擬似コード:

```ts
function calcLinePrice(item, selectedOptions, inputs) {
  const factor =
    item.price_unit === 'per_cm'   ? inputs.length_cm :
    item.price_unit === 'per_name' ? inputs.char_count :
    /* per_item / per_pair */        inputs.qty ?? 1;

  let price = item.base_price * factor;
  for (const op of selectedOptions) {
    price += op.price_delta * (op.price_unit === item.price_unit ? factor : 1);
  }
  return Math.round(price);
}
```

---

## 3. 個別見積もり（マスタにない特殊対応）のロジック

課題「マスタを崩さずに柔軟に金額を入力したい」への回答。**明細行（line）ごとに価格モードを持たせる**のが要点です。

```jsonc
// repair_order_lines の price 部分
{
  "pricing_mode": "master",         // master | adjusted | manual
  "item_snapshot": { /* §4参照 */ },
  "calculated_price": 1500,         // マスタ計算で出た理論値（参考保持）
  "final_price": 1500,              // 実際に請求する確定額（ここが正）
  "manual_reason": null,            // manual/adjusted のとき必須メモ
  "quote_status": "fixed"           // fixed | pending（見積もり待ち）| approved
}
```

| pricing_mode | 使う場面 | 挙動 |
|---|---|---|
| `master` | 通常 | マスタ計算値 = 確定額。スタッフは金額に触れない。 |
| `adjusted` | マスタ項目だが今回だけ値引き/割増 | 計算値を出した上で `final_price` を手で上書き。`manual_reason` 必須（「常連割引」等）。差額がログに残る。 |
| `manual` | **マスタに無い特殊対応** | 項目＝「特殊対応／その他」を選び、`item_name` を自由入力、`final_price` を直接入力。`quote_status='pending'` で金額未定のまま受付も可能。 |

**「金額未定で受付 → 後から見積もり」フロー**
1. 受付：`manual` 行を `final_price=null, quote_status='pending'` で起票（既存 `request_type='repair_consult'` 相当に対応）。
2. 採寸・職人確認後：`final_price` を入れて `quote_status='approved'`。
3. 顧客承認の通知（LINE）→ `fixed`。承認前は作業着手不可、というガードを `quote_status` で表現できる。

> こうすることで **マスタの価格表は一切汚さず**、同じ伝票の中に「正規価格の裾上げ」と「個別見積もりの特殊補修」を1会計で同居させられます。集計時は `pricing_mode='master'` だけ拾えば正規売上、`manual` を別集計すれば「マスタ化候補（よく出る特殊対応）」の発見にもなります。

---

## 4. 画像管理：参考画像 vs 実績写真

**役割が全く違うので、テーブルを分ける**のが鉄則です。混ぜると権限・ライフサイクル・表示文脈が破綻します。

| 観点 | 参考画像（マニュアル） | 実績写真 |
|---|---|---|
| 目的 | 接客ミス防止・作業指示の標準 | 状態証跡・トラブル防止・履歴 |
| 紐づく先 | **マスタ**（項目/オプション） | **伝票/明細**（1件の受付） |
| 件数 | 少・使い回す | 多・受付ごとに増える |
| 更新 | 店長が整備 | 現場が撮影 |
| 消えてはいけない理由 | マニュアル | クレーム対応の証拠 |

### 4-1. 参考画像 `repair_manuals`（マスタ側）

```jsonc
{
  "id": "mn_special_fabric",
  "store_id": "store_uuid",
  "title": "特殊素材（撥水・防シワ）の裾上げ注意",
  "body": "アイロン温度に注意。千鳥不可。要・職人確認。",
  "severity": "warn",               // info | warn | danger（受付UIでの色分け）
  "images": [
    { "path": "manuals/special_fabric_1.jpg", "caption": "縫い目NG例" }
  ],
  "active": true
}
```
- 項目/オプションの `manual_ids` から参照。受付で対象を選ぶと**自動でモーダル表示**し、`severity=danger` は確認チェック必須にできる。
- 過去の難対応はここに「ナレッジ」として蓄積 → 属人化の解消（ドメイン課題の「口頭伝承で誤受注」に対応）。

### 4-2. 実績写真 `repair_photos`（トランザクション側）

```jsonc
{
  "id": "ph_uuid",
  "store_id": "store_uuid",
  "order_id": "ro_uuid",
  "line_id": "rol_uuid",            // 明細単位。全体写真なら null
  "phase": "intake",                // intake(受付前) | before(加工前) | after(完成) | rework(再加工) | delivery(お渡し)
  "path": "repairs/2026/ro_uuid/intake_01.jpg",  // Supabase Storage パス
  "note": "右袖ほつれ既存",
  "taken_by": "staff_uuid",
  "taken_at": "2026-06-14T02:30:00Z"
}
```
- `phase` で「受付時」「完了時」を区別（目標③）。受付前の `intake` を残すと「元から汚れていた」等のトラブルに強い。
- 画像実体は **Supabase Storage**、DBには **パスとメタのみ**（既存方針と同様、DBに base64 は持たない）。
- バケットは `manuals/`（公開・キャッシュ可）と `repairs/`（非公開・署名URL）で分離。

---

## 5. データフロー（現場オペレーション）

```
受付（アルバイト）
  1. 顧客/お子様を検索 or 新規（既存 customers/children を再利用）
  2. [服種] を選ぶ ──▶ 該当する [項目] ボタンだけ表示
  3. [項目] を選ぶ ──▶ base_price 表示・採寸入力・[オプション] 表示
        └─ manual_ids があれば注意モーダル（danger は確認必須）
  4. [オプション] 選択 ──▶ 金額がリアルタイム加算
  5. マスタに無い？ ──▶「特殊対応(manual)」行を追加→金額未定でも可
  6. 📷 受付前写真（intake）を撮影
  7. 納期＝Σ lead_time_days の最大 or 個別見積もり待ち
  8. 伝票確定 → slip_number 発行・控え（LINE/印刷）

作業（職人/内製・外注）
  9. 着手（work_started）。pending 見積もりは承認後のみ着手可
  10. 完成 → 📷 完成写真（after）→ status=completed → LINE通知

お渡し
  11. 最終確認・📷 delivery（任意）→ status=delivered・入金
  12. 再加工なら rework 行＋📷 rework で履歴に残す
```

価格の確定タイミング:
- **受付時**にマスタ値を `item_snapshot` としてコピー（後の価格改定の影響を受けない）。
- 見積もり行のみ後追いで `final_price` 確定。

---

## 6. 補足：店舗設定・税

```jsonc
// store 単位の repair 設定（stores.settings JSONB など）
{
  "repair": {
    "tax_mode": "tax_in",           // tax_in | tax_out
    "tax_rate": 0.10,
    "default_lead_time_days": 7,
    "require_intake_photo": true,   // 受付前写真を必須化
    "allow_pending_quote": true
  }
}
```

---

## 7. 既存テーブルとの接続・段階移行

現状 `repair_histories`（1行＝1受付・単一 price・自由テキスト content）からの無理のない移行案:

| 段階 | 内容 | リスク |
|---|---|---|
| **Phase 1** | マスタ3表（garment/item/option）＋ `repair_manuals` ＋ `repair_photos` を**新規追加**。`repair_histories` はそのまま。受付UIで「マスタ選択 → content 文字列＋price を自動生成」して既存テーブルに書く。 | 極小（既存破壊なし） |
| **Phase 2** | `repair_orders` / `repair_order_lines` を新設し、明細・pricing_mode・スナップショットを正式運用。`repair_histories` は読み取り互換ビューに。 | 中 |
| **Phase 3** | 集計・実績ダッシュボード（manual行の頻出→マスタ化提案、再加工率、項目別売上）。 | 低 |

Phase 1 だけでも「服種>項目>オプション選択」「マニュアル表示」「写真保存」「個別見積もり」の4目標は満たせます（明細の多段持ちは Phase 2 で正規化）。

### 既存コードとの整合
- `RepairType`（hem/sleeve/waist/embroidery/badge/button/tear/size_exchange/other）は `repair_items.code` の初期シードにそのまま流用可能。
- 既存の `hem_length_mm` / `sleeve_adjust_mm` / `waist_adjust_mm` / `embroidery_*` 列は、新スキーマでは `measurements`（マスタ定義）＋ `line.inputs`（実値 JSONB）へ一般化される。
- `customers` / `children` / `slip_number` / LINE通知（`notified`）の仕組みは変更なしで再利用。

---

## 8. テーブル一覧（まとめ）

| テーブル | 区分 | 役割 |
|---|---|---|
| `repair_garment_types` | マスタ | 服種（上着/スラックス/スカート…） |
| `repair_items` | マスタ | 項目＝**基本料金**・採寸定義・納期 |
| `repair_option_groups` | マスタ | オプションのグループ（排他/複数） |
| `repair_options` | マスタ | オプション選択肢＝**価格差分** |
| `repair_manuals` | マスタ | 参考画像・特殊ケース注意書き |
| `repair_orders` | 取引 | 受付伝票ヘッダ（顧客・納期・合計） |
| `repair_order_lines` | 取引 | 明細＝マスタのスナップショット＋確定金額＋見積もりモード |
| `repair_photos` | 取引 | 実績写真（intake/after/rework/delivery） |

---

### 設計の効きどころ（要約）
- **基本料金＋オプション加算の煩雑さ** → `base_price`（項目）＋ `price_delta`（オプション）＋ `price_unit`（従量）で構造化。
- **アルバイトの直感操作** → `服種>項目>オプション` の段階表示＋採寸入力のマスタ強制。
- **特殊ケースの接客ミス** → `repair_manuals` を選択時に自動表示（danger は確認必須）。
- **写真の実績保存** → `repair_photos.phase` で受付/完了を区別、Storage にパス保存。
- **個別見積もり** → 明細単位 `pricing_mode=manual` ＋ `quote_status=pending/approved` でマスタを汚さず吸収。
