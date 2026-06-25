'use client'

type SeasonType = 'peak' | 'handover' | 'summer' | 'normal' | 'prep'

function getSeason(month: number): SeasonType {
  if (month >= 11 || month <= 1) return 'prep'
  if (month >= 2 && month <= 3)  return 'peak'
  if (month === 4)               return 'handover'
  if (month >= 5 && month <= 6)  return 'summer'
  return 'normal'
}

const SEASON_CONFIG: Record<SeasonType, {
  label: string
  emoji: string
  desc: string
  bg: string
  badge: string
  text: string
}> = {
  peak: {
    label: '最繁忙期',
    emoji: '🔥',
    desc: '採寸・発注・入荷の最繁忙期です',
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-500 text-white',
    text: 'text-red-700',
  },
  handover: {
    label: '引渡し期',
    emoji: '📦',
    desc: '入学式前。お渡し対応・サイズ交換が集中します',
    bg: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-500 text-white',
    text: 'text-orange-700',
  },
  summer: {
    label: '夏服受付',
    emoji: '☀️',
    desc: '夏服・在校生追加購入の受付シーズンです',
    bg: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-500 text-white',
    text: 'text-yellow-700',
  },
  prep: {
    label: '繁忙期準備',
    emoji: '📋',
    desc: '新入生採寸受付開始。学校マスターの確認を',
    bg: 'bg-indigo-50 border-indigo-200',
    badge: 'bg-indigo-500 text-white',
    text: 'text-indigo-700',
  },
  normal: {
    label: '通常期',
    emoji: '📅',
    desc: '学校マスター更新・シーズン準備を進めましょう',
    bg: 'bg-gray-50 border-gray-200',
    badge: 'bg-gray-400 text-white',
    text: 'text-gray-600',
  },
}

export function SeasonDashboard({ storeId: _storeId }: { storeId: string }) {
  const month  = new Date().getMonth() + 1
  const season = getSeason(month)
  const config = SEASON_CONFIG[season]

  if (season === 'normal') return null

  return (
    <div className={`rounded-2xl border px-4 py-2.5 ${config.bg}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{config.emoji}</span>
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${config.badge}`}>
          {config.label}
        </span>
        <span className={`text-xs ${config.text} flex-1`}>{config.desc}</span>
      </div>
    </div>
  )
}
