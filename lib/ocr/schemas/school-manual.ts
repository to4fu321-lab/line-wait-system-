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
- eo_price_tax_in: EO・別寸・特注の税込価格。記載が無ければ null。
- sizes: サイズごとに1要素。サイズ表記が無く単価のみの場合は label を空文字 "" にして1要素入れる。
- confidence: 読み取りに自信が無い項目・商品は "low"（UI で⚠表示に使う）。全体の confidence も同様。
- 同じ商品で複数サイズ・複数価格がある場合は sizes 配列にまとめる（商品は1つ）。
`
