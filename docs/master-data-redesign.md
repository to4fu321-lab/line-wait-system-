# マスタデータ管理 再設計ドキュメント

学生服販売店向け業務システムの「マスタデータ管理機能」再構築のための設計案です。
正典スキーマは [`prisma/schema.prisma`](../prisma/schema.prisma)、実DB(Supabase/PostgreSQL)への
適用は本書末尾の SQL を使用します。

---

## 0. 現状分析 — なぜ「複雑に絡み合って」いるか

調査の結果、**「商品」が 3 つの異なるテーブルで二重・三重に表現されている**ことが
保守困難の根本原因でした。

| 現状テーブル | 役割 | 問題点 |
|---|---|---|
| `products` (`school_names text[]`) | 店舗共通商品＋対象校を**配列**で保持 | 配列のため FK 整合性なし。規程・価格を持てない |
| `school_items` | 学校別の用品（価格・規程込み） | 「商品の実体・価格・規程・サイズ」が 1 行に混在 |
| `school_products` + `school_product_variants` | 学校に紐づく商品＋サイズ価格 | **学校ごとに同一商品を重複登録**（同品番が学校数だけ増殖） |

さらにサイズ表現も `products.sizes text[]` / `variants.size_label` / `size_presets` /
`school_items.size_spec` に分散しています。

### 解決の方針 — 「実体・規程・価格・サイズ」を分離する

要件定義の 5 マスタは、この混在を正しく分解する構成になっています。本設計では責務を次のように分けます。

```
Product           = 商品の実体     … 何であるか(メーカー/洗濯可否/標準価格)。1商品1行。
SizeSet           = サイズ規格     … メーカーごとのサイズ展開。Product が参照。
SchoolRequirement = 学校ごとの規程 … 必須/任意・学年色。School × Product の割当。
Price             = 価格           … School × Product × サイズ。別寸(EO)含む。
School / Grade    = 学校・学年     … 既存を踏襲。
```

ポイントは **「商品行を学校数だけ複製しない」**こと。学校との関係は規程テーブルと価格テーブルで表します。

---

## 1. マスタ設計（エンティティ関係）

```
Store ─┬─ School ──── SchoolGrade
       │     │
       │     ├──< SchoolRequirement >── Product ──> SizeSet ──< SizeSetItem
       │     │            (規程)          (実体)      (規格)
       │     └──< Price >─────────────────┘   └─ Supplier(メーカー/仕入先)
       │            (価格, サイズ別/別寸)
       └─ Supplier / SizeSet
```

- **Product** … `school_id` を持つが **nullable**。`null` なら自由商品、値ありなら学校別注品（後述 §2）。
- **SchoolRequirement** … `School × Product` の中間テーブル。「この学校でこの商品は必須/任意」を1行で表現。
- **Price** … `School × Product (× SizeSetItem)`。学校別価格・サイズ別加算・別寸(EO)をここに集約。
  行が無ければ `Product.base_price_*` をフォールバックに使う。

詳細なカラムは `prisma/schema.prisma` を参照してください。

---

## 2. 「自由商品」と「学校別注品」のリレーション設計

> 学校別注品は必ず学校に紐づく。自由商品は全校共通で使えるようにしたい。

### 採用案: nullable オーナー FK ＋ 明示的な中間テーブル

```prisma
model Product {
  schoolId String? // null = 自由商品(全校共通) / 値あり = 学校別注品(その学校専用)
  ...
}
model SchoolRequirement {
  schoolId  String  // 「どの学校で扱うか」はここで表現
  productId String
  @@unique([schoolId, productId])
}
```

| 種別 | `Product.school_id` | 学校への割当方法 |
|---|---|---|
| **自由商品（汎用）** | `null` | 使う学校ごとに `SchoolRequirement` を1行追加して割り当てる |
| **学校別注品** | その学校の `id` | 同様に `SchoolRequirement` を作る（オーナー校に対してのみ） |

**この設計の利点**

1. 採寸接客のクエリが**種別を意識せず統一**できる（どちらも `SchoolRequirement` を引くだけ）。
2. 自由商品の実体は 1 行のみ。価格・名称改定が全校に一括反映される。
3. `school_names text[]` 配列（現状）と違い、FK 整合性が効き、規程の属性（必須/任意・学年色）を割当ごとに持てる。

**整合性ガード**（学校別注品を別の学校に割り当てる事故を防ぐ）。
アプリ層に加え、DB トリガ/制約で担保することを推奨します。

```sql
-- 学校別注品(products.school_id IS NOT NULL)は、その学校以外の規程に登録できない
CREATE OR REPLACE FUNCTION check_requirement_school() RETURNS trigger AS $$
DECLARE owner uuid;
BEGIN
  SELECT school_id INTO owner FROM products WHERE id = NEW.product_id;
  IF owner IS NOT NULL AND owner <> NEW.school_id THEN
    RAISE EXCEPTION '学校別注品(%)は所属校以外に割り当てられません', NEW.product_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_requirement_school
  BEFORE INSERT OR UPDATE ON school_requirements
  FOR EACH ROW EXECUTE FUNCTION check_requirement_school();
```

> **検討した代替案**
> - *配列方式*（現状の `school_names[]`）: 割当ごとの属性を持てず、FK も効かない → 不採用。
> - *自由商品/別注品でテーブル分割*: クエリが UNION だらけになり現場 UI も二重化 → 不採用。
> - *別注品も school_id を持たず純粋に中間テーブルのみで表現*: 「この商品はどの学校の専用設計か」という
>   所有概念が消え、誤って他校へ流用される。所有は `school_id`、利用は中間テーブル、と役割を分けるのが最良。

---

## 3. 採寸接客時のクエリの考え方

> その学校の「必須商品」と「サイズセット」を自動で読み込む。

`school_id` を起点に、規程 → 商品 → サイズセット → 価格 を 1 回のクエリ（または1つの include）で取得します。
自由商品・学校別注品の区別は不要です（§2 の利点）。

### Prisma

```ts
const sheet = await prisma.schoolRequirement.findMany({
  where: { schoolId, required: true },          // 必須のみ。任意込みなら required 条件を外す
  orderBy: { sortOrder: 'asc' },
  include: {
    product: {
      include: {
        supplier: true,
        sizeSet: { include: { items: { orderBy: { sortOrder: 'asc' } } } }, // サイズセット
        prices:  { where: { schoolId } },         // この学校の価格(サイズ別/別寸含む)
      },
    },
  },
})
```

### 生 SQL（採寸シート1枚分を平坦に取得）

```sql
SELECT
  sr.required, sr.uses_grade_color, sr.grade_color_note, sr.avg_qty, sr.sort_order,
  p.id AS product_id, p.name, p.gender, p.maker_code, p.washable,
  ss.id AS size_set_id, ss.name AS size_set_name,
  ssi.id AS size_item_id, ssi.label AS size_label,
  COALESCE(pr.price_tax_in, p.base_price_tax_in) AS price_tax_in, -- 学校別価格→無ければ標準価格
  pr.is_eo
FROM school_requirements sr
JOIN products p           ON p.id = sr.product_id AND p.active
LEFT JOIN size_sets ss    ON ss.id = p.size_set_id
LEFT JOIN size_set_items ssi ON ssi.size_set_id = ss.id
LEFT JOIN prices pr        ON pr.product_id = p.id
                          AND pr.school_id = sr.school_id
                          AND (pr.size_set_item_id = ssi.id OR pr.size_set_item_id IS NULL)
WHERE sr.school_id = $1
  AND sr.required = true            -- 必須商品のみ
ORDER BY sr.sort_order, ssi.sort_order;
```

### Supabase JS（現プロジェクトの実装スタイル）

```ts
const { data } = await supabase
  .from('school_requirements')
  .select(`
    required, uses_grade_color, grade_color_note, avg_qty, sort_order,
    product:products!inner (
      id, name, gender, maker_code, washable, base_price_tax_in,
      size_set:size_sets ( id, name, items:size_set_items ( id, label, sort_order ) ),
      prices:prices ( price_tax_in, is_eo, size_set_item_id, school_id )
    )
  `)
  .eq('school_id', schoolId)
  .eq('required', true)
  .order('sort_order')
```

**考え方のまとめ**
- 採寸シートの「行」= `SchoolRequirement`。これが必須商品の確定リスト。
- 各行の「サイズ選択肢」= `Product.size_set → size_set_items`。メーカー規格を再利用するので表記ゆれが起きない。
- 各サイズの「価格」= `prices`（学校別・サイズ別・別寸）。無ければ `products.base_price_*`。
- 価格は `COALESCE` でフォールバックするため、価格未設定でも採寸自体は止まらない。

---

## 4. 今後の拡張ポイント（在庫管理・オンライン注文連携）

責務を分離したことで、追加機能は**既存マスタに行を足さず、新テーブルを脇に足す**だけで済みます。

### 4-1. 在庫管理

在庫の最小単位（SKU）は **商品 × サイズ** です。本設計では `SizeSetItem`（または商品×サイズの
組み合わせ）が SKU 粒度になります。

- `product_variants`（= 商品×サイズの実体 SKU）を導入し、`barcode` をここへ移すのが理想。
- 在庫は**残数カラムを直接持たず**、入出庫を記録する `stock_ledger`（入庫/採寸引当/販売/返品）にし、
  現在庫はビュー（SUM）で算出 ＝ 棚卸し差異の追跡が可能。
- 採寸時の「取り置き」は引当(reserve)、発注は §3 の集計クエリ（学校×品番×サイズ別 GROUP BY）から CSV 出力。

```sql
CREATE TABLE product_variants (         -- 商品×サイズ = SKU
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_set_item_id uuid REFERENCES size_set_items(id),
  sku text, barcode text,
  UNIQUE(product_id, size_set_item_id)
);
CREATE TABLE stock_ledger (             -- 入出庫履歴(現在庫は SUM で算出)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  delta integer NOT NULL,               -- +入庫 / -出庫
  reason text NOT NULL,                  -- inbound/sold/reserved/return/adjust
  ref_id uuid,                           -- 注文ID等
  created_at timestamptz DEFAULT now()
);
```

### 4-2. オンライン注文連携

- `orders` / `order_items` を追加。`order_items` は `product_id` + `size_set_item_id` + **注文時の価格スナップショット**
  を保持する（後の価格改定で過去注文金額が変わらないように）。
- EC の「学校別カタログ」は、採寸と**同じ** `school_requirements`＋`prices` をそのまま読めば描画できる
  （マスタが単一の真実なので店頭とECで表示がズレない）。
- 在庫引当は `stock_ledger` に `reason='reserved'` で記録し、確定/キャンセルで打ち消す。

```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL, school_id uuid REFERENCES schools(id),
  customer_id uuid, channel text,        -- store/online
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  size_set_item_id uuid REFERENCES size_set_items(id),
  qty integer NOT NULL DEFAULT 1,
  unit_price_tax_in integer NOT NULL,    -- 注文時点の価格スナップショット
  is_eo boolean DEFAULT false
);
```

### 拡張ポイント早見表

| 追加機能 | 接続先 | 既存マスタへの変更 |
|---|---|---|
| 在庫管理 | `product_variants` → `stock_ledger` | なし（脇に追加） |
| 発注集計 | §3 のクエリを GROUP BY | なし |
| オンライン注文 | `orders` / `order_items` → `school_requirements`/`prices` | なし |
| 価格改定履歴 | `prices.valid_from` を使うか履歴テーブル化 | なし |
| 加工(刺繍/お直し) | `order_items` に加工オプション子テーブル | なし |

---

## 5. 移行方針（既存データから）

1. `schools` / `school_grades` … ほぼそのまま流用可。
2. `suppliers` … メーカーとして流用。`size_sets.supplier_id` を紐付け。
3. **商品の名寄せ** … `products`(自由商品) と `school_items`/`school_products`(学校別) を
   `products` に統合。同一実体（同名・同品番・同メーカー）は 1 行へ集約し、学校との関係は
   `school_requirements` に展開。
4. **規程の抽出** … `school_items` の `required/avg_qty/uses_grade_color/...` → `school_requirements`。
5. **価格の抽出** … `school_items.price_*` / `school_product_variants.price` → `prices`
   （別寸は `is_eo=true`、サイズ別は `size_set_item_id` 紐付け）。
6. `size_spec`(テキスト) / `sizes[]` / `size_presets` → `size_sets` + `size_set_items` に正規化。

移行は一度きりの ETL スクリプト（SQL or Node）で実施し、旧テーブルは検証後に `_deprecated` リネーム→削除を推奨します。

---

## 6. Supabase 適用 SQL（参考）

> 既存規約に合わせ、`store_id` スコープ・`handle_updated_at()` トリガ・RLS 全許可ポリシーを踏襲しています。
> 本番適用前にステージング(ブランチDB)で検証してください。

```sql
-- ── 3. サイズセット ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS size_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  name        text NOT NULL,
  category    text,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_size_sets_store ON size_sets(store_id);

CREATE TABLE IF NOT EXISTS size_set_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size_set_id uuid NOT NULL REFERENCES size_sets(id) ON DELETE CASCADE,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  UNIQUE (size_set_id, label)
);
CREATE INDEX IF NOT EXISTS idx_size_set_items_set ON size_set_items(size_set_id);

-- ── 2. 商品(自由商品/学校別注品) ───────────────────────────
CREATE TABLE IF NOT EXISTS products_v2 (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  school_id          uuid REFERENCES schools(id) ON DELETE CASCADE, -- null=自由商品
  name               text NOT NULL,
  category           text,
  gender             text,
  supplier_id        uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  maker_code         text,
  color_code         text,
  barcode            text,
  washable           text,
  size_set_id        uuid REFERENCES size_sets(id) ON DELETE SET NULL,
  base_price_tax_in  integer,
  base_price_tax_out integer,
  notes              text,
  active             boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_v2_store        ON products_v2(store_id);
CREATE INDEX IF NOT EXISTS idx_products_v2_store_school ON products_v2(store_id, school_id);

-- ── 4. 学校別規程 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  school_id        uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES products_v2(id) ON DELETE CASCADE,
  required         boolean NOT NULL DEFAULT true,
  avg_qty          numeric(4,1),
  uses_grade_color boolean NOT NULL DEFAULT false,
  grade_color_note text NOT NULL DEFAULT '',
  item_notes       text NOT NULL DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_school_req_lookup ON school_requirements(school_id, required, sort_order);

-- ── 5. 価格 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products_v2(id) ON DELETE CASCADE,
  size_set_item_id  uuid REFERENCES size_set_items(id) ON DELETE CASCADE, -- null=全サイズ共通
  price_tax_in      integer NOT NULL,
  price_tax_out     integer,
  is_eo             boolean NOT NULL DEFAULT false, -- 別寸(EO)
  cost              integer,
  valid_from        date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- NULL を含む一意制約は COALESCE 式インデックスで担保
CREATE UNIQUE INDEX IF NOT EXISTS uq_prices_scope
  ON prices(school_id, product_id, COALESCE(size_set_item_id, '00000000-0000-0000-0000-000000000000'::uuid), is_eo);
CREATE INDEX IF NOT EXISTS idx_prices_lookup ON prices(school_id, product_id);

-- ── updated_at トリガ & RLS(既存規約踏襲) ─────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['size_sets','products_v2','school_requirements','prices']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION handle_updated_at();', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;
```

> 注: 既存 `products` テーブルと衝突しないよう SQL では `products_v2` 名で例示しています。
> 移行完了後にリネームしてください（`prisma/schema.prisma` 側は `products` にマップ済み）。

---

## 7. 現場 UI への影響（直感操作の最優先）

責務分離により、画面も自然に整理できます。

- **学校マスタ画面**: 学校一覧 → 学校を選ぶと「規程(必須/任意・学年色)」を一覧編集（現状の規定品タブに対応）。
- **商品マスタ画面**: 自由商品/学校別注品をフィルタで切替。商品は 1 か所で名称・メーカー・サイズセットを管理。
- **価格**: 学校×商品の価格は規程画面からインライン編集（標準価格は商品側に1回入力すれば各校に効く）。
- 「商品を増やすたび全校分コピー」が消え、**入力点数が激減**します。
