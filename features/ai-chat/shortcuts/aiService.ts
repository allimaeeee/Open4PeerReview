import type { PageRole, IncludeBlocks } from '../server/promptBuilder'
import type { RubricSlug } from '../rubric-data/rubricNameMap'

export interface FreeformAIRequest {
  mode: 'freeform'
  userMessage: string
  pageRole: PageRole
  rubricSlug: RubricSlug
}

export interface ShortcutAIRequest {
  mode: 'shortcut'
  shortcutId: string
  userMessage: string
  pageRole: PageRole
  rubricSlug: RubricSlug
  includeBlocks?: IncludeBlocks
  outputSpec: string
  generationConfig: {
    temperature: number
    maxOutputTokens: number
    responseSchema?: object
  }
}

export type AIChatRequest = FreeformAIRequest | ShortcutAIRequest

export async function callAI(request: AIChatRequest): Promise<string> {
  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `AI request failed (${res.status})`)
  }

  const data = await res.json() as { response: string }
  return data.response
}
