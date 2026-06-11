# かんたんLINEモード & 置くだけスキャン

60代スタッフが半数の販売店でも回る「覚えることがないデジタル化」の実装。
設計思想:**スタッフにデジタルを使わせるのではなく、いつもの動作からデータが勝手に残る。**

- **かんたんLINEモード** — 管理画面を開かず、店のLINEへの返信だけで運用する
- **置くだけスキャン** — 接客後の承り書・メモをトレーに置くと自動撮影 → AIが種別判定・構造化登録

---

## 1. かんたんLINEモード

### スタッフの体験

1. 店主が管理画面(設定 → かんたんLINEモード)で**6桁の登録コード**を発行
2. スタッフが店のLINE公式アカウントに「`スタッフ登録 123456`」と送信 → 登録完了
3. 「`きょう`」と送ると**今日のやることリスト**が番号付きで届く
   - 納期が来ているお直し(仕上げる)
   - 作業完了済み・未渡し(お渡しする)
   - 入荷済み・未連絡(入荷連絡する)
4. 終わったら「`1できた`」と返信 → ステータスが進み、**お客様への完了/入荷連絡LINEまで自動送信**
   - 「`1、2できた`」「`ぜんぶできた`」も可
5. 管理画面の「いまスタッフ全員に送る」ボタンで手動配信(朝礼代わり)

### 実装

| ファイル | 役割 |
|---|---|
| `lib/kantan.ts` | タスク生成・LINE送信・返信パース・完了時のステータス遷移 |
| `app/api/webhook/route.ts` | スタッフ登録・「きょう」「1できた」の処理(既存webhookを拡張) |
| `app/api/kantan/briefing/route.ts` | タスクリスト生成+スタッフ全員へ配信(PIN認証) |
| `app/[storeId]/admin/settings/kantan/page.tsx` | コード発行・スタッフ管理・手動配信 |

タスク完了時の遷移:

| タスク種別 | 完了時の処理 |
|---|---|
| `repair_finish` | `repair_histories.status` → `completed` + お客様へ仕上がり連絡(LINE連携時) |
| `repair_deliver` | `repair_histories.status` → `delivered` |
| `purchase_notify` | `purchase_orders.notified` → `true` + お客様へ入荷連絡(LINE連携時) |

## 2. 置くだけスキャン

### スタッフの体験

1. タブレットをトレーの上に固定し、`/{storeId}/admin/tray-scan` を開いておく(PIN認証)
2. 接客が終わったら、書いた承り書・メモを**トレーに置くだけ**
3. カメラが「紙が置かれて静止した」を検知して自動撮影 → AIが種別を自動判定
   - ✂️ お直し / 🛍️ ご注文 / 📝 メモ・問合せ
4. 特大ボタンの確認画面:「**✓ これで登録**」「あとで直す」「📷 やり直す」
5. 登録すると顧客を電話番号・氏名で自動照合(なければ自動作成)し、実レコードを作成
   - お直し → `repair_histories`(受付済み)
   - 注文 → `uniform_orders` + 明細
   - メモ → `inquiries`
6. 「あとで直す」は**受信箱**(`/tray-scan/inbox`)に残り、修正してから登録できる

### 実装

| ファイル | 役割 |
|---|---|
| `app/[storeId]/admin/tray-scan/page.tsx` | キオスク画面(フレーム差分による置紙検知・自動撮影) |
| `app/[storeId]/admin/tray-scan/inbox/page.tsx` | 受信箱(修正・登録・破棄) |
| `app/api/slip-ocr/route.ts` | `slipType: 'auto'` を追加(種別自動判定) |
| `lib/scanPromote.ts` | 読取結果の表示整形・顧客照合・実レコードへの昇格 |

## 3. 導入手順

1. **DBマイグレーション**: `supabase/migrations/20260611_kantan_mode.sql` を Supabase SQL Editor で実行
   - 新テーブル: `staff_line_accounts` / `kantan_tasks` / `scan_inbox`
   - `stores.staff_link_code` カラム追加
2. **機能フラグ**: super-admin で対象店舗のプランを「🍀 かんたんLINE」にするか、
   個別フラグ `kantan_line` / `tray_scan` を有効化(フルプランは標準で有効)
3. **LINE**: 既存の uniform チャンネルをそのまま使用。追加設定不要
   (webhook が `スタッフ登録` などのテキストを処理するようになる)
4. **タブレット**: 置くだけスキャンはカメラ権限が必要。HTTPSのみ動作(Vercel上は問題なし)

## 4. 今後の拡張候補

- 朝の自動配信(Vercel Cron → `/api/kantan/briefing` を全店舗分呼び出し)
- 「1とりけし」での完了取り消し
- 置くだけスキャンの読取精度ログ(confidence別の修正率)を蓄積 → プロンプト改善
- 受信箱の未処理件数をかんたんLINEのタスクに含める
