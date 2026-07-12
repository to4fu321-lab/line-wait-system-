'use client'

import { useEffect } from 'react'

// ============================================================
// LP登場アニメーションの発火トリガー。
//
// インラインスクリプト(HTML解析中に即実行)だと、iOS Safariでは
// 「最初の描画」より前に .lp-ready が付いてしまい、Safariは
// 初期状態(透明)を一度も描画しないまま最終状態だけを描く
// =transitionがスキップされて「パッと表示」になる。
//
// useEffect は hydration 完了後=必ず初回描画の後に走るため、
// 「初期状態が描画済み → クラス付与 → transition発火」の順序が保証される。
// さらに rAF×2 で描画フレームを跨いでから付与して確実性を上げる。
// ============================================================
export default function LpReady() {
  useEffect(() => {
    let raf1 = 0, raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        document.documentElement.classList.add('lp-ready')
      })
    })
    // 保険: 何かの理由でrAFが走らなくても3秒後には必ず表示する
    const failsafe = setTimeout(() => document.documentElement.classList.add('lp-ready'), 3000)
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(failsafe) }
  }, [])
  return null
}
