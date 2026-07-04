export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro: 最大300秒

import { NextRequest, NextResponse } from 'next/server'
import { runSchoolManualOcr } from '@/lib/ocr/engine'
import { createAdminClient } from '@/lib/supabaseAdmin'

// POST /api/ocr/process
//   multipart/form-data: storeId, files[]（'files' or 'images'）
//   ファイル受信 → ocr_jobs 登録 → 同期解析 → 学校マッチング → 結果を返す
export async function POST(req: NextRequest) {
  let jobId: string | null = null
  const supabase = createAdminClient()
  try {
    const form = await req.formData()
    const storeId = String(form.get('storeId') ?? '')
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

    const files = [...form.getAll('files'), ...form.getAll('images')].filter(
      (f): f is File => f instanceof File,
    )
    if (files.length === 0) return NextResponse.json({ error: 'files required' }, { status: 400 })

    const inputMeta = {
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }

    // ジョブ登録（processing）
    const { data: job, error: jobErr } = await supabase
      .from('ocr_jobs')
      .insert({ store_id: storeId, job_type: 'school_manual', status: 'processing', input_meta: inputMeta })
      .select('id')
      .single()
    if (jobErr) throw new Error(jobErr.message)
    jobId = job.id

    // OCR 実行（同期）
    const { extraction, tokensUsed } = await runSchoolManualOcr(files)

    // 学校マッチング（store_id + name 完全一致）
    let matchedSchoolId: string | null = null
    if (extraction.school_name) {
      const { data: matched } = await supabase
        .from('schools')
        .select('id')
        .eq('store_id', storeId)
        .eq('name', extraction.school_name.trim())
        .maybeSingle()
      matchedSchoolId = matched?.id ?? null
    }

    const result = {
      extraction,
      matched_school_id: matchedSchoolId,
      detected_name: extraction.school_name,
    }

    await supabase
      .from('ocr_jobs')
      .update({ status: 'done', result, tokens_used: tokensUsed, updated_at: new Date().toISOString() })
      .eq('id', jobId)

    return NextResponse.json({ jobId, status: 'done', result, tokens_used: tokensUsed })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    if (jobId) {
      await supabase.from('ocr_jobs')
        .update({ status: 'error', error_msg: message, updated_at: new Date().toISOString() })
        .eq('id', jobId)
    }
    return NextResponse.json({ error: message, jobId }, { status: 500 })
  }
}
