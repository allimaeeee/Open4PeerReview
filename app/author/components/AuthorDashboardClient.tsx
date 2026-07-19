'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/patterns/DashboardShell'
import { FilterPillGroup } from '@/components/patterns/FilterPillGroup'
import { DocumentCard } from '@/components/patterns/DocumentCard'
import type { DocumentCardProps, RubricReview } from '@/components/patterns/DocumentCard'
import { DraftCard } from '@/components/patterns/DraftCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SubmissionModal } from './SubmissionModal'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { deleteDocument } from '@/app/coordinator/actions'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense, ReportStatus } from '@/types'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface RubricRow {
  id: string
  title: string
  description: string | null
}

interface DocumentRow {
  id: string
  title: string
  authors: string
  subject_matter: string
  creative_commons_license: string
  third_party_content_disclosure: string | null
  file_type: string | null
  platform: string | null
  created_at: string
  is_draft: boolean
  report_status: ReportStatus | null
  submission_scope: string[] | null
  public_review: boolean | null
  document_rubrics: { rubric: { id: string; title: string } | null }[]
  reviews: {
    id: string
    status: string
    submitted_at: string | null
    rubric_id: string
    coordinator_approval?: string | null
    review_rubric_submissions?: { rubric_id: string }[]
  }[]
}

interface Props {
  displayName: string
  documents: DocumentRow[]
  rubrics: RubricRow[]
  customSubjectMatters: string[]
  authorInstitution: string | null
}

// 'assigned' status is intentionally unused here — it will be wired in once the
// coordinator dashboard is in place (coordinator assigns unassigned OER to a reviewer).
function mapDocumentToCardProps(doc: DocumentRow): DocumentCardProps {
  const docRubricIds = doc.document_rubrics
    .map(dr => dr.rubric?.id)
    .filter((id): id is string => !!id)

  // Split submitted rubrics into coordinator-approved and pending sets.
  // Organization-scoped docs require coordinator_approval === 'approved' before
  // feedback is visible to the author (mirrors getDocumentFeedback's gate).
  // Public-pool docs skip the gate — submission alone is sufficient.
  const approvedRubricIds = new Set<string>()
  const pendingRubricIds = new Set<string>()
  const requiresApproval = doc.submission_scope?.includes('organization') ?? false

  doc.reviews.forEach(rev => {
    const subs = rev.review_rubric_submissions ?? []
    // Per-rubric submission rows are the primary signal; legacy whole-review
    // submissions (status === 'submitted', no rows) fall back to all doc rubrics.
    const rubricIds = subs.length > 0
      ? subs.map(s => s.rubric_id)
      : rev.status === 'submitted' ? docRubricIds : []

    if (!requiresApproval || rev.coordinator_approval === 'approved') {
      rubricIds.forEach(id => approvedRubricIds.add(id))
    } else {
      rubricIds.forEach(id => pendingRubricIds.add(id))
    }
  })

  const hasActiveReview = doc.reviews.length > 0

  const rubrics: RubricReview[] = doc.document_rubrics
    .map(dr => dr.rubric)
    .filter((r): r is { id: string; title: string } => r !== null)
    .map(r => {
      const status: RubricReview['status'] =
        doc.report_status === 'published' ? 'published' :
        approvedRubricIds.has(r.id)       ? 'feedback-ready' :
        pendingRubricIds.has(r.id)        ? 'review-submitted' :
        hasActiveReview                   ? 'under-review' :
        'unassigned'
      return { rubricId: r.id, rubricTitle: r.title, status }
    })

  const reportReady = rubrics.length > 0 && rubrics.every(r => r.status === 'feedback-ready')

  return {
    id: doc.id,
    title: doc.title,
    platform: doc.platform
      ?? (doc.file_type === 'pdf' ? 'PDF'
      : doc.file_type?.toUpperCase() ?? ''),
    authors: doc.authors ?? '',
    discipline: EXPERT_DOMAIN_LABELS[doc.subject_matter as ExpertDomain] ?? doc.subject_matter ?? '',
    ccLicense: CC_LICENSE_LABELS[doc.creative_commons_license as CreativeCommonsLicense] ?? doc.creative_commons_license ?? '',
    description: doc.third_party_content_disclosure ?? '',
    submittedAt: doc.created_at,
    rubrics,
    reportStatus: doc.report_status,
    reportReady,
    publicReview: doc.public_review ?? false,
  }
}

type TabId = 'active' | 'active-public' | 'active-private' | 'completed' | 'completed-public' | 'completed-private' | 'drafts'

const PAGE_COPY: Record<TabId, { header: string; subtext: string }> = {
  'active':            { header: 'Active Submissions',            subtext: 'Track your submissions through the peer review pipeline.' },
  'active-public':     { header: 'Active Public Submissions',     subtext: 'Public submissions currently moving through the peer review pipeline.' },
  'active-private':    { header: 'Active Private Submissions',    subtext: 'Private submissions currently moving through the peer review pipeline.' },
  'completed':         { header: 'Completed Submissions',         subtext: 'Submissions that have finished the peer review pipeline.' },
  'completed-public':  { header: 'Completed Public Submissions',  subtext: "Public submissions you've published or chosen to keep private." },
  'completed-private': { header: 'Completed Private Submissions', subtext: 'Private submissions whose review process is complete.' },
  'drafts':            { header: 'Drafts',                        subtext: 'Submissions saved as drafts.' },
}

export function AuthorDashboardClient({ displayName, documents, rubrics, customSubjectMatters, authorInstitution }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('active')
  const [activeFilter, setActiveFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [draftDocumentIdForModal, setDraftDocumentIdForModal] = useState<string | null>(null)

  const draftDocuments = documents.filter(d => d.is_draft)
  const allCards = documents.filter(d => !d.is_draft).map(mapDocumentToCardProps)

  // Tab split — "completed" = the author has finalized the report (published or
  // kept private); "active" = everything still in the pipeline, including reports
  // that are released but awaiting the author's decision, or being revised.
  const isFinalized = (c: DocumentCardProps) => c.reportStatus === 'published' || c.reportStatus === 'private'
  const activeCards = allCards.filter(c => !isFinalized(c))
  const completedCards = allCards.filter(isFinalized)

  const tabIsActive    = activeTab === 'active' || activeTab === 'active-public'    || activeTab === 'active-private'
  const tabIsCompleted = activeTab === 'completed' || activeTab === 'completed-public' || activeTab === 'completed-private'

  const activePublicCount     = activeCards.filter(c => c.publicReview === true).length
  const activePrivateCount    = activeCards.filter(c => !c.publicReview).length
  const completedPublicCount  = completedCards.filter(c => c.publicReview === true).length
  const completedPrivateCount = completedCards.filter(c => !c.publicReview).length

  const baseCards = tabIsActive ? activeCards : tabIsCompleted ? completedCards : []
  const tabCards =
    activeTab === 'active-public'     ? baseCards.filter(c => c.publicReview === true) :
    activeTab === 'active-private'    ? baseCards.filter(c => !c.publicReview) :
    activeTab === 'completed-public'  ? baseCards.filter(c => c.publicReview === true) :
    activeTab === 'completed-private' ? baseCards.filter(c => !c.publicReview) :
    baseCards

  const getPriorityStatus = (card: DocumentCardProps): RubricReview['status'] => {
    const PRIORITY: RubricReview['status'][] = ['published', 'feedback-ready', 'review-submitted', 'under-review', 'assigned', 'unassigned']
    return PRIORITY.find(s => card.rubrics.some(r => r.status === s)) ?? 'unassigned'
  }

  const filterOptions = tabIsActive
    ? [
        { value: 'all',              label: 'All',              count: tabCards.length },
        { value: 'needs-revision',   label: 'Needs Revision',   count: tabCards.filter(c => getPriorityStatus(c) === 'feedback-ready').length },
        { value: 'review-submitted', label: 'Review Submitted', count: tabCards.filter(c => getPriorityStatus(c) === 'review-submitted').length },
        { value: 'under-review',     label: 'Under Review',     count: tabCards.filter(c => getPriorityStatus(c) === 'under-review').length },
        { value: 'assigned',         label: 'Assigned',         count: tabCards.filter(c => getPriorityStatus(c) === 'assigned').length },
        { value: 'unassigned',       label: 'Unassigned',       count: tabCards.filter(c => getPriorityStatus(c) === 'unassigned').length },
      ]
    : tabIsCompleted
      ? [
          { value: 'all',       label: 'All',       count: tabCards.length },
          { value: 'published', label: 'Published', count: tabCards.filter(c => c.reportStatus === 'published').length },
          { value: 'private',   label: 'Private',   count: tabCards.filter(c => c.reportStatus === 'private').length },
        ]
      : []

  const filteredCards = activeFilter === 'all'
    ? tabCards
    : tabIsCompleted
      ? tabCards.filter(c => c.reportStatus === activeFilter)
      : tabCards.filter(c => {
          const s = getPriorityStatus(c)
          if (activeFilter === 'needs-revision') return s === 'feedback-ready'
          return s === activeFilter
        })

  const handleTabChange = (id: string) => {
    setActiveTab(id as TabId)
    setActiveFilter('all')
  }

  const navBtn = (id: string, label: string, count?: number, indent = false) => {
    const isActive = activeTab === id
    return (
      <button
        type="button"
        onClick={() => handleTabChange(id)}
        className={cx(
          'w-full text-left py-2 rounded-md text-body-md transition-colors cursor-pointer flex items-center justify-between',
          indent ? 'pl-7 pr-3' : 'px-3',
          isActive
            ? 'bg-surface-container text-text-primary font-medium'
            : 'text-text-secondary hover:bg-surface-container hover:text-text-primary'
        )}
      >
        <span className={cx(!indent && 'font-semibold')}>{label}</span>
        {count !== undefined && (
          <span className="text-label-sm font-label font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container-high)] text-text-muted leading-none">
            {count}
          </span>
        )}
      </button>
    )
  }

  const rightPanel = (
    <div className="p-4">
      <Card>
        <div className="p-4">
          <h3 className="font-heading text-title-sm text-text-primary mb-2">Recent Activity</h3>
          <p className="text-body-sm text-text-muted">Activity feed coming soon.</p>
        </div>
      </Card>
    </div>
  )

  const sidebar = (
    <div className="flex flex-col h-full p-4">
      <Button
        variant="primary"
        size="md"
        fullWidth
        onClick={() => setShowUpload(true)}
        className="mb-6"
      >
        + New Submission
      </Button>

      <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-text-muted mb-3">
        My Workspace
      </p>

      {navBtn('active', 'Active Submissions', activeCards.length)}
      {navBtn('active-public',  'Public',  activePublicCount,  true)}
      {navBtn('active-private', 'Private', activePrivateCount, true)}

      <div className="mt-2">
        {navBtn('completed',         'Completed',  completedCards.length)}
        {navBtn('completed-public',  'Public',  completedPublicCount,  true)}
        {navBtn('completed-private', 'Private', completedPrivateCount, true)}
      </div>

      <div className="mt-2">
        {navBtn('drafts', 'Drafts', draftDocuments.length || undefined)}
      </div>
    </div>
  )

  return (
    <>
      <DashboardShell sidebar={sidebar} rightPanel={rightPanel}>
        <div className="px-8 py-8">

          {/* Page header */}
          <div className="mb-6">
            <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary mb-2">
              Author Workspace
            </p>
            <h1 className="text-heading-lg font-semibold font-heading text-text-primary">
              {PAGE_COPY[activeTab].header}
            </h1>
            <p className="text-body-md text-text-secondary mt-1">
              {PAGE_COPY[activeTab].subtext}
            </p>
          </div>

          {/* Filter pills (not shown on Drafts tab) */}
          {activeTab !== 'drafts' && (
            <FilterPillGroup
              options={filterOptions}
              value={activeFilter}
              onChange={setActiveFilter}
              size="sm"
            />
          )}

          {/* Document list */}
          <div className="mt-6 space-y-4">
            {activeTab === 'drafts' ? (
              draftDocuments.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] py-16 text-center">
                  <p className="text-body-md font-medium text-text-secondary">No drafts yet.</p>
                  <p className="text-body-sm text-text-muted mt-1">
                    Save a submission as a draft and it will appear here.
                  </p>
                </div>
              ) : (
                draftDocuments.map(doc => {
                  const rubrics = doc.document_rubrics
                    .map(dr => dr.rubric)
                    .filter((r): r is { id: string; title: string } => r !== null)
                  const platform = doc.platform
                    ?? (doc.file_type === 'pdf' ? 'PDF' : doc.file_type?.toUpperCase() ?? 'Unknown')
                  return (
                    <DraftCard
                      key={doc.id}
                      id={doc.id}
                      title={doc.title}
                      platform={platform}
                      rubrics={rubrics}
                      savedAt={doc.created_at}
                      onContinue={() => {
                        setDraftDocumentIdForModal(doc.id)
                        setShowUpload(true)
                      }}
                      onDelete={() => setDeletingId(doc.id)}
                    />
                  )
                })
              )
            ) : filteredCards.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] py-16 text-center">
                <p className="text-body-md font-medium text-text-secondary">No submissions here yet.</p>
                <p className="text-body-sm text-text-muted mt-1">
                  {tabIsActive
                    ? 'Use the sidebar to submit a new OER for review.'
                    : 'Reports you publish or keep private will appear here.'}
                </p>
              </div>
            ) : (
              filteredCards.map(card => {
                const canDelete = card.rubrics.every(r => r.status === 'unassigned' || r.status === 'assigned')
                return (
                  <DocumentCard
                    key={card.id}
                    {...card}
                    onDelete={tabIsActive && canDelete ? () => setDeletingId(card.id) : undefined}
                    deleteDisabled={tabIsActive && !canDelete}
                  />
                )
              })
            )}
          </div>

        </div>
      </DashboardShell>

      <SubmissionModal
        isOpen={showUpload}
        onClose={() => { setShowUpload(false); setDraftDocumentIdForModal(null) }}
        rubrics={rubrics}
        customSubjectMatters={customSubjectMatters}
        displayName={displayName}
        authorInstitution={authorInstitution}
        documentId={draftDocumentIdForModal ?? undefined}
      />

      <ConfirmationDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete submission?"
        message="This will permanently remove the submission and all associated reviews. This cannot be undone."
        discardLabel="Delete"
        confirmLabel="Cancel"
        onDiscard={async () => {
          if (deletingId) await deleteDocument(deletingId)
          setDeletingId(null)
        }}
        onConfirm={() => setDeletingId(null)}
      />
    </>
  )
}
