// Original content, not extracted from any course/pretraining source (none exists
// in this repo or the sibling oer-hub prototype — confirmed during planning).
// Drafted from each rubric's own Framing Language section (`*.md`, "Singularly
// focused rubric" / "Nature of the data generated" / "Best practices" paragraphs)
// so it stays internally consistent with the rubric content injected alongside it.
// Flagged for pedagogy-owner sign-off before being treated as ground truth by
// the Check All Feedback QA checks (see __fixtures__/devSet.ts).

import type { RubricSlug } from './rubricNameMap'

export interface ScopeBoundary {
  scopeStatement: string
  selfCalibrationNote: string
  ratingsVsCommentsNote: string
}

const RATINGS_VS_COMMENTS_NOTE =
  'Ratings classify — they place a criterion into a category (Does Not Meet / Exemplifies / Exceeds). Comments explain — they carry the evidence and reasoning behind that classification. A rating without a grounded comment tells the author what but not why.'

export const SCOPE_BOUNDARIES: Record<RubricSlug, ScopeBoundary> = {
  accessibility: {
    scopeStatement:
      'Accessibility covers whether content can be perceived, operated, and understood by users with disabilities — technical compliance (alt text, captions, contrast, keyboard navigation, screen-reader compatibility). It does not cover pedagogical design choices for diverse learners (that is UDL) or scholarly accuracy (that is Disciplinary Appropriateness).',
    selfCalibrationNote:
      'Accessibility should be treated as foundational, not a checklist applied after the fact — a comment that only checks boxes without noting whether accessibility was designed-in from the start is missing the point of the standard.',
    ratingsVsCommentsNote: RATINGS_VS_COMMENTS_NOTE,
  },
  'copy-editing': {
    scopeStatement:
      'Copy Editing covers grammar, spelling, punctuation, formatting consistency, citation mechanics, and clarity of prose. It does not cover whether the content is factually accurate or disciplinarily rigorous (that is Disciplinary Appropriateness) or how digital tools function (that is eLearning).',
    selfCalibrationNote:
      'A comment that says a passage is "unclear" without pointing to the specific grammar/style/formatting issue is not yet grounded — copy editing feedback should be specific enough that the author could locate and fix the exact word or sentence.',
    ratingsVsCommentsNote: RATINGS_VS_COMMENTS_NOTE,
  },
  copyright: {
    scopeStatement:
      'Copyright covers legal authorization, licensing documentation, attribution, and fair-use justification for content in the OER. It does not cover whether the license choice reflects personal taste, or whether the content is pedagogically effective (that is eLearning/UDL) — licensing is a compliance question, not a preference question.',
    selfCalibrationNote:
      'Best practice for this rubric is to focus on legal compliance rather than personal preferences about licensing approaches — a comment justified by "I would have chosen a different license" rather than a documented compatibility or attribution gap is not grounded in the standard.',
    ratingsVsCommentsNote: RATINGS_VS_COMMENTS_NOTE,
  },
  disciplinary: {
    scopeStatement:
      'Disciplinary Appropriateness covers factual accuracy, currency, completeness, and scholarly rigor within the academic field the OER serves. It does not cover grammar/formatting (Copy Editing) or digital tool functionality (eLearning) — content-level correctness and depth is the focus, not presentation.',
    selfCalibrationNote:
      'Disciplinary authority should be applied to evaluate against the rubric standard, not used to override it — a comment that substitutes personal disciplinary opinion for the standard\'s own criteria (e.g., rating something down because the reviewer would teach it differently, absent a rigor/accuracy/currency gap) has drifted from the rubric.',
    ratingsVsCommentsNote: RATINGS_VS_COMMENTS_NOTE,
  },
  elearning: {
    scopeStatement:
      'eLearning covers the functionality, technical reliability, and pedagogical effectiveness of digital tools and technologies embedded in or accompanying the OER (LMS integration, mobile accessibility, data privacy, cost/sustainability). It does not cover the accuracy of the academic content itself (Disciplinary Appropriateness) or static-content accessibility compliance (Accessibility).',
    selfCalibrationNote:
      'A comment naming a single missing element (e.g. "no privacy policy mentioned") without connecting it to which of the criterion\'s several standards it addresses is under-grounded — this rubric\'s criteria each cover multiple distinct standards, so one observation rarely closes out the whole criterion.',
    ratingsVsCommentsNote: RATINGS_VS_COMMENTS_NOTE,
  },
  udl: {
    scopeStatement:
      'Universal Design for Learning covers pedagogical and instructional design choices that give learners multiple pathways to engage with, process, and demonstrate understanding of content — learner agency, choice, and flexibility. It does not cover technical compliance for users with disabilities (that is Accessibility, a separate prerequisite baseline) — UDL is about flexible pathways for all learners, not access barriers specifically.',
    selfCalibrationNote:
      'Discipline-specific content (e.g. a case study\'s subject matter) is only in-scope for UDL when the comment explicitly connects it back to a UDL standard like multiple means of expression or engagement — content that merely happens to touch a discipline, without that connection, belongs to Disciplinary Appropriateness instead.',
    ratingsVsCommentsNote: RATINGS_VS_COMMENTS_NOTE,
  },
}

export function getScopeBoundary(slug: RubricSlug): ScopeBoundary {
  return SCOPE_BOUNDARIES[slug]
}
