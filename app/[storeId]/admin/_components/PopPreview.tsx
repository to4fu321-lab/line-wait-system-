'use client'

import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { PAPER, THEME_COLORS, QR_CQW, type PopSettings } from '@/lib/pop'

type Props = {
  settings: PopSettings
  qrDataUrl: string | null
  storeName: string
  hoursText: string
}

/**
 * 友だち登録POPの表示本体。印刷・PNG化の対象DOM（id="pop-print-root"）。
 * コンテナクエリ単位(cqw)でフォントを組むため、画面・印刷・PNGで比率が一致する。
 */
export const PopPreview = forwardRef<HTMLDivElement, Props>(function PopPreview(
  { settings, qrDataUrl, storeName, hoursText },
  ref,
) {
  const paper = PAPER[settings.paperSize]
  const landscape = settings.orientation === 'landscape'
  const w = landscape ? paper.h : paper.w
  const h = landscape ? paper.w : paper.h
  const theme = THEME_COLORS[settings.theme]
  const merits = settings.merits.filter(m => m.enabled && m.text.trim())
  const showFooter = (settings.showStoreName && storeName) || (settings.showHours && hoursText)

  // ---- 本文の自動縮小 ----
  // 文言が枠に収まらない時、本文（サブコピー＋メリット）の文字を縮めて全文を表示する。
  // 内容が変わったら等倍に戻し、まだ溢れていれば収まるまで段階的に縮める（下限0.5倍）。
  const textRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const contentKey = JSON.stringify([
    settings.subCopy, settings.meritsHeading, merits.map(m => m.text),
    settings.headline, settings.kicker, settings.qrCaption,
    settings.fontScale, settings.paperSize, settings.orientation,
    settings.showQr, settings.qrSize, settings.showStoreName, settings.showHours,
    storeName, hoursText, !!qrDataUrl,
  ])
  useLayoutEffect(() => { setFitScale(1) }, [contentKey])
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || fitScale <= 0.5) return
    if (el.scrollHeight > el.clientHeight + 1) {
      const ratio = Math.max(0.6, el.clientHeight / el.scrollHeight)
      setFitScale(s => Math.max(0.5, s * ratio * 0.98))
    }
  }, [fitScale, contentKey])

  return (
    <div
      ref={ref}
      id="pop-print-root"
      style={{
        aspectRatio: `${w} / ${h}`,
        containerType: 'inline-size',
        backgroundColor: theme.bg,
        color: theme.text,
        width: '100%',
      }}
      className="relative overflow-hidden shadow-sm"
    >
      <div
        style={{ fontSize: `${4 * settings.fontScale}cqw`, fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }}
        className="w-full h-full flex flex-col"
      >
        {/* ヘッダー */}
        <div style={{ backgroundColor: theme.accent, color: '#ffffff' }} className="shrink-0 text-center px-[6%] pt-[5%] pb-[4.5%]">
          <div style={{ fontSize: '0.8em', letterSpacing: '0.1em' }} className="font-bold opacity-90">＼ {settings.kicker} ／</div>
          <div style={{ fontSize: '2.2em', lineHeight: 1.15 }} className="font-black mt-[1.5%] whitespace-pre-wrap break-words">
            {settings.headline}
          </div>
        </div>

        {/* 本文。QR・フッターは常時表示し、文言が長い時は本文の文字を自動で縮めて全文収める */}
        <div className="flex-1 flex flex-col px-[7%] py-[5%] min-h-0">
          <div ref={textRef} style={{ fontSize: `${fitScale}em` }} className="flex-1 min-h-0 overflow-hidden">
            {settings.subCopy && (
              <p style={{ fontSize: '1.02em' }} className="text-center font-bold mb-[5%] whitespace-pre-wrap break-words">
                {settings.subCopy}
              </p>
            )}

            <div style={{ fontSize: '0.78em', color: theme.accent, letterSpacing: '0.04em' }} className="font-black mb-[3.5%]">
              ＼ {settings.meritsHeading} ／
            </div>

            <div className="flex flex-col gap-[3.2%]">
              {merits.map(m => (
                <div key={m.id} className="flex items-start gap-[3%]">
                  <span
                    style={{ backgroundColor: theme.accent, color: '#ffffff', width: '1.5em', height: '1.5em', fontSize: '0.85em' }}
                    className="rounded-full flex items-center justify-center shrink-0 font-black leading-none"
                  >
                    ✓
                  </span>
                  <span style={{ fontSize: '1.12em', lineHeight: 1.3 }} className="font-bold break-words">
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* QR */}
          {settings.showQr && (
            <div className="shrink-0 pt-[6%] flex flex-col items-center">
              {qrDataUrl ? (
                <div style={{ backgroundColor: '#ffffff', borderColor: theme.accent }} className="rounded-[4%] border-[0.4cqw] p-[2.5%] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QRコード" style={{ width: `${QR_CQW[settings.qrSize]}cqw`, height: `${QR_CQW[settings.qrSize]}cqw` }} />
                </div>
              ) : (
                <div
                  style={{ width: `${QR_CQW[settings.qrSize]}cqw`, height: `${QR_CQW[settings.qrSize]}cqw`, borderColor: theme.accent }}
                  className="rounded-[4%] border-[0.4cqw] border-dashed flex items-center justify-center text-center p-[3%]"
                >
                  <span style={{ fontSize: '0.6em' }} className="opacity-60 leading-tight">URLを読み込むと<br />QRが表示されます</span>
                </div>
              )}
              <div style={{ fontSize: '0.82em' }} className="font-bold mt-[2.5%] text-center">
                {settings.qrCaption}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {showFooter && (
          <div style={{ backgroundColor: theme.accentSoft, color: theme.text }} className="shrink-0 text-center px-[7%] py-[3%]">
            {settings.showStoreName && storeName && (
              <div style={{ fontSize: '0.92em' }} className="font-black break-words">{storeName}</div>
            )}
            {settings.showHours && hoursText && (
              <div style={{ fontSize: '0.66em' }} className="opacity-80 mt-[0.5%] break-words">{hoursText}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
