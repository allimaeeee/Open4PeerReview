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

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

// Every freeform send and every shortcut (see shortcuts/*.ts) funnels through
// this single function, so a module-level controller is enough to guarantee
// only one AI Chat request is ever in flight — starting a new one cancels
// whatever the previous call was, rather than letting both race to resolve.
let activeController: AbortController | null = null

export async function callAI(request: AIChatRequest): Promise<string> {
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller

  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: controller.signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `AI request failed (${res.status})`)
  }

  const data = await res.json() as { response: string }
  return data.response
}
