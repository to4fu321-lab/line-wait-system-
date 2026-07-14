export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { assertStorePin } from '@/lib/auth/storeAuth'
import { createAdminClient } from '@/lib/supabaseAdmin'
import {
  sanitizeSuggestedFields,
  slugifyFieldKey,
  type ExtractionField,
} from '@/lib/extraction-schema'

// ============================================================
// 伝票OCRテンプレート（extraction_templates）+ 項目（extraction_schemas）の CRUD
//   認証は既存の slip-ocr と同じ storePin 方式。RLS はJWTセッション前提のため
//   ここでは admin client + 明示的な store_id フィルタでテナント分離する。
//   POST 1本に action を持たせる（list / create / update / delete）。
// ============================================================

type Action = 'list' | 'create' | 'update' | 'delete'

interface Body {
  action?: Action
  storeId?: string
  storePin?: string
  templateId?: string
  key?: string
  label?: string
  description?: string | null
  fields?: unknown
}

// テンプレIDが当該店舗のものか検証（他店のテンプレ操作を防ぐ）
async function assertOwnedTemplate(
  supabase: ReturnType<typeof createAdminClient>,
  storeId: string,
  templateId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('extraction_templates')
    .select('id')
    .eq('id', templateId)
    .eq('store_id', storeId)
    .maybeSingle()
  return !!data
}

// 項目をDBへ書き込む（既存を全削除して入れ替える）
async function replaceFields(
  supabase: ReturnType<typeof createAdminClient>,
  storeId: string,
  templateId: string,
  fields: ExtractionField[],
) {
  await supabase.from('extraction_schemas').delete().eq('template_id', templateId)
  if (fields.length === 0) return
  const rows = fields.map((f) => ({
    store_id: storeId,
    template_id: templateId,
    field_key: f.field_key,
    field_label: f.field_label,
    field_type: f.field_type,
    description: f.description,
    sort_order: f.sort_order,
    is_required: f.is_required,
    scope: f.scope,
    role: f.role,
    master_kind: f.master_kind,
  }))
  const { error } = await supabase.from('extraction_schemas').insert(rows)
  if (error) throw new Error(error.message)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const { action = 'list', storeId, storePin } = body

    const denied = await assertStorePin(req, { storeId, storePin })
    if (denied) return denied
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'storeIdが必要です' }, { status: 400 })
    }

    const supabase = createAdminClient({ noStore: true })

    // ── 一覧: テンプレ + 項目をまとめて返す ──
    if (action === 'list') {
      const { data: templates, error: tErr } = await supabase
        .from('extraction_templates')
        .select('id, store_id, key, label, description, sort_order, target')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: true })
      if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 })

      const ids = (templates ?? []).map((t) => t.id)
      const { data: fields } = ids.length
        ? await supabase
            .from('extraction_schemas')
            .select('template_id, field_key, field_label, field_type, description, sort_order, is_required, scope, role, master_kind')
            .in('template_id', ids)
            .order('sort_order', { ascending: true })
        : { data: [] as Array<{ template_id: string } & ExtractionField> }

      const result = (templates ?? []).map((t) => ({
        ...t,
        fields: (fields ?? [])
          .filter((f) => f.template_id === t.id)
          .map(({ template_id: _omit, ...f }) => f),
      }))
      return NextResponse.json({ ok: true, templates: result })
    }

    // ── 作成 ──
    if (action === 'create') {
      const label = (body.label ?? '').trim()
      if (!label) return NextResponse.json({ ok: false, error: 'テンプレート名が必要です' }, { status: 400 })
      const key = slugifyFieldKey(body.key ?? label) || `tmpl_${Date.now()}`

      // sort_order は末尾に採番
      const { data: last } = await supabase
        .from('extraction_templates')
        .select('sort_order')
        .eq('store_id', storeId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const sort_order = (last?.sort_order ?? 0) + 1

      const { data: created, error } = await supabase
        .from('extraction_templates')
        .insert({ store_id: storeId, key, label, description: body.description ?? null, sort_order })
        .select('id')
        .single()
      if (error) {
        const msg = /duplicate|unique/i.test(error.message)
          ? '同じキーのテンプレートが既に存在します'
          : error.message
        return NextResponse.json({ ok: false, error: msg }, { status: 400 })
      }

      await replaceFields(supabase, storeId, created.id, sanitizeSuggestedFields(body.fields))
      return NextResponse.json({ ok: true, templateId: created.id })
    }

    // ── 更新（メタ + 項目を入れ替え）──
    if (action === 'update') {
      if (!body.templateId) return NextResponse.json({ ok: false, error: 'templateIdが必要です' }, { status: 400 })
      if (!(await assertOwnedTemplate(supabase, storeId, body.templateId))) {
        return NextResponse.json({ ok: false, error: 'テンプレートが見つかりません' }, { status: 404 })
      }
      const patch: Record<string, unknown> = {}
      if (typeof body.label === 'string') patch.label = body.label.trim()
      if ('description' in body) patch.description = body.description ?? null
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('extraction_templates').update(patch).eq('id', body.templateId)
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }
      if ('fields' in body) {
        await replaceFields(supabase, storeId, body.templateId, sanitizeSuggestedFields(body.fields))
      }
      return NextResponse.json({ ok: true, templateId: body.templateId })
    }

    // ── 削除（項目は ON DELETE CASCADE）──
    if (action === 'delete') {
      if (!body.templateId) return NextResponse.json({ ok: false, error: 'templateIdが必要です' }, { status: 400 })
      if (!(await assertOwnedTemplate(supabase, storeId, body.templateId))) {
        return NextResponse.json({ ok: false, error: 'テンプレートが見つかりません' }, { status: 404 })
      }
      const { error } = await supabase.from('extraction_templates').delete().eq('id', body.templateId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: '不明なアクションです' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
