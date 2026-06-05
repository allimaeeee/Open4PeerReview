// types/index.ts
// Named, app-level types derived from the database schema.
// Import from here rather than from database.types.ts directly.

import type { Tables, TablesInsert, TablesUpdate, Enums } from './database.types'

// ─── Enum aliases ─────────────────────────────────────────────────────────────

export type UserRole       = Enums<'user_role'>
export type ExpertDomain   = Enums<'expert_domain'>
export type FileType       = Enums<'file_type'>
export type ReviewStatus   = Enums<'review_status'>
export type CriterionScore = Enums<'criterion_score'>
export type HighlightTag   = 'general' | 'action_item' | 'quick_fix'

// ─── Table row types ──────────────────────────────────────────────────────────

export type AppUser      = Tables<'users'>
export type Document     = Tables<'documents'>
export type Rubric       = Tables<'rubrics'>
export type RubricItem   = Tables<'rubric_items'>
export type Review       = Tables<'reviews'>
export type ReviewScore  = Tables<'review_scores'>
export type Annotation   = Tables<'annotations'>

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
  'id' | 'rubric_item_id' | 'score' | 'comment'
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

/** Rubric fields shown in the rubric picker */
export type RubricPickerItem = Pick<Rubric, 'id' | 'title' | 'description' | 'operational_definition'>

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
  does_not_meet: 'Does Not Meet',
  exemplifies:   'Exemplifies',
  exceeds:       'Exceeds',
}
