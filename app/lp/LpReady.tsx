'use client'

import { useEffect } from 'react'

// ============================================================
// LP登場アニメーション(スクロールリビール)の発火トリガー。
//
// .animate-rise-in の各要素を IntersectionObserver で監視し、
// 「実際に画面内に入った瞬間」に .in-view を付けて transition を発火する。
// 初期表示範囲(ヒーロー)はhydration直後にIOが即発火し、
// [transition-delay:...] の時間差でカスケード表示される。
// 下部のセクションはスクロールで見えたタイミングで浮き上がる。
//
// useEffect(hydration後=必ず初回描画の後)で監視を始めるため、
// iOS Safariでも「初期状態(透明)が描画されないままtransitionが
// スキップされる」問題が起こらない。
// ============================================================
export default function LpReady() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.animate-rise-in'))
    if (els.length === 0) return

    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in-view'))
      return
    }

    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view')
          io.unobserve(e.target)
        }
      }
    }, { rootMargin: '0px 0px -10% 0px' })

    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}
