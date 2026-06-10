import { useState, useRef, useEffect } from 'react'
import type React from 'react'

function toKatakana(s: string) {
  return s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

// ひらがな・長音符・スペースのみか判定（漢字候補が出る前の状態）
function isHiragana(s: string) {
  return s.length > 0 && /^[ぁ-ゖー\s]*$/.test(s)
}

/**
 * vanilla-autokana インスパイア。
 *
 * ・compositionStart  : kana を snapshot する
 * ・compositionUpdate : ひらがなの間だけリアルタイム反映。漢字候補が出た後は
 *                       最後のひらがな読みを lastHiragana に保持（iOS 対策）
 * ・compositionEnd    : lastHiragana があればそれを使う（iOS では e.data が漢字になる）
 * ・onChange (非IME)  : 前回値との差分を検出し、挿入文字列をカタカナ変換して追記
 *                       削除時は文字数比率でフリガナをトリム
 *
 * フリガナ欄を手動編集した瞬間に自動変換は止まる。
 */
export function useKanaAutoFill(initialName = '', initialKana?: string) {
  const [name, _setName] = useState(initialName)
  const [kana, _setKana] = useState(initialKana ?? '')

  const kanaRef      = useRef(initialKana ?? '')  // stale closure を避けるための kana 鏡
  const edited       = useRef(!!initialKana)       // 初期カナがある場合は手動設定済み扱い
  const composing    = useRef(false)               // IME 変換中フラグ
  const kanaSnap     = useRef(initialKana ?? '')   // compositionStart 時点の kana
  const prevName     = useRef(initialName)         // 差分計算用の前回 name 値
  const lastHiragana = useRef('')                  // compositionUpdate で保持した最後のひらがな読み

  const setKana = (v: string) => { _setKana(v); kanaRef.current = v }

  // マウント時: 初期カナ未指定の場合のみ、初期名からフリガナを自動設定
  useEffect(() => {
    if (!initialKana && initialName && !edited.current) setKana(toKatakana(initialName))
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
      composing.current    = true
      kanaSnap.current     = kanaRef.current
      lastHiragana.current = ''
    },

    onCompositionUpdate(e: React.CompositionEvent<HTMLInputElement>) {
      if (edited.current || !e.data) return
      if (isHiragana(e.data)) {
        // まだひらがな段階 → 読みを保存してリアルタイム反映
        lastHiragana.current = e.data
        setKana(kanaSnap.current + toKatakana(e.data))
      }
      // 漢字候補が表示されている間は何もしない（lastHiragana に読みが残っている）
    },

    onCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
      composing.current = false
      if (!edited.current) {
        // iOS では e.data が確定した漢字になるため lastHiragana（読み）を優先する
        const reading = lastHiragana.current || e.data
        setKana(kanaSnap.current + toKatakana(reading))
      }
      lastHiragana.current = ''
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
