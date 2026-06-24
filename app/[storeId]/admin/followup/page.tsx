'use client'

// ============================================================
// 在校生フォロー通知ページ
// 入学年を登録した生徒の保護者へ、学年・学校別に一斉LINE送信
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Send, Users, MessageCircle, CheckCircle2,
  AlertCircle, Loader2, School, Filter, RefreshCw
} from 'lucide-react'
import { BottomNav } from '../_components/BottomNav'

interface ChildRecord {
  id: string
  name: string
  kana: string | null
  school_name: string | null
  grade: string | null
  admission_year: number | null
  customer: { id: string; name: string; line_user_id: string | null } | null
}

const CURRENT_YEAR = new Date().getFullYear()

// 入学年度から現在の学年を計算
function calcGrade(admissionYear: number): string {
  const diff = CURRENT_YEAR - admissionYear
  // 4月以降を新学年とみなす
  const gradeOffset = new Date().getMonth() >= 3 ? 0 : 1
  const grade = diff + 1 - gradeOffset
  if (grade <= 0 || grade > 3) return `${admissionYear}年度入学`
  return `${grade}年生`
}

// 入学年度から中学/高校を推定（3年制想定）
function calcSchoolType(admissionYear: number): string {
  const grade = parseInt(calcGrade(admissionYear))
  if (isNaN(grade)) return ''
  return `${CURRENT_YEAR - admissionYear + (new Date().getMonth() >= 3 ? 1 : 0)}年目`
}

const MESSAGE_TEMPLATES = [
  {
    key: 'summer',
    label: '夏服受付のご案内',
    text: '{{name}}さん保護者様\n\n夏服・スポーツウェアの受付が始まりました。昨年のサイズを確認してからお越しいただくとスムーズです。お気軽にご来店ください。',
  },
  {
    key: 'growth',
    label: '成長対応のご案内',
    text: '{{name}}さん保護者様\n\n進級のシーズンです。制服の袖丈・裾丈がきつくなっていませんか？お直し・サイズ交換のご相談をお受けしています。',
  },
  {
    key: 'graduation',
    label: '卒業シーズンのご案内',
    text: '{{name}}さん保護者様\n\nご卒業まであと少しですね。礼服・スーツのご準備はお済みですか？卒業式に向けたご相談をお受けしています。',
  },
  {
    key: 'custom',
    label: 'カスタムメッセージ',
    text: '',
  },
]

export default function FollowupPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [children, setChildren]     = useState<ChildRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [templateKey, setTemplateKey] = useState('summer')
  const [customMsg, setCustomMsg]   = useState('')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterSchool, setFilterSchool] = useState<string>('all')
  const [sending, setSending]       = useState(false)
  const [result, setResult]         = useState<{ sent: number; skipped: number; errors: number } | null>(null)

  const fetchChildren = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/followup-notify?storeId=${storeId}`)
      const json = await res.json()
      if (json.ok) setChildren(json.children ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchChildren() }, [fetchChildren])

  // 学年リスト（重複なし）
  const gradeOptions = useMemo(() => {
    const set = new Set<string>()
    children.forEach(c => {
      if (c.admission_year) set.add(calcGrade(c.admission_year))
    })
    return Array.from(set).sort()
  }, [children])

  // 学校リスト（重複なし）
  const schoolOptions = useMemo(() => {
    const set = new Set<string>()
    children.forEach(c => { if (c.school_name) set.add(c.school_name) })
    return Array.from(set).sort()
  }, [children])

  // フィルタ済みリスト
  const filtered = useMemo(() => children.filter(c => {
    if (filterGrade !== 'all' && c.admission_year && calcGrade(c.admission_year) !== filterGrade) return false
    if (filterSchool !== 'all' && c.school_name !== filterSchool) return false
    return true
  }), [children, filterGrade, filterSchool])

  const lineConnected = filtered.filter(c => c.customer?.line_user_id)
  const notConnected  = filtered.filter(c => !c.customer?.line_user_id)

  const selectedTemplate = MESSAGE_TEMPLATES.find(t => t.key === templateKey)
  const message = templateKey === 'custom' ? customMsg : (selectedTemplate?.text ?? '')

  const toggleAll = () => {
    if (selectedIds.size === lineConnected.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(lineConnected.map(c => c.id)))
    }
  }

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (!message.trim() || selectedIds.size === 0) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/followup-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, childIds: Array.from(selectedIds), message }),
      })
      const json = await res.json()
      if (json.ok) setResult({ sent: json.sent, skipped: json.skipped, errors: json.errors })
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-black text-gray-900">在校生フォロー通知</h1>
          <p className="text-[11px] text-gray-500">入学年を登録した生徒の保護者にLINEを一斉送信</p>
        </div>
        <button onClick={fetchChildren} className="ml-auto p-2 rounded-xl hover:bg-gray-100">
          <RefreshCw size={16} className="text-gray-500" />
        </button>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        {/* 送信結果 */}
        {result && (
          <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${result.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <CheckCircle2 size={18} className={result.errors > 0 ? 'text-red-500' : 'text-emerald-500'} />
            <div>
              <p className="text-sm font-black text-gray-800">送信完了</p>
              <p className="text-xs text-gray-500">
                送信成功: {result.sent}件 / LINE未連携スキップ: {result.skipped}件
                {result.errors > 0 && ` / エラー: ${result.errors}件`}
              </p>
            </div>
          </div>
        )}

        {/* フィルター */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-700">絞り込み</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500 font-bold mb-1 block">学年</label>
              <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setSelectedIds(new Set()) }}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
                <option value="all">すべて</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 font-bold mb-1 block">学校</label>
              <select value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setSelectedIds(new Set()) }}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
                <option value="all">すべて</option>
                {schoolOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 対象者サマリー */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">対象者</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-black px-2 py-0.5 rounded-full">{filtered.length}名</span>
            </div>
            <button onClick={toggleAll}
              className="text-xs font-bold text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50">
              {selectedIds.size === lineConnected.length ? '全解除' : 'LINE連携者を全選択'}
            </button>
          </div>

          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-indigo-400" size={24} /></div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <School size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">入学年が登録されている生徒がいません</p>
              <p className="text-xs text-gray-400 mt-1">CRM → お子様情報 → 入学年度を登録してください</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {lineConnected.map(child => (
                <label key={child.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${selectedIds.has(child.id) ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'}`}>
                  <input type="checkbox" className="shrink-0 accent-indigo-600"
                    checked={selectedIds.has(child.id)}
                    onChange={() => toggle(child.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{child.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {child.school_name ?? '学校未設定'} ·
                      {child.admission_year ? ` ${calcGrade(child.admission_year)}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">LINE✓</span>
                </label>
              ))}
              {notConnected.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] text-gray-400 font-bold px-2 mb-1">LINE未連携（送信不可）</p>
                  {notConnected.map(child => (
                    <div key={child.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 opacity-50">
                      <div className="w-4 h-4 rounded border border-gray-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-500 truncate">{child.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {child.school_name ?? '学校未設定'} ·
                          {child.admission_year ? ` ${calcGrade(child.admission_year)}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">LINE未連携</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* メッセージテンプレート */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-700">送信メッセージ</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MESSAGE_TEMPLATES.map(t => (
              <button key={t.key}
                onClick={() => setTemplateKey(t.key)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${templateKey === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {templateKey === 'custom' ? (
            <textarea
              value={customMsg}
              onChange={e => setCustomMsg(e.target.value)}
              placeholder="メッセージを入力&#10;{{name}} でお子様の名前に置換されます"
              rows={5}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-indigo-400"
            />
          ) : (
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 whitespace-pre-wrap">
              {message}
            </div>
          )}

          <p className="text-[10px] text-gray-400">
            ※ <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> はお子様の名前に置換されます
          </p>
        </div>

        {/* 送信ボタン */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-black text-gray-800">
                {selectedIds.size}名 に送信
              </p>
              {selectedIds.size === 0 && (
                <p className="text-xs text-gray-400">送信先を選択してください</p>
              )}
            </div>
          </div>

          {selectedIds.size > 0 && !message.trim() && (
            <div className="flex items-center gap-2 text-amber-600 text-xs mb-3">
              <AlertCircle size={12} />
              <span>メッセージを入力してください</span>
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={selectedIds.size === 0 || !message.trim() || sending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black rounded-2xl transition-colors">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {sending ? '送信中…' : `${selectedIds.size}名にLINEを送信`}
          </button>
        </div>

      </div>

      <BottomNav storeId={storeId} active="crm" />
    </div>
  )
}
