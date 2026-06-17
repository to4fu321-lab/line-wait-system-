// ============================================================
// 学校マニュアル用 OCR 抽出スキーマ & プロンプト
//   設計: docs/superpowers/specs/2026-06-15-manual-ocr-import-design.md
// ============================================================

export type OcrConfidence = 'high' | 'medium' | 'low'

export interface SchoolManualSize {
  label:        string  // 例: 155, W60, S, M
  price_tax_in: number | null
}

export interface SchoolManualItem {
  item_name:       string
  category:        string | null  // PRODUCT_CATEGORY_OPTIONS に準拠
  gender:          string | null  // 男子用 | 女子用 | 男女共通
  maker:           string | null
  maker_code:      string | null
  required:        boolean
  avg_qty:         number | null
  notes:           string | null  // 商品個別メモ
  eo_price_tax_in: number | null  // 別寸(EO)価格
  sizes:           SchoolManualSize[]
  confidence:      OcrConfidence
}

export interface SchoolManualExtraction {
  school_name:         string | null
  wearing_regulations: string | null
  special_notes:       string | null
  schedule_notes:      string | null
  extra_info:          string | null
  items:               SchoolManualItem[]
  confidence:          OcrConfidence
  warnings:            string[]
}

// PRODUCT_CATEGORY_OPTIONS（types/master.ts）と一致させる
const CATEGORY_LIST = [
  '制服（上着）', 'スラックス・スカート', 'シャツ・ブラウス', 'セーター・ベスト',
  'ネクタイ・リボン', '体操着', '上靴', 'カバン・バッグ', 'その他',
]

export const SCHOOL_MANUAL_PROMPT = `あなたは学生服販売店のマニュアル・あんちょこ・見積書・価格表をデータ化する専門アシスタントです。
渡された画像 / PDF / 表データから、学校制服の販売情報を抽出し、**厳密に次の JSON 形式のみ**で出力してください。
説明文やマークダウンは一切付けず、JSON オブジェクトだけを返してください。読み取れない値は null を使ってください。

{
  "school_name": "学校名（読み取れなければ null）",
  "wearing_regulations": "着用規定・着こなしルールの自由テキスト（なければ null）",
  "special_notes": "特記事項・注意書きの自由テキスト（なければ null）",
  "schedule_notes": "販売スケジュール・採寸日・締切などの自由テキスト（なければ null）",
  "extra_info": "その他の補足情報（なければ null）",
  "items": [
    {
      "item_name": "商品名（例: 制服上着、夏スカート）",
      "category": "次のいずれか or null: ${CATEGORY_LIST.join(' / ')}",
      "gender": "男子用 / 女子用 / 男女共通 / null",
      "maker": "メーカー名（なければ null）",
      "maker_code": "品番・型番（英数字。なければ null）",
      "required": true,
      "avg_qty": 1,
      "notes": "この商品個別のメモ（なければ null）",
      "eo_price_tax_in": null,
      "sizes": [
        { "label": "155", "price_tax_in": 12100 },
        { "label": "160", "price_tax_in": 12100 }
      ],
      "confidence": "high"
    }
  ],
  "confidence": "high",
  "warnings": ["読み取りが曖昧だった箇所の説明（無ければ空配列）"]
}

判断基準:
- category は必ず上記リストの文言と完全一致させる。当てはまらなければ null。
- required: 「必須」「必ず購入」「全員」等の表現があれば true、「任意」「希望者」なら false。不明なら true。
- avg_qty: 「2枚」「3点」等の平均購入数。記載が無ければ null。
- price_tax_in: 税込販売価格（整数・円。カンマや「円」は除く）。

■ sizes（最重要）:
- その学校・その商品で実際に販売されるサイズを **1サイズ = 1要素** で、すべて個別に列挙する。
- **範囲・同額表記は各サイズへ展開する。** 例:「S〜4Lまで1,000円」→ S/M/L/LL/3L/4L をそれぞれ price_tax_in:1000 で出力。
- **一部だけ価格が違う場合（ティア）はそのサイズだけ別価格にする。** 例:「5Lは1,500円」→ 5L を price_tax_in:1500。
- **マニュアルに記載された実際のサイズ並び・ピッチを尊重し、勝手に増減しない。**
  例: 価格表の列が「150 155 160 165」ならその4つ。「150 160 170」ならその3つ（中間サイズを補完しない）。
- 文字サイズの標準的な大小順は SS < S < M < L < LL < 3L < 4L < 5L < 6L < 7L。範囲展開の際はこの順序に従う（ただしマニュアルに無いサイズは作らない）。
- サイズ表記が無く単価のみの場合は label を空文字 "" にして1要素入れる。

■ eo_price_tax_in（別寸の扱い）:
- 「別寸」「EO」「特注」「規定サイズ外」「○L以上は別途」等の価格は **sizes に入れず eo_price_tax_in に入れる**（1商品1つ）。
- 「それ以上／それ以外は別寸」という上限の考え方は、sizes に挙げた範囲＝通常販売、それを超えるもの＝別寸、として表現する（超過サイズは sizes に入れない）。

- confidence: 読み取りに自信が無い項目・商品は "low"（UI で⚠表示に使う）。全体の confidence も同様。
- 同じ商品で複数サイズ・複数価格がある場合は sizes 配列にまとめる（商品は1つ）。
`
