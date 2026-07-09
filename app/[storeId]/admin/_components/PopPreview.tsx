'use client'

import { forwardRef } from 'react'
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
          <div style={{ fontSize: '0.8em', letterSpacing: '0.1em' }} className="font-bold opacity-90">＼ 登録かんたん・無料 ／</div>
          <div style={{ fontSize: '2.2em', lineHeight: 1.15 }} className="font-black mt-[1.5%] whitespace-pre-wrap break-words">
            {settings.headline}
          </div>
        </div>

        {/* 本文（フッターに文字が食い込まないよう、はみ出た分はここで隠す） */}
        <div className="flex-1 flex flex-col px-[7%] py-[5%] min-h-0 overflow-hidden">
          {settings.subCopy && (
            <p style={{ fontSize: '1.02em' }} className="text-center font-bold mb-[5%] whitespace-pre-wrap break-words">
              {settings.subCopy}
            </p>
          )}

          <div style={{ fontSize: '0.78em', color: theme.accent, letterSpacing: '0.04em' }} className="font-black mb-[3.5%]">
            ＼ 友だち登録でできること ／
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

          {/* QR */}
          {settings.showQr && (
            <div className="mt-auto pt-[6%] flex flex-col items-center">
              {qrDataUrl ? (
                <div style={{ backgroundColor: '#ffffff', borderColor: theme.accent }} className="rounded-[4%] border-[0.4cqw] p-[2.5%] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="友だち追加QR" style={{ width: `${QR_CQW[settings.qrSize]}cqw`, height: `${QR_CQW[settings.qrSize]}cqw` }} />
                </div>
              ) : (
                <div
                  style={{ width: `${QR_CQW[settings.qrSize]}cqw`, height: `${QR_CQW[settings.qrSize]}cqw`, borderColor: theme.accent }}
                  className="rounded-[4%] border-[0.4cqw] border-dashed flex items-center justify-center text-center p-[3%]"
                >
                  <span style={{ fontSize: '0.6em' }} className="opacity-60 leading-tight">友だち追加URLを<br />入力するとQRが<br />表示されます</span>
                </div>
              )}
              <div style={{ fontSize: '0.82em' }} className="font-bold mt-[2.5%] text-center">
                スマホのカメラで読み取り → 友だち追加
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
