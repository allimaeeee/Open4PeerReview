// Per-criterion standard/needsImprovement/exceeds prompt text, ported verbatim
// from oer-hub's src/data/rubrics/*.json (plain JSON import, no fs needed —
// portable to client or server code, unlike the .md-derived modules).
//
// Production `rubric_items` rows are DB-generated (UUID id, flat label/description,
// sort_order) and carry none of this richer text. There's no shared criterion key
// between the two systems, so criteria are matched by position: rubric_items
// ordered by sort_order line up 1:1 with each rubric's JSON `criteria` array
// (both represent "criterion N of this rubric" in rubric order). This is the same
// assumption production already makes when treating rubric_items.description as
// the "standard" text for a criterion — it's positional, not id-based.

import accessibility from './accessibility.json'
import copyEditing from './copy-editing.json'
import copyright from './copyright.json'
import disciplinary from './disciplinary.json'
import elearning from './elearning.json'
import udl from './udl.json'
import type { RubricSlug } from './rubricNameMap'

export interface CriterionStandard {
  id: string
  title: string
  standard: string
  needsImprovementPrompt: string
  exceedsPrompt: string
}

interface RubricJson {
  id: string
  name: string
  description: string
  preamble: string
  criteria: CriterionStandard[]
}

const RUBRIC_JSON: Record<RubricSlug, RubricJson> = {
  accessibility: accessibility as RubricJson,
  'copy-editing': copyEditing as RubricJson,
  copyright: copyright as RubricJson,
  disciplinary: disciplinary as RubricJson,
  elearning: elearning as RubricJson,
  udl: udl as RubricJson,
}

export function getCriterionStandards(slug: RubricSlug): CriterionStandard[] {
  return RUBRIC_JSON[slug].criteria
}

/** Look up a criterion's standard text by its position among a rubric's criteria (0-indexed, matching sort_order). */
export function getCriterionStandardByIndex(slug: RubricSlug, index: number): CriterionStandard | null {
  return RUBRIC_JSON[slug].criteria[index] ?? null
}
