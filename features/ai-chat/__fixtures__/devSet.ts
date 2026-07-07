// Original fixture content — NOT transcribed from any real reviewer comment.
// The v3 prompt-engineering doc only describes the *kind* of comment for each
// dev-set slot (rubric, criterion, rating, quality tag), not verbatim text, and
// confirmed during planning that no such dev-set exists anywhere in this repo
// or the sibling oer-hub prototype. Drafted to match each described quality
// category for manual QA of Check All Feedback (see __tests__/devSetQa.ts).
// Flagged for pedagogy-owner sign-off before being treated as ground truth.

import type { RubricSlug } from '../rubric-data/rubricNameMap'

// Check All Feedback no longer classifies by a fixed issue-category enum
// (removed in the tone/structure rewrite — see outputSpecs.ts), so this is
// now a free-form label for this fixture's own QA purposes, not a shared type.
export type DevSetQualityTag = 'personal_preference' | 'outside_scope' | 'skimmed_rubric' | 'disciplinary_overreach' | 'vague_or_minimal' | 'not_flagged'

export interface DevSetItem {
  id: string
  rubricSlug: RubricSlug
  criterionIndex: number // 0-based, matches rubric-data JSON criteria order
  ratingLevel: 'does_not_meet' | 'exemplifies' | 'exceeds'
  qualityTag: DevSetQualityTag
  commentText: string
}

export const DEV_SET: DevSetItem[] = [
  {
    id: 'dev-1',
    rubricSlug: 'copy-editing',
    criterionIndex: 2,
    ratingLevel: 'does_not_meet',
    qualityTag: 'not_flagged',
    commentText:
      'Section 2.3 has three comma splices in the first paragraph alone ("The theory was popular, it eventually fell out of favor, however some scholars still cite it"). Chapter 4 switches between "utilize" and "use" inconsistently across six instances. The bibliography mixes APA and MLA citation formats — compare the Smith (2019) entry on p.12 with the Jones entry on p.14.',
  },
  {
    id: 'dev-2',
    rubricSlug: 'copy-editing',
    criterionIndex: 6,
    ratingLevel: 'does_not_meet',
    qualityTag: 'personal_preference',
    commentText:
      'The cross-references in Chapter 5 point to "Section 3" without a page number or hyperlink, so readers have to hunt for it. Also the sidebar callout boxes are ugly :) — I would have used a cleaner color scheme.',
  },
  {
    id: 'dev-3',
    rubricSlug: 'elearning',
    criterionIndex: 4,
    ratingLevel: 'does_not_meet',
    qualityTag: 'vague_or_minimal',
    commentText: 'No privacy policy mentioned anywhere. Needs work.',
  },
  {
    id: 'dev-4',
    rubricSlug: 'elearning',
    criterionIndex: 0,
    ratingLevel: 'exceeds',
    qualityTag: 'not_flagged',
    commentText:
      'The embedded H5P activities load reliably across Chrome, Firefox, and Safari, and the platform vs. content distinction is handled well — the interactive quiz degrades gracefully to a static PDF version when JavaScript is disabled, so the pedagogical content itself is never gated behind the tool.',
  },
  {
    id: 'dev-5',
    rubricSlug: 'copyright',
    criterionIndex: 0,
    ratingLevel: 'does_not_meet',
    qualityTag: 'not_flagged',
    commentText:
      'Five items are missing licensing information: (1) the "Consumer Health Sources" infographic on p.8, (2) the H5P interactive on p.15 has no license in its metadata, (3) the embedded YouTube video at 22:40 has no attribution, (4) the chart on p.31 reuses a copyrighted textbook figure without permission, (5) the glossary appendix has no resource-level license statement. Fix: add a CC BY statement to each content page and the metadata panel.',
  },
  {
    id: 'dev-6',
    rubricSlug: 'udl',
    criterionIndex: 1,
    ratingLevel: 'exceeds',
    qualityTag: 'not_flagged',
    commentText:
      'The case study naturally incorporates Tuckman\'s stages of group development, primary and secondary tensions, and role confusion — this range of concepts lends itself well to multiple forms of analysis, giving students several different lenses (developmental, interpersonal, structural) through which to demonstrate their understanding rather than a single expected reading.',
  },
  {
    id: 'dev-7',
    rubricSlug: 'udl',
    criterionIndex: 3,
    ratingLevel: 'does_not_meet',
    qualityTag: 'not_flagged',
    commentText:
      'Feedback throughout the module is limited to a single "Correct/Incorrect" indicator with no explanation of why an answer was wrong or what to review. Adding worked-example scaffolding after incorrect attempts — even a two-sentence explanation pointing back to the relevant section — would give students a path to revise their understanding instead of just a pass/fail signal.',
  },
  {
    id: 'dev-8',
    rubricSlug: 'udl',
    criterionIndex: 1,
    ratingLevel: 'does_not_meet',
    qualityTag: 'not_flagged',
    commentText:
      'Add a second case study set in a non-corporate context — right now every example is a business team, so students outside that frame have less to connect to. A nonprofit or healthcare team scenario would broaden it.',
  },
  {
    id: 'dev-9',
    rubricSlug: 'elearning',
    criterionIndex: 3,
    ratingLevel: 'exceeds',
    qualityTag: 'not_flagged',
    commentText:
      'LMS integration here is basically plug and play — grades sync automatically and the SSO handoff is invisible to the student. No setup friction at all.',
  },
  {
    id: 'dev-10',
    rubricSlug: 'elearning',
    criterionIndex: 7,
    ratingLevel: 'exceeds',
    qualityTag: 'not_flagged',
    commentText:
      'The adaptive practice sets are brilliant! Students who struggle get more scaffolded problems automatically and the ones who breeze through get extension challenges. Total win for differentiation.',
  },
  {
    id: 'dev-11',
    rubricSlug: 'copy-editing',
    criterionIndex: 0,
    ratingLevel: 'exceeds',
    qualityTag: 'not_flagged',
    commentText:
      'Grammar and punctuation are clean throughout — I did not find a single comma splice or subject-verb disagreement across all twelve chapters, which is rare for a manuscript this length.',
  },
  {
    id: 'dev-12',
    rubricSlug: 'udl',
    criterionIndex: 2,
    ratingLevel: 'exemplifies',
    qualityTag: 'not_flagged',
    commentText:
      'Engagement is solid — the module already draws on varied cultural examples. One addition worth considering: a short reflection prompt after each case study so students connect the material to their own context, not just observe it.',
  },
]
