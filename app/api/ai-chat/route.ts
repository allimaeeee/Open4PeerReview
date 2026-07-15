import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI, type ResponseSchema, type GenerationConfig } from '@google/generative-ai'
import { buildSystemPrompt, type PageRole } from '@/features/ai-chat/server/promptBuilder'
import { freeformSpec } from '@/features/ai-chat/server/outputSpecs'
import type { RubricSlug } from '@/features/ai-chat/rubric-data/rubricNameMap'
import type { IncludeBlocks } from '@/features/ai-chat/server/promptBuilder'

interface GenerationConfigInput {
  temperature: number
  maxOutputTokens: number
  responseSchema?: ResponseSchema
}

// gemini-2.5-flash's "thinking" isn't in this SDK version's GenerationConfig
// type yet, but the API accepts it — see disableThinking below.
type GenerationConfigWithThinking = GenerationConfig & { thinkingConfig?: { thinkingBudget: number } }

type AIChatRequest =
  | {
      mode: 'freeform'
      userMessage: string
      pageRole: PageRole
      rubricSlug: RubricSlug
    }
  | {
      mode: 'shortcut'
      shortcutId: string
      userMessage: string
      pageRole: PageRole
      rubricSlug: RubricSlug
      includeBlocks?: IncludeBlocks
      outputSpec: string
      generationConfig: GenerationConfigInput
    }

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: AIChatRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.userMessage || typeof body.userMessage !== 'string') {
    return NextResponse.json({ error: 'userMessage is required' }, { status: 400 })
  }
  if (!body.rubricSlug || !body.pageRole) {
    return NextResponse.json({ error: 'rubricSlug and pageRole are required' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // gemini-1.5-flash was retired; override via GEMINI_MODEL if needed
    const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

    // gemini-2.5-flash "thinks" by default — invisible reasoning tokens count
    // against maxOutputTokens (seen consuming ~490 of a 512 budget in testing,
    // leaving almost nothing for the visible answer and truncating mid-sentence
    // with finishReason: MAX_TOKENS). None of these prompts need multi-step
    // reasoning, so thinking is disabled outright rather than sized per-call.
    const disableThinking = { thinkingConfig: { thinkingBudget: 0 } }

    if (body.mode === 'freeform') {
      const systemPrompt = buildSystemPrompt({
        pageRole: body.pageRole,
        rubricSlug: body.rubricSlug,
        outputSpec: freeformSpec(),
      })
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: body.userMessage }] }],
        generationConfig: { maxOutputTokens: 1024, ...disableThinking } as GenerationConfigWithThinking,
      })
      return NextResponse.json({ response: result.response.text() })
    }

    // mode: 'shortcut'
    const systemPrompt = buildSystemPrompt({
      pageRole: body.pageRole,
      rubricSlug: body.rubricSlug,
      includeBlocks: body.includeBlocks,
      outputSpec: body.outputSpec,
    })

    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: body.userMessage }] }],
      generationConfig: {
        temperature: body.generationConfig.temperature,
        maxOutputTokens: body.generationConfig.maxOutputTokens,
        ...disableThinking,
        ...(body.generationConfig.responseSchema
          ? { responseMimeType: 'application/json', responseSchema: body.generationConfig.responseSchema }
          : {}),
      } as GenerationConfigWithThinking,
    })
    return NextResponse.json({ response: result.response.text() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ai-chat] Gemini error:', message)
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 502 })
  }
}
