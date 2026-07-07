// types/index.ts
// Named, app-level types derived from the database schema.
// Import from here rather than from database.types.ts directly.

import type { Tables, TablesInsert, TablesUpdate, Enums } from './database.types'

// ─── Enum aliases ─────────────────────────────────────────────────────────────

export type UserRole                = Enums<'user_role'>
export type ExpertDomain            = Enums<'expert_domain'>
export type FileType                = Enums<'file_type'>
export type ReviewStatus            = Enums<'review_status'>
export type CriterionScore          = Enums<'criterion_score'>
export type CreativeCommonsLicense  = Enums<'creative_commons_license'>
export type HighlightTag   = 'action_item' | 'quick_fix'
export type FeedbackResponseStatus  = Enums<'feedback_response_status'>
export type FeedbackTargetType      = Enums<'feedback_target_type'>

// ─── Table row types ──────────────────────────────────────────────────────────

export type AppUser      = Tables<'users'>
export type Document     = Tables<'documents'>
export type Rubric       = Tables<'rubrics'>
export type RubricItem   = Tables<'rubric_items'>
export type Review       = Tables<'reviews'>
export type ReviewScore  = Tables<'review_scores'>
export type Annotation   = Tables<'annotations'>
export type AuthorFeedbackResponse = Tables<'author_feedback_responses'>
export type RevisionNote           = Tables<'revision_notes'>

// ─── Insert / Update types ────────────────────────────────────────────────────

export type InsertUser         = TablesInsert<'users'>
export type UpdateUser         = TablesUpdate<'users'>
export type InsertReview       = TablesInsert<'reviews'>
export type UpdateReview       = TablesUpdate<'reviews'>
export type InsertReviewScore  = TablesInsert<'review_scores'>
export type UpdateReviewScore  = TablesUpdate<'review_scores'>
export type InsertAnnotation   = TablesInsert<'annotations'>
export type UpdateAnnotation   = TablesUpdate<'annotations'>

// ─── Enriched / joined types (for query results) ──────────────────────────────

export interface ReviewWithRelations extends Review {
  rubric: Pick<Rubric, 'id' | 'title' | 'description'>
  review_scores: ReviewScoreWithAnnotations[]
}

/** Review loaded in the reviewer UI (partial row + relations) */
export type ReviewSession = Pick<
  Review,
  'id' | 'status' | 'overall_comment' | 'last_saved_at' | 'rubric_id'
> & {
  rubric: Pick<Rubric, 'id' | 'title' | 'description'>
  review_scores: ReviewScoreSession[]
}

export type ReviewScoreSession = Pick<
  ReviewScore,
  'id' | 'rubric_item_id' | 'score' | 'criterion_scores' | 'comment'
> & {
  annotations: Pick<Annotation, 'id' | 'anchor' | 'body' | 'tag'>[]
}

/** Local annotation state in the reviewer console */
export interface LocalAnnotation {
  id: string
  anchor: unknown
  body: string
  tag: HighlightTag
}

export interface ReviewScoreWithAnnotations extends ReviewScore {
  annotations: Annotation[]
}

export interface RubricWithItems extends Rubric {
  rubric_items: RubricItem[]
}

/** Document fields loaded for the review UI */
export type OERDocument = Pick<Document, 'id' | 'title' | 'file_url' | 'storage_path'>

/** Rubric item fields loaded in the annotation panel */
export type RubricItemSummary = Pick<RubricItem, 'id' | 'label' | 'description' | 'sort_order'>

// ─── UI / form types ──────────────────────────────────────────────────────────

/** Fields collected during signup */
export interface SignupFormValues {
  email: string
  password: string
  confirmPassword: string
  displayName: string
}

/** Fields collected during onboarding */
export interface OnboardingFormValues {
  displayName: string
  institution: string
  primaryDiscipline: string
  profession: string
  roles: ('author' | 'reviewer')[]
}

/** Fields collected during onboarding */
export interface OnboardingFormValues {
  displayName: string
  institution: string
  primaryDiscipline: string
  profession: string
  roles: ('author' | 'reviewer')[]
}

/** Fields available when editing a user profile */
export interface ProfileFormValues {
  displayName: string
  profession: string
  primaryDiscipline: string
}

// ─── Display label maps ───────────────────────────────────────────────────────

export const PROFESSION_LABELS: Record<string, string> = {
  faculty_professor:      'Faculty / Professor',
  instructional_designer: 'Instructional Designer',
  editor:                 'Editor',
  industry_practitioner:  'Industry Practitioner',
  graduate_student:       'Graduate Student',
  other:                  'Other',
}

export const EXPERT_DOMAIN_LABELS: Record<ExpertDomain, string> = {
  agriculture:           'Agriculture',
  arts_and_humanities:   'Arts & Humanities',
  biology:               'Biology / Life Sciences',
  business:              'Business & Management',
  chemistry:             'Chemistry',
  computer_science:      'Computer Science & IT',
  economics:             'Economics',
  education:             'Education',
  engineering:           'Engineering & Technology',
  environmental_science: 'Environmental Science',
  health_and_medicine:   'Health & Medicine',
  history:               'History',
  law:                   'Law & Legal Studies',
  mathematics:           'Mathematics & Statistics',
  physics:               'Physics',
  social_sciences:       'Social Sciences',
  other:                 'Other',
}

export const CRITERION_SCORE_LABELS: Record<CriterionScore, string> = {
  does_not_meet: 'Needs Improvement',
  exemplifies:   'Proficient',
  exceeds:       'Exceeds',
}

export const CC_LICENSE_LABELS: Record<CreativeCommonsLicense, string> = {
  cc_by:        'CC BY',
  cc_by_sa:     'CC BY-SA',
  cc_by_nd:     'CC BY-ND',
  cc_by_nc:     'CC BY-NC',
  cc_by_nc_sa:  'CC BY-NC-SA',
  cc_by_nc_nd:  'CC BY-NC-ND',
}

export const CC_LICENSE_DESCRIPTIONS: Record<CreativeCommonsLicense, string> = {
  cc_by:        'Attribution — Others may distribute, remix, and build upon, even commercially, with credit.',
  cc_by_sa:     'Attribution-ShareAlike — Same as CC BY, but derivatives must use the same license.',
  cc_by_nd:     'Attribution-NoDerivatives — Redistribution allowed, even commercially, but no modifications.',
  cc_by_nc:     'Attribution-NonCommercial — Remix and build upon, but not for commercial purposes.',
  cc_by_nc_sa:  'Attribution-NonCommercial-ShareAlike — Non-commercial, derivatives must use the same license.',
  cc_by_nc_nd:  'Attribution-NonCommercial-NoDerivatives — Most restrictive; download and share with credit only.',
}
