'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/patterns/DashboardShell'
import { DashboardSidebar } from '@/components/patterns/DashboardSidebar'
import { FilterPillGroup } from '@/components/patterns/FilterPillGroup'
import { DocumentCard } from '@/components/patterns/DocumentCard'
import type { DocumentCardProps, RubricReview } from '@/components/patterns/DocumentCard'
import { Card } from '@/components/ui/Card'
import { SubmissionModal } from './SubmissionModal'
import { EXPERT_DOMAIN_LABELS, CC_LICENSE_LABELS } from '@/types'
import type { ExpertDomain, CreativeCommonsLicense } from '@/types'

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
  document_rubrics: { rubric: { id: string; title: string } | null }[]
  reviews: { id: string; status: string; submitted_at: string | null; rubric_id: string }[]
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
  const rubrics: RubricReview[] = doc.document_rubrics
    .map(dr => dr.rubric)
    .filter((r): r is { id: string; title: string } => r !== null)
    .map(r => {
      const review = doc.reviews.find(rev => rev.rubric_id === r.id)
      const status: RubricReview['status'] =
        review?.status === 'submitted'   ? 'feedback-ready' :
        review?.status === 'in_progress' ? 'under-review' :
        'unassigned'
      return { rubricId: r.id, rubricTitle: r.title, status }
    })

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
  }
}

export function AuthorDashboardClient({ displayName, documents, rubrics, customSubjectMatters }: Props) {
  const [activeTab, setActiveTab] = useState('active')
  const [activeFilter, setActiveFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)

  const allCards = documents.map(mapDocumentToCardProps)

  // Tab split — "completed" = all rubrics certified; "active" = everything else
  // NOTE: with interim status mapping, completed will always be empty until
  // backend supports per-rubric certified status.
  const activeCards = allCards.filter(c => !c.rubrics.every(r => r.status === 'certified'))
  const completedCards = allCards.filter(c => c.rubrics.length > 0 && c.rubrics.every(r => r.status === 'certified'))

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
        { value: 'certified', label: 'Certified', count: tabCards.length },
      ]

  const filteredCards = activeFilter === 'all'
    ? tabCards
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
                : 'Review your certified OER submissions.'}
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
                    : 'Completed submissions will appear here once all rubrics are certified.'}
                </p>
              </div>
            ) : (
              filteredCards.map(card => (
                <DocumentCard key={card.id} {...card} />
              ))
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
      />
    </>
  )
}
