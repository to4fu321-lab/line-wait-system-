'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { BottomNav } from '../_components/BottomNav'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import type { FeatureKey } from '@/lib/features'

type Step = { title: string; body: string }
// feature を付けた要素は、その機能が有効な店舗にだけ表示する（未指定＝常に表示）
type Section = { emoji: string; title: string; lead?: string; steps: Step[]; feature?: FeatureKey }
type CanDo = { problem: string; solution: string; feature?: FeatureKey }

// このシステムで「何ができるか」— 困りごとベースの一覧（機能に応じて出し分け）
const CAN_DO: CanDo[] = [
  { problem: '採寸会や店頭で行列ができて大混乱', solution: 'LINEで整理番号を自動発行。呼び出しもLINEで自動通知', feature: 'tab_queue' },
  { problem: '電話が鳴りやまない', solution: 'お客様がLINEで予約・状況確認できるので電話が減る', feature: 'tab_queue' },
  { problem: '学校ごとのルールを覚えきれない', solution: '学校マスターに登録しておけば、検索一発で確認できる', feature: 'school_master' },
  { problem: 'お直しの受け渡し漏れ', solution: '完成したらLINEで自動通知→お渡し漏れを防止', feature: 'tab_repairs' },
  { problem: '発注の締切を忘れる', solution: '締切が近づくと管理画面にアラートが表示される', feature: 'repairs_tab_purchase' },
  { problem: 'お会計・売上の記録がバラバラ', solution: 'レジ機能でその場で会計・売上を記録できる', feature: 'pos' },
]

// はじめての操作 — 初期設定のステップ（機能に応じて出し分け）
const SETUP: Section[] = [
  {
    emoji: '①',
    title: 'まずは管理画面を開く',
    lead: 'スマホでもパソコンでも使えます。初めての方はまずここから。',
    steps: [
      { title: '管理画面を開く', body: '店舗ごとのURLを開きます。初回はPIN番号（管理者から受け取った数字）を入力します。' },
      { title: 'スマホとPCの切り替え', body: '画面下の「設定」→「PCモードに切替」で大きな画面表示に、スマホで使うときは「スマホモードに切替」に戻せます。' },
    ],
  },
  {
    emoji: '②',
    title: '学校マスターを登録する（いちばん大事）',
    lead: '学校ごとの指定品目や締切を最初に登録しておくと、あとの作業がぐっと楽になります。',
    feature: 'school_master',
    steps: [
      { title: '登録場所', body: '「設定」→「学校マスター」から登録します。学校名・読み仮名・指定品目・採寸受付期間・発注締切日などを入力します。' },
      { title: '写真から自動登録（OCR）', body: '学校からもらった案内文やチラシをスマホで撮影すると、品目リストを自動で読み取って登録できます。毎年の更新もこれでOK。' },
    ],
  },
  {
    emoji: '③',
    title: 'スタッフのLINEを登録する',
    lead: '受注完了・お渡しなどの業務通知をLINEで受け取れるようになります。',
    steps: [
      { title: 'QRコードで登録', body: '管理画面のQRコードをスタッフのスマホのLINEで読み取り、「スタッフとして登録」します。1回だけで大丈夫です。' },
    ],
  },
  {
    emoji: '④',
    title: 'テストで動きを確認する',
    lead: '本番前に、テスト用のデータで一度動かしてみると安心です。',
    feature: 'tab_queue',
    steps: [
      { title: 'テスト追加→呼出→完了', body: '「テスト追加」でテスト用の番号を作り、「呼出」→「完了」の順に押して流れを確認します。確認できたらテストデータは削除しておきましょう。' },
    ],
  },
]

// 毎日の操作 — 画面ごとの使い方（機能に応じて出し分け）
const DAILY: Section[] = [
  {
    emoji: '🕒',
    title: '受付管理（順番待ち・予約）',
    feature: 'tab_queue',
    steps: [
      { title: 'お客様の受付', body: 'お客様がQRコードを読み取ると、自動で整理番号がLINEに届きます。読み取れないときは「手動追加」で登録できます。' },
      { title: '呼び出し', body: '対象のお客様の「呼び出す」を押すと、LINEに「お呼びしています」の通知が自動で届きます。' },
      { title: '完了', body: '対応が終わったら「完了」を押します。' },
    ],
  },
  {
    emoji: '📋',
    title: '案件管理（お直し・受注）',
    feature: 'tab_repairs',
    steps: [
      { title: '新規受付', body: '「＋新規」から、顧客名・加工内容（裾上げ・刺繍など）・サイズ・受け取り方法を入力して「受付する」を押します。' },
      { title: '完成の連絡', body: '完成したら対象の案件で「完成・お渡し可能」を押すと、お客様のLINEに自動で通知されます。お渡ししたら「お渡し完了」を押します。' },
    ],
  },
  {
    emoji: '💰',
    title: 'レジ（お会計）',
    feature: 'pos',
    steps: [
      { title: 'お会計する', body: '「レジ」を開き、金額を入力して会計します。売上は自動で記録され、あとから確認できます。' },
    ],
  },
  {
    emoji: '🔍',
    title: '顧客管理',
    feature: 'tab_crm',
    steps: [
      { title: '過去の履歴を探す', body: '名前や学校名で検索して、過去の受注・お直し履歴を確認できます。追加の受注もここから行えます。' },
    ],
  },
]

function StepList({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <div key={sec.title} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <span className="text-2xl leading-none">{sec.emoji}</span>
            <span className="flex-1 text-base font-bold text-gray-800">{sec.title}</span>
          </div>
          <div className="px-5 py-4 space-y-4">
            {sec.lead && <p className="text-sm text-gray-500">{sec.lead}</p>}
            {sec.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{step.title}</p>
                  <p className="text-gray-600 text-sm mt-0.5 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function GuidePage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature } = useStoreFeatures(storeId)

  // その店舗で有効な機能に合わせて、掲載する項目だけに絞り込む
  const canDo = CAN_DO.filter((row) => !row.feature || hasFeature(row.feature))
  const setup = SETUP.filter((sec) => !sec.feature || hasFeature(sec.feature))
  const daily = DAILY.filter((sec) => !sec.feature || hasFeature(sec.feature))

  return (
    <>
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="mb-2">
          <h1 className="text-xl font-bold text-gray-900">使い方ガイド</h1>
          <p className="text-sm text-gray-500 mt-1">
            はじめての方へ。難しい知識がなくても、この順番どおりに進めれば使い始められます。
          </p>
        </div>

        {/* このシステムで何ができるか */}
        {canDo.length > 0 && (
          <section className="mt-6">
            <h2 className="text-base font-bold text-gray-700 mb-2 px-1">📌 このシステムでできること</h2>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white">
              {canDo.map((row) => (
                <div key={row.problem} className="px-4 py-3">
                  <p className="text-sm font-bold text-gray-800">こんなとき：{row.problem}</p>
                  <p className="text-sm text-gray-600 mt-0.5">→ {row.solution}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* はじめての初期設定 */}
        {setup.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-bold text-gray-700 mb-2 px-1">🚀 はじめにやること（初期設定）</h2>
            <StepList sections={setup} />
          </section>
        )}

        {/* 毎日の操作 */}
        {daily.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-bold text-gray-700 mb-2 px-1">📖 毎日の操作</h2>
            <StepList sections={daily} />
          </section>
        )}

        {/* 困ったとき */}
        <section className="mt-8">
          <h2 className="text-base font-bold text-gray-700 mb-2 px-1">❓ 困ったとき</h2>
          <Link
            href={`/${storeId}/admin/qa`}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border-2 border-violet-200 hover:border-violet-400 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
              <HelpCircle size={24} className="text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-violet-700">Q&amp;A・よくある質問</p>
              <p className="text-sm text-gray-500 mt-0.5">操作でつまずいたときはこちら</p>
            </div>
          </Link>
        </section>
      </main>

      <BottomNav />
    </>
  )
}
