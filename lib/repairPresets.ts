// ============================================================
// お直しマスタ用の学生服プリセット（一括追加・編集前提）
//   服種（大項目）＋定番項目＋相場価格。投入後は通常の編集が可能。
// ============================================================
export interface PresetItem { name: string; price: number }
export interface PresetGarment { name: string; icon: string; items: PresetItem[] }

export const REPAIR_PRESETS: PresetGarment[] = [
  {
    name: '学ラン上着', icon: '🧥',
    items: [
      { name: '袖丈詰め', price: 2000 },
      { name: '着丈詰め', price: 3000 },
      { name: '肩幅詰め', price: 3000 },
      { name: 'ボタン付け替え', price: 1000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: '学ランズボン', icon: '👖',
    items: [
      { name: '裾上げ', price: 1500 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
      { name: '股下直し', price: 2000 },
    ],
  },
  {
    name: 'ブレザー', icon: '🧥',
    items: [
      { name: '袖丈詰め', price: 2500 },
      { name: '着丈詰め', price: 3500 },
      { name: '肩幅詰め', price: 3500 },
      { name: '身幅詰め', price: 3000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'スラックス', icon: '👖',
    items: [
      { name: '裾上げ（シングル）', price: 1500 },
      { name: '裾上げ（ダブル）', price: 2000 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
    ],
  },
  {
    name: 'スカート', icon: '🩳',
    items: [
      { name: '丈詰め', price: 2000 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
      { name: 'ホック付け替え', price: 800 },
    ],
  },
  {
    name: 'セーラー服', icon: '👚',
    items: [
      { name: '着丈詰め', price: 3000 },
      { name: '袖丈詰め', price: 2000 },
      { name: '身幅詰め', price: 3000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'ジャージ', icon: '🥋',
    items: [
      { name: '裾上げ', price: 1500 },
      { name: '袖丈詰め', price: 1500 },
      { name: 'ウエストゴム交換', price: 1500 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'ワイシャツ・ブラウス', icon: '👔',
    items: [
      { name: '袖丈詰め', price: 1500 },
      { name: '着丈詰め', price: 1500 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'セーター・ベスト', icon: '🧶',
    items: [
      { name: '着丈詰め', price: 2500 },
      { name: '袖丈詰め', price: 2000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
]
