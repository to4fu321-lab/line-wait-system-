'use client'

// ============================================================================
//  学校名から住所・電話を引く
//
//  「学校名を入れたら住所と電話が出てほしい」という要望に対して、外部の
//  学校名簿は持っていない。代わりに、このシステムに既に登録されている
//  学校を名簿として使う（制服店は同じ学区の学校を何店舗も抱えるので、
//  実際よく当たる）。
//
//  他店の登録も検索する唯一の機能なので、検索は /api/master/directory に
//  閉じ込めてある。店舗PINで認証し、返るのは学校名・カナ・住所・電話だけで、
//  他店の内部メモ・締切・採寸日程は返らない。
//
//  当たらなければ「学校規定のプリント/名簿を撮る」OCR取込に案内する。
//  AIに住所や電話番号を推測させることはしない（それらしい嘘が出るため）。
// ============================================================================

import { useEffect, useState } from 'react'
import { searchSchoolDirectory } from '@/lib/masterApi'

export interface SchoolHit {
  id:      string
  name:    string
  kana:    string | null
  address: string | null
  tel:     string | null
  /** 自店の登録か（自店のものは編集中の本人なので候補から外す） */
  own:     boolean
}

/** 全角・半角・記号の揺れを吸収して比較用のキーにする */
export function normalizeSchoolName(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　・･,、.．\-ー―─]/g, '')
    .toLowerCase()
}

/** 学校名の一部から、住所・電話を持つ登録済みの学校を探す */
export async function searchSchools(query: string, storeId: string): Promise<SchoolHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  // 住所・電話の無い行の除外と own 判定はサーバー側で済んでいる
  const rows = await searchSchoolDirectory(storeId, q)

  const seen = new Set<string>()
  const out: SchoolHit[] = []
  for (const r of rows) {
    const key = normalizeSchoolName(r.name)
    if (seen.has(key)) continue        // 同名は最初の1件だけ
    seen.add(key)
    out.push({ id: r.id, name: r.name, kana: r.kana, address: r.address, tel: r.tel, own: r.own })
  }
  // 名前が短い＝クエリに近いものを先に
  return out.sort((a, b) => a.name.length - b.name.length).slice(0, 6)
}

/** 入力中の学校名から候補を出す（打つたびに叩かないよう少し待つ） */
export function useSchoolSuggest(name: string, storeId: string) {
  const [hits, setHits] = useState<SchoolHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = name.trim()
    if (q.length < 2) { setHits([]); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      const r = await searchSchools(q, storeId)
      if (alive) { setHits(r); setLoading(false) }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [name, storeId])

  return { hits, loading }
}
