// Manual, on-demand QA runner — NOT part of `npm test` / CI. Makes real Gemini
// API calls (costs money, non-deterministic), so it's a script you run by hand
// after changing Check All Feedback's prompt, not a gate that runs on every
// commit. Run with: npx tsx features/ai-chat/__tests__/devSetQa.ts
//
// Requires GEMINI_API_KEY in the environment and hits /api/ai-chat directly —
// point BASE_URL at a running `next dev` instance and pass a valid session
// cookie via COOKIE, since the route is auth-gated.

import { DEV_SET } from '../__fixtures__/devSet'
import { getCriterionStandardByIndex } from '../rubric-data/criteriaStandards'

const BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000'
const COOKIE = process.env.QA_COOKIE ?? ''

async function callCheckAllFeedback(item: (typeof DEV_SET)[number]) {
  const standard = getCriterionStandardByIndex(item.rubricSlug, item.criterionIndex)
  const res = await fetch(`${BASE_URL}/api/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: JSON.stringify({
      mode: 'shortcut',
      shortcutId: 'check-all-feedback',
      pageRole: 'reviewer',
      rubricSlug: item.rubricSlug,
      includeBlocks: { framingAndThreshold: true, scopeBoundaries: true, criterionStandard: standard ?? undefined },
      outputSpec:
        'Flag this single annotation if it has an issue (personal_preference, outside_scope, skimmed_rubric, disciplinary_overreach, vague_or_minimal), or say NONE. Never flag tone/style. Respond as JSON: { "issue": string | null }',
      userMessage: `Annotation: [${item.id}] criterion=${item.criterionIndex} rating=${item.ratingLevel}: "${item.commentText}"`,
      generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const { response } = (await res.json()) as { response: string }
  try {
    return (JSON.parse(response) as { issue: string | null }).issue
  } catch {
    return `UNPARSEABLE: ${response}`
  }
}

async function main() {
  const rows: { id: string; expected: string; actual: string; pass: boolean }[] = []

  for (const item of DEV_SET) {
    const actual = await callCheckAllFeedback(item)
    const expected = item.qualityTag === 'not_flagged' ? null : item.qualityTag
    const pass = actual === expected
    rows.push({ id: item.id, expected: String(expected), actual: String(actual), pass })
  }

  const toneItems = new Set(['dev-9', 'dev-10'])
  for (const row of rows) {
    if (toneItems.has(row.id) && row.actual !== 'null') {
      row.pass = false
    }
  }

  console.table(rows)
  const failed = rows.filter(r => !r.pass)
  console.log(failed.length === 0 ? `All ${rows.length} dev-set items passed.` : `${failed.length}/${rows.length} FAILED.`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
