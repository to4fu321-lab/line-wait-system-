import { useState, useRef, useEffect } from 'react'
import type React from 'react'

function toKatakana(s: string) {
  return s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/**
 * vanilla-autokana インスパイア。
 *
 * ・compositionStart  : kana を snapshot する
 * ・compositionUpdate : IME 入力中のひらがなをリアルタイムで反映 (live preview)
 * ・compositionEnd    : IME 確定後に reading でフリガナを確定
 * ・onChange (非IME)  : 前回値との差分を検出し、挿入文字列をカタカナ変換して追記
 *                       削除時は文字数比率でフリガナをトリム
 *
 * フリガナ欄を手動編集した瞬間に自動変換は止まる。
 */
export function useKanaAutoFill(initialName = '') {
  const [name, _setName] = useState(initialName)
  const [kana, _setKana] = useState('')

  const kanaRef   = useRef('')           // stale closure を避けるための kana 鏡
  const edited    = useRef(false)        // ユーザーが kana 欄を手動編集済み
  const composing = useRef(false)        // IME 変換中フラグ
  const kanaSnap  = useRef('')           // compositionStart 時点の kana
  const prevName  = useRef(initialName)  // 差分計算用の前回 name 値

  const setKana = (v: string) => { _setKana(v); kanaRef.current = v }

  // マウント時: 初期名からフリガナを自動設定（LINE 表示名など）
  useEffect(() => {
    if (initialName && !edited.current) setKana(toKatakana(initialName))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nameProps = {
    value: name,

    onChange(e: React.ChangeEvent<HTMLInputElement>) {
      const curr = e.target.value
      _setName(curr)
      if (edited.current || composing.current) return

      const prev = prevName.current
      if (curr.length > prev.length) {
        // 挿入箇所を LCS 的に検出（末尾追記・中間挿入の両方に対応）
        let lo = 0
        while (lo < prev.length && prev[lo] === curr[lo]) lo++
        let hi = 0
        while (hi < prev.length - lo && prev[prev.length - 1 - hi] === curr[curr.length - 1 - hi]) hi++
        const inserted = curr.slice(lo, curr.length - hi)
        setKana(kanaRef.current + toKatakana(inserted))
      } else if (curr.length < prev.length) {
        // 削除: 文字数比率で kana をトリム
        const ratio = curr.length / Math.max(prev.length, 1)
        setKana(kanaRef.current.slice(0, Math.ceil(kanaRef.current.length * ratio)))
      }
      prevName.current = curr
    },

    onCompositionStart() {
      composing.current = true
      kanaSnap.current  = kanaRef.current
    },

    onCompositionUpdate(e: React.CompositionEvent<HTMLInputElement>) {
      // e.data: 変換候補確定前のひらがな文字列
      if (edited.current || !e.data) return
      setKana(kanaSnap.current + toKatakana(e.data))
    },

    onCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
      composing.current = false
      // e.data: 最終的に確定したひらがな（漢字変換前の読み）
      if (!edited.current) setKana(kanaSnap.current + toKatakana(e.data))
      prevName.current = e.currentTarget.value
    },
  }

  const kanaProps = {
    value: kana,
    onChange(e: React.ChangeEvent<HTMLInputElement>) {
      edited.current = true
      setKana(e.target.value)
    },
  }

  return { name, kana, setKana, nameProps, kanaProps }
}
