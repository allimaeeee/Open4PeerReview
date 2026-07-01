export async function callAI(prompt: string): Promise<string> {
  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `AI request failed (${res.status})`)
  }

  const data = await res.json() as { response: string }
  return data.response
}
