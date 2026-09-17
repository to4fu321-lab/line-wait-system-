// ── 機能トグルのカタログ（唯一の定義元）────────────────────────
//
//  super-admin の機能トグルは、以前は app/super-admin/page.tsx 内に
//  ラベルだけの配列として置かれていた。そのため
//   ・実際に画面を制御しているのにトグルが無いキー（products / repairs）
//   ・トグルにも無く、どこからも読まれていない死んだキー
//  が混ざり、「LINEの追加購入はどのトグル？」が誰にも分からない状態だった。
//
//  ここを唯一の定義元にして、キー・表示名・効果・出る場所をまとめて持つ。
//  tests/feature-gates.test.ts が
//   「カタログの全キーが実際に読まれている」＋「読まれている全キーがカタログにある」
//  の両方向を機械チェックするので、この対応表がずれることはない。

import type { FeatureKey } from './features'

export type FeatureGroupId =
  | 'nav' | 'work' | 'pos' | 'master' | 'customer' | 'school' | 'shift' | 'addon' | 'dev'

export const FEATURE_GROUPS: { id: FeatureGroupId; label: string; emoji: string; desc: string }[] = [
  { id: 'nav',      label: 'スタッフ画面の下タブ', emoji: '📱', desc: '管理画面の一番下に並ぶタブ' },
  { id: 'work',     label: 'お仕事画面の中身',     emoji: '✂️', desc: 'お仕事タブを開いた先の機能' },
  { id: 'pos',      label: 'レジ・会計',           emoji: '🧾', desc: '会計と売上' },
  { id: 'master',   label: 'マスタ登録',           emoji: '🗂️', desc: '学校・商品・価格などの元データ' },
  { id: 'customer', label: 'お客様がLINEで使う機能', emoji: '💚', desc: 'お客様側のLINEメニューに出るもの' },
  { id: 'school',   label: '学校規定・採寸の連携', emoji: '🏫', desc: '制服店向けの学校連携' },
  { id: 'shift',    label: 'シフト・勤怠',         emoji: '📆', desc: 'スタッフの働き方の管理' },
  { id: 'addon',    label: '通知アドオン',         emoji: '🔔', desc: '契約した店舗だけONにする' },
  { id: 'dev',      label: '開発・検証用',         emoji: '🧪', desc: '本番店舗では基本OFF' },
]

export interface FeatureDef {
  key: FeatureKey
  group: FeatureGroupId
  icon: string
  /** 一覧に出す名前。何の機能かがこれだけで分かる言葉にする */
  label: string
  /** ONにすると何ができるようになるか */
  desc: string
  /** どの画面に現れるか。「探しても見つからない」を無くすための道案内 */
  where: string
}

export const FEATURE_CATALOG: FeatureDef[] = [
  // ── 📱 スタッフ画面の下タブ ───────────────────────────────
  {
    key: 'tab_queue', group: 'nav', icon: '🔢',
    label: '受付・順番待ち',
    desc: '番号札の発行と順番待ちの管理。お客様LINEの「順番待ち」ボタンもこれで出る',
    where: '下タブ「順番待•予約」／設定→順番待ちQR POP',
  },
  {
    key: 'tab_repairs', group: 'nav', icon: '✂️',
    label: 'お仕事タブ',
    desc: '預かり品と作業の一覧。お直し・発注・お渡しの入口',
    where: '下タブ「お仕事」',
  },
  {
    key: 'tab_inquiries', group: 'nav', icon: '💬',
    label: '問合せタブ',
    desc: 'お客様からの問合せを受けて返信する',
    where: 'お仕事画面の「問合せ」サブタブ',
  },
  {
    key: 'tab_crm', group: 'nav', icon: '👥',
    label: '顧客タブ',
    desc: '保護者・お子様・学校の台帳を見る／登録する',
    where: '下タブ「顧客」',
  },
  {
    key: 'today_tasks_ui', group: 'nav', icon: '📋',
    label: '今日やること画面（β）',
    desc: 'お仕事タブを「今すぐ／今日中／今週」に並べ替えた簡易版に差し替える',
    where: '下タブ「お仕事」が「やること」に変わる',
  },

  // ── ✂️ お仕事画面の中身 ──────────────────────────────────
  {
    key: 'repairs_tab_purchase', group: 'work', icon: '📦',
    label: '発注サブタブ',
    desc: '取り寄せ・発注待ちの商品を管理する',
    where: 'お仕事画面の「発注」タブ',
  },
  {
    key: 'repairs_tab_arrival', group: 'work', icon: '🚚',
    label: '入荷待ちサブタブ',
    desc: '発注済み商品の入荷チェックをする',
    where: 'お仕事画面の「入荷待ち」タブ',
  },
  {
    key: 'repairs_tab_delivery', group: 'work', icon: '🎁',
    label: 'お渡しサブタブ',
    desc: '仕上がった品のお渡し・受け取りを管理する',
    where: 'お仕事画面の「お渡し」タブ',
  },
  {
    key: 'repairs_ocr', group: 'work', icon: '📷',
    label: '伝票の写真読み取り（OCR）',
    desc: '紙の伝票を撮影してAIが内容を自動入力する',
    where: 'お仕事画面の撮影ボタン／設定→伝票OCRテンプレート',
  },
  {
    key: 'kantan_line', group: 'work', icon: '🍀',
    label: 'かんたんLINE運用',
    desc: 'LINEの返信だけで作業を完了にできる、入力を減らした運用',
    where: '設定→かんたんLINE運用',
  },
  {
    key: 'tray_scan', group: 'work', icon: '📥',
    label: '置くだけスキャン',
    desc: 'タグを読み取り機に置くだけで対象の案件を呼び出す',
    where: '設定→置くだけスキャン',
  },

  // ── 🧾 レジ ─────────────────────────────────────────────
  {
    key: 'pos', group: 'pos', icon: '🧾',
    label: 'レジ（会計）',
    desc: '会計・釣銭・売上の集計をする',
    where: '下タブ「レジ」',
  },

  // ── 🗂️ マスタ登録 ───────────────────────────────────────
  {
    key: 'products', group: 'master', icon: '🏫',
    label: '学校・商品・価格マスタ／LINE追加購入',
    desc: '学校・商品・サイズ・価格の登録画面を開けるようにする。'
        + 'あわせてお客様LINEの「追加購入」と、店頭での追加購入入力もこのキーで有効になる',
    where: '設定→学校・商品マスタ／お客様LINEの「追加購入」／店頭の追加購入入力',
  },
  {
    key: 'repairs_master', group: 'master', icon: '📐',
    label: 'お直し料金マスタ',
    desc: 'お直しメニューと料金表を登録する',
    where: '設定→お直し料金マスタ／お直し業者マスタ',
  },

  // ── 💚 お客様がLINEで使う機能 ─────────────────────────────
  {
    key: 'repairs', group: 'customer', icon: '🪡',
    label: 'LINEからのお直し依頼',
    desc: 'お客様LINEに「お直し」を出す大元のスイッチ。'
        + 'OFFにすると下の「セルフ依頼入力」がONでもLINEには出ない',
    where: 'お客様LINEのメニュー',
  },
  {
    key: 'customer_self_intake', group: 'customer', icon: '📱',
    label: 'お客様セルフ依頼入力',
    desc: 'お客様が自分でお直しの内容をLINEから入力できる。店頭だけで受けるならOFF',
    where: 'お客様LINEのお直し依頼フォーム',
  },
  {
    key: 'customer_self_order', group: 'customer', icon: '🛍️',
    label: 'お客様セルフ制服注文',
    desc: 'お客様がLINEから制服を注文できる。上の「学校・商品・価格マスタ」もONが必要',
    where: 'お客様LINEのネット注文',
  },
  {
    key: 'reservation', group: 'customer', icon: '📅',
    label: '採寸予約',
    desc: 'お客様がLINEから採寸の来店予約を取れる',
    where: 'お客様LINEの「予約」／管理画面の予約一覧',
  },
  {
    key: 'line_parent_info', group: 'customer', icon: '💚',
    label: 'LINE保護者情報投稿',
    desc: '保護者がLINEでお子様の情報を送れる',
    where: 'お客様LINE（保護者用アカウント）',
  },
  {
    key: 'line_coupon', group: 'customer', icon: '🎫',
    label: 'クーポン自動配布',
    desc: '条件を満たしたお客様にLINEでクーポンを自動配布する',
    where: 'お客様LINE',
  },
  {
    key: 'takeout', group: 'customer', icon: '🥡',
    label: 'テイクアウト注文',
    desc: '飲食店向けのテイクアウト受付。制服店では使わない',
    where: '業種「テイクアウト」の店舗のみ',
  },

  // ── 🏫 学校規定・採寸の連携 ───────────────────────────────
  {
    key: 'school_ocr', group: 'school', icon: '📄',
    label: '学校規定の写真取込',
    desc: '学校の制服規定表を撮影して商品・サイズを取り込む',
    where: '設定→学校・商品マスタ',
  },
  {
    key: 'school_crm_card', group: 'school', icon: '👤',
    label: '顧客画面の学校規定カード',
    desc: '顧客の詳細画面にその学校の規定を表示する',
    where: '顧客画面のお客様詳細',
  },
  {
    key: 'school_measurement', group: 'school', icon: '📐',
    label: '採寸パネル（アイテム別）',
    desc: '制服アイテムごとの採寸値を入力する',
    where: '試着・採寸画面',
  },
  {
    key: 'school_waiting', group: 'school', icon: '🖥',
    label: '顧客待機サイネージ',
    desc: '待合のディスプレイに呼び出し状況を映す',
    where: 'お客様向け待機画面',
  },

  // ── 📆 シフト・勤怠 ──────────────────────────────────────
  {
    key: 'shift_management', group: 'shift', icon: '📆',
    label: 'シフト管理',
    desc: 'シフト表の作成と共有。この配下の機能すべての大元',
    where: '設定→シフト管理／スタッフ画面',
  },
  {
    key: 'shift_attendance', group: 'shift', icon: '⏰',
    label: '出退勤打刻',
    desc: 'スタッフが出勤・退勤を打刻する',
    where: 'スタッフ画面／受付画面の打刻ボタン',
  },
  {
    key: 'shift_leave', group: 'shift', icon: '🏖️',
    label: '休暇申請',
    desc: 'スタッフが休みを申請し、店長が承認する',
    where: 'スタッフ画面／シフト管理',
  },
  {
    key: 'shift_swap', group: 'shift', icon: '🔄',
    label: 'シフト交換',
    desc: 'スタッフ同士でシフトを代わってもらう',
    where: 'スタッフ画面／シフト管理',
  },
  {
    key: 'shift_inter_store', group: 'shift', icon: '🤝',
    label: '店舗間ヘルプ',
    desc: '人手が足りない店へ他店から応援を頼む',
    where: 'シフト管理／スタッフ画面',
  },
  {
    key: 'staff_push', group: 'shift', icon: '🔔',
    label: 'スタッフPWA通知',
    desc: 'シフト確定や応援依頼をスタッフのスマホへ通知する',
    where: 'スタッフ画面',
  },
  {
    key: 'shift_demand', group: 'shift', icon: '📊',
    label: '試着連動・人員設計',
    desc: '試着予約の入り方から必要人数を見積もる',
    where: 'シフト管理',
  },
  {
    key: 'shift_dashboard', group: 'shift', icon: '📈',
    label: '経営ダッシュボード',
    desc: '人件費や稼働の状況をまとめて見る',
    where: 'シフト管理',
  },
  {
    key: 'shift_ai', group: 'shift', icon: '🤖',
    label: 'AIシフト（生成・補充・申請）',
    desc: 'シフト案をAIが作り、欠員の補充も提案する',
    where: 'シフト管理',
  },

  // ── 🔔 通知アドオン ──────────────────────────────────────
  {
    key: 'sms_notify', group: 'addon', icon: '📩',
    label: 'SMS完了通知（アドオン）',
    desc: '仕上がりをSMSで自動通知する。OFFだと画面は「電話で連絡」の案内になる',
    where: 'お仕事画面の完了操作',
  },

  // ── 🧪 開発・検証用 ──────────────────────────────────────
  {
    key: 'repairs_dummy', group: 'dev', icon: '🗄️',
    label: 'テストデータ生成',
    desc: '動作確認用のダミー案件を作るボタンを出す',
    where: 'お仕事画面',
  },
]

/** グループ順に並べたカタログ（UIはこの順で描く） */
export const FEATURE_CATALOG_BY_GROUP = FEATURE_GROUPS.map(group => ({
  group,
  features: FEATURE_CATALOG.filter(f => f.group === group.id),
}))

export const FEATURE_KEYS_IN_CATALOG: FeatureKey[] = FEATURE_CATALOG.map(f => f.key)
