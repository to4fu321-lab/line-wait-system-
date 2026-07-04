# Supabase 型の自動生成と `as any` の段階的削減

## 背景

コードベースには `(supabase as any)` が約500箇所ある。原因は
`types/database.ts` が手書きで、実際のテーブル（customers / children /
repair_histories / purchase_orders / schools / shifts / register_sessions
など）を網羅していないこと。型が無いテーブルを触るたびに `as any` で
逃げる構造になっており、カラム名の typo や存在しないステータス値の
代入がコンパイル時に検出できない。

## 手順（ローカルで一度だけ実行）

```bash
# 1. Supabase CLI をインストール（未導入の場合）
npm install -g supabase

# 2. アクセストークンを設定（https://supabase.com/dashboard/account/tokens で発行）
export SUPABASE_ACCESS_TOKEN=sbp_xxx

# 3. 型を生成（package.json に script 追加済み）
npm run gen:types
# → types/supabase.ts が生成される
```

## 生成後の切り替え方

1. `lib/supabase.ts` と `lib/supabaseAdmin.ts` の型パラメータを差し替える:

```ts
import type { Database } from '@/types/supabase'  // ← 生成された型
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, ...)
```

2. `types/database.ts` の手書き `Database` 型は削除し、`Queue` / `Store` などの
   エイリアスは生成型から導出する:

```ts
import type { Database } from '@/types/supabase'
export type Queue = Database['public']['Tables']['queues']['Row']
export type Store = Database['public']['Tables']['stores']['Row']
```

   （`CATEGORY_LABELS` などの定数・`getWaitMessage` はそのまま残す）

3. `(supabase as any).from('x')` を `supabase.from('x')` に機械置換し、
   `npx tsc --noEmit` のエラーを潰す。一括でやらず、画面単位で
   少しずつ進めるのが安全:

```bash
# 対象ファイルの as any を外して型エラーを確認
sed -i "s/(supabase as any)/supabase/g" app/[storeId]/admin/page.tsx
npx tsc --noEmit
```

4. スキーマ変更（テーブル・カラム追加）をしたら必ず `npm run gen:types` を
   再実行してコミットに含める。

## 注意

- 生成型を導入するまでは `as any` を新規に増やさないこと。
  新しいテーブルを触る場合は先に型を生成する。
- `next.config.mjs` の `ignoreBuildErrors: true` により型エラーがあっても
  Vercel のビルドは通ってしまう。push 前の `npx tsc --noEmit` を習慣に
  すること（CI を導入するならここを必須チェックにする）。
