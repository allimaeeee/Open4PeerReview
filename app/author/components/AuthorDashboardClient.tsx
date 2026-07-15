'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/patterns/DashboardShell'
import { DashboardSidebar } from '@/components/patterns/DashboardSidebar'
import { FilterPillGroup } from '@/components/patterns/FilterPillGroup'
import { DocumentCard } from '@/components/patterns/DocumentCard'
import type { DocumentCardProps, RubricReview } from '@/components/patterns/DocumentCard'
import { Card } from '@/components/ui/Card'
import { SubmissionModal } from './SubmissionModal'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { deleteDocument } from '@/app/coordinator/actions'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense, ReportStatus } from '@/types'

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
  report_status: ReportStatus | null
  document_rubrics: { rubric: { id: string; title: string } | null }[]
  reviews: {
    id: string
    status: string
    submitted_at: string | null
    rubric_id: string
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

  // Per-rubric submission: a rubric is 'feedback-ready' once released to the author.
  // Legacy fallback: a submitted review with no submission rows predates per-rubric
  // submission — treat all its rubrics as released.
  const submittedRubricIds = new Set<string>(
    doc.reviews.flatMap(rev => {
      const subs = rev.review_rubric_submissions ?? []
      if (subs.length > 0) return subs.map(s => s.rubric_id)
      if (rev.status === 'submitted') return docRubricIds
      return []
    })
  )
  // The author only ever sees reviews that have started releasing feedback (RLS), so any
  // review present means a reviewer is actively working the remaining rubrics.
  const hasActiveReview = doc.reviews.length > 0

  const rubrics: RubricReview[] = doc.document_rubrics
    .map(dr => dr.rubric)
    .filter((r): r is { id: string; title: string } => r !== null)
    .map(r => {
      const status: RubricReview['status'] =
        submittedRubricIds.has(r.id) ? 'feedback-ready' :
        hasActiveReview              ? 'under-review' :
        'unassigned'
      return { rubricId: r.id, rubricTitle: r.title, status }
    })

  // The report is releasable once every rubric has reached feedback-ready (or certified).
  const reportReady = rubrics.length > 0 && rubrics.every(r => r.status === 'feedback-ready' || r.status === 'certified')

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
  }
}

export function AuthorDashboardClient({ displayName, documents, rubrics, customSubjectMatters, authorInstitution }: Props) {
  const [activeTab, setActiveTab] = useState('active')
  const [activeFilter, setActiveFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const allCards = documents.map(mapDocumentToCardProps)

  // Tab split — "completed" = the author has finalized the report (published or
  // kept private); "active" = everything still in the pipeline, including reports
  // that are released but awaiting the author's decision, or being revised.
  const isFinalized = (c: DocumentCardProps) => c.reportStatus === 'published' || c.reportStatus === 'private'
  const activeCards = allCards.filter(c => !isFinalized(c))
  const completedCards = allCards.filter(isFinalized)

  const tabCards = activeTab === 'active' ? activeCards : completedCards

  const getPriorityStatus = (card: DocumentCardProps): RubricReview['status'] => {
    const PRIORITY: RubricReview['status'][] = ['feedback-ready', 'under-review', 'assigned', 'unassigned']
    const allCertified = card.rubrics.length > 0 && card.rubrics.every(r => r.status === 'certified')
    if (allCertified) return 'certified'
    return PRIORITY.find(s => card.rubrics.some(r => r.status === s)) ?? 'unassigned'
  }

  const filterOptions = activeTab === 'active'
    ? [
        { value: 'all',            label: 'All',           count: tabCards.length },
        { value: 'needs-revision', label: 'Needs Revision', count: tabCards.filter(c => getPriorityStatus(c) === 'feedback-ready').length },
        { value: 'under-review',   label: 'Under Review',  count: tabCards.filter(c => getPriorityStatus(c) === 'under-review').length },
        { value: 'assigned',       label: 'Assigned',      count: tabCards.filter(c => getPriorityStatus(c) === 'assigned').length },
        { value: 'unassigned',     label: 'Unassigned',    count: tabCards.filter(c => getPriorityStatus(c) === 'unassigned').length },
      ]
    : [
        { value: 'all',       label: 'All',       count: tabCards.length },
        { value: 'published', label: 'Published', count: tabCards.filter(c => c.reportStatus === 'published').length },
        { value: 'private',   label: 'Private',   count: tabCards.filter(c => c.reportStatus === 'private').length },
      ]

  const filteredCards = activeFilter === 'all'
    ? tabCards
    : activeTab === 'completed'
      ? tabCards.filter(c => c.reportStatus === activeFilter)
      : tabCards.filter(c => {
          const s = getPriorityStatus(c)
          if (activeFilter === 'needs-revision') return s === 'feedback-ready'
          return s === activeFilter
        })

  const sidebarItems = [
    { id: 'active',    label: 'Active Submissions', count: activeCards.length },
    { id: 'completed', label: 'Completed',          count: completedCards.length },
  ]

  const handleTabChange = (id: string) => {
    setActiveTab(id)
    setActiveFilter('all')
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
    <DashboardSidebar
      title="My Workspace"
      activeItem={activeTab}
      items={sidebarItems}
      onNavigate={handleTabChange}
      ctaLabel="+ New Submission"
      onCtaClick={() => setShowUpload(true)}
    />
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
              {activeTab === 'active' ? 'Active Submissions' : 'Completed Submissions'}
            </h1>
            <p className="text-body-md text-text-secondary mt-1">
              {activeTab === 'active'
                ? 'Track your submissions through the certification pipeline.'
                : 'Reports you have published or kept private.'}
            </p>
          </div>

          {/* Filter pills */}
          <FilterPillGroup
            options={filterOptions}
            value={activeFilter}
            onChange={setActiveFilter}
            size="sm"
          />

          {/* Document list */}
          <div className="mt-6 space-y-4">
            {filteredCards.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] py-16 text-center">
                <p className="text-body-md font-medium text-text-secondary">No submissions here yet.</p>
                <p className="text-body-sm text-text-muted mt-1">
                  {activeTab === 'active'
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
                    onDelete={activeTab === 'active' && canDelete ? () => setDeletingId(card.id) : undefined}
                    deleteDisabled={activeTab === 'active' && !canDelete}
                  />
                )
              })
            )}
          </div>

        </div>
      </DashboardShell>

      <SubmissionModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        rubrics={rubrics}
        customSubjectMatters={customSubjectMatters}
        displayName={displayName}
        authorInstitution={authorInstitution}
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
