// Canonical rubric slugs, shared across the static rubric-data files (.md/.json)
// and used to resolve whichever rubric title/label variant shows up in the DB
// (`rubrics.title`), in `useChatContext.ts`, or in Block C's `rubricLabels.ts`.

export type RubricSlug =
  | 'accessibility'
  | 'copy-editing'
  | 'copyright'
  | 'disciplinary'
  | 'elearning'
  | 'udl'

export const RUBRIC_DISPLAY_NAMES: Record<RubricSlug, string> = {
  accessibility: 'Accessibility',
  'copy-editing': 'Copy Editing',
  copyright: 'Copyright',
  disciplinary: 'Disciplinary Appropriateness',
  elearning: 'eLearning',
  udl: 'Universal Design for Learning',
}

// Known DB/UI title variants -> canonical slug. Add new variants here rather
// than fuzzy-matching, so resolution stays predictable.
const TITLE_ALIASES: Record<string, RubricSlug> = {
  'accessibility': 'accessibility',
  'copy editing': 'copy-editing',
  'copyright': 'copyright',
  'copyright review': 'copyright',
  'disciplinary appropriateness': 'disciplinary',
  'elearning': 'elearning',
  'elearning review': 'elearning',
  'universal design for learning': 'udl',
  'universal design for learning (udl)': 'udl',
  'udl': 'udl',
}

export function resolveRubricSlug(title: string): RubricSlug | null {
  const normalized = title.trim().toLowerCase()
  return TITLE_ALIASES[normalized] ?? null
}
