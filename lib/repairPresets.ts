// ============================================================
// お直しマスタ用の学生服プリセット（一括追加・編集前提）
//   服種（大項目）＋定番項目＋相場価格。投入後は通常の編集が可能。
// ============================================================
export interface PresetItem { name: string; price: number }
export interface PresetGarment { name: string; icon: string; items: PresetItem[] }

export const REPAIR_PRESETS: PresetGarment[] = [
  {
    name: '学ラン上着', icon: 'gakuran',
    items: [
      { name: '袖丈詰め', price: 2000 },
      { name: '着丈詰め', price: 3000 },
      { name: '肩幅詰め', price: 3000 },
      { name: 'ボタン付け替え', price: 1000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: '学ランズボン', icon: 'trousers',
    items: [
      { name: '裾上げ', price: 1500 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
      { name: '股下直し', price: 2000 },
    ],
  },
  {
    name: 'ブレザー', icon: 'blazer',
    items: [
      { name: '袖丈詰め', price: 2500 },
      { name: '着丈詰め', price: 3500 },
      { name: '肩幅詰め', price: 3500 },
      { name: '身幅詰め', price: 3000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'スラックス', icon: 'trousers',
    items: [
      { name: '裾上げ（シングル）', price: 1500 },
      { name: '裾上げ（ダブル）', price: 2000 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
    ],
  },
  {
    name: 'スカート', icon: 'skirt',
    items: [
      { name: '丈詰め', price: 2000 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
      { name: 'ホック付け替え', price: 800 },
    ],
  },
  {
    name: 'セーラー服', icon: 'sailor',
    items: [
      { name: '着丈詰め', price: 3000 },
      { name: '袖丈詰め', price: 2000 },
      { name: '身幅詰め', price: 3000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'ジャージ', icon: 'jersey',
    items: [
      { name: '裾上げ', price: 1500 },
      { name: '袖丈詰め', price: 1500 },
      { name: 'ウエストゴム交換', price: 1500 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'ワイシャツ・ブラウス', icon: 'shirt',
    items: [
      { name: '袖丈詰め', price: 1500 },
      { name: '着丈詰め', price: 1500 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'セーター・ベスト', icon: 'sweater',
    items: [
      { name: '着丈詰め', price: 2500 },
      { name: '袖丈詰め', price: 2000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
]
