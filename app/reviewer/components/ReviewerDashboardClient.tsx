'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { acceptDocument, declineDocument } from '@/app/coordinator/actions'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DashboardShell } from '@/components/patterns/DashboardShell'
import { DashboardSidebar } from '@/components/patterns/DashboardSidebar'
import { FilterPillGroup } from '@/components/patterns/FilterPillGroup'
import { ReviewerCard } from '@/components/patterns/ReviewerCard'
import type { ReviewerCardProps } from '@/components/patterns/ReviewerCard'
import { CompletedReviewCard } from '@/components/patterns/CompletedReviewCard'
import type { CompletedReviewCardProps } from '@/components/patterns/CompletedReviewCard'
import { TaskPoolCard } from '@/components/patterns/TaskPoolCard'
import type { TaskPoolCardProps } from '@/components/patterns/TaskPoolCard'
import { Card } from '@/components/ui/Card'

interface Props {
  displayName: string
  activeCards: Omit<ReviewerCardProps, 'onNavigate'>[]
  completedCards: CompletedReviewCardProps[]
  taskCards: Omit<TaskPoolCardProps, 'onAccept' | 'onDecline'>[]
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] py-16 text-center">
      <p className="text-body-md font-medium text-text-secondary">{message}</p>
      <p className="text-body-sm text-text-muted mt-1">{sub}</p>
    </div>
  )
}

export function ReviewerDashboardClient({ displayName: _displayName, activeCards, completedCards, taskCards }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = (searchParams.get('tab') ?? 'my-reviews') as 'my-reviews' | 'completed' | 'task-pool'
  const [activeTab, setActiveTab] = useState<'my-reviews' | 'completed' | 'task-pool'>(initialTab)
  const [confirmModal, setConfirmModal] = useState<'accepted' | 'declined' | null>(null)
  const [acceptConfirm, setAcceptConfirm] = useState<{ id: string; publicReview: boolean } | null>(null)
  const [showSubmittedModal, setShowSubmittedModal] = useState(searchParams.get('submitted') === 'true')

  // Clear ?submitted from the URL so a refresh doesn't re-show the modal
  useEffect(() => {
    if (searchParams.get('submitted') === 'true') {
      router.replace('/reviewer?tab=completed', { scroll: false })
    }
  }, [])

  // My Reviews filters
  const [activeFilter, setActiveFilter] = useState('all')

  // Completed tab filters
  const [completedFilter, setCompletedFilter] = useState('all')

  // Task Pool filters
  const [poolRubricFilter, setPoolRubricFilter] = useState('all')

  const handleTabChange = (id: string) => {
    setActiveTab(id as typeof activeTab)
    setActiveFilter('all')
    setCompletedFilter('all')
    setPoolRubricFilter('all')
  }

  // ── My Reviews ──────────────────────────────────────────────────────────────

  const getCardStatus = (card: typeof activeCards[number]) =>
    card.rubrics.some(r => r.ratedCount > 0) ? 'in-progress' : 'not-started'

  const filterOptions = [
    { value: 'all',         label: 'All',         count: activeCards.length },
    { value: 'in-progress', label: 'In Progress', count: activeCards.filter(c => getCardStatus(c) === 'in-progress').length },
    { value: 'not-started', label: 'Not Started', count: activeCards.filter(c => getCardStatus(c) === 'not-started').length },
  ]

  const filteredActiveCards = activeFilter === 'all'
    ? activeCards
    : activeCards.filter(c => getCardStatus(c) === activeFilter)

  // ── Completed ───────────────────────────────────────────────────────────────

  const completedRubrics = ['all', ...Array.from(new Set(completedCards.flatMap(c => c.rubrics.map(r => r.rubricTitle))))]

  const completedFilterOptions = completedRubrics.map(rubric => ({
    value: rubric,
    label: rubric === 'all' ? 'All' : rubric,
    count: rubric === 'all'
      ? completedCards.length
      : completedCards.filter(c => c.rubrics.some(r => r.rubricTitle === rubric)).length,
  }))

  const filteredCompletedCards = completedFilter === 'all'
    ? completedCards
    : completedCards.filter(c => c.rubrics.some(r => r.rubricTitle === completedFilter))

  // ── Task Pool ────────────────────────────────────────────────────────────────

  const poolRubrics = ['all', ...Array.from(new Set(taskCards.flatMap(c => c.rubrics.map(r => r.rubricTitle))))]

  const filteredTaskCards = taskCards
    .filter(c => poolRubricFilter === 'all' || c.rubrics.some(r => r.rubricTitle === poolRubricFilter))

  const poolRubricOptions = poolRubrics.map(rubric => ({
    value: rubric,
    label: rubric === 'all' ? 'All' : rubric,
    count: rubric === 'all'
      ? taskCards.length
      : taskCards.filter(c => c.rubrics.some(r => r.rubricTitle === rubric)).length,
  }))

  // ── Sidebar / layout ─────────────────────────────────────────────────────────

  const sidebarItems = [
    { id: 'my-reviews', label: 'My Reviews', count: activeCards.length },
    { id: 'completed',  label: 'Completed',  count: completedCards.length },
    { id: 'task-pool',  label: 'Task Pool',  count: taskCards.length },
  ]

  const sidebar = (
    <DashboardSidebar
      title="Reviewer Workspace"
      activeItem={activeTab}
      items={sidebarItems}
      onNavigate={handleTabChange}
    />
  )

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

  const headingMap = {
    'my-reviews': { heading: 'My Reviews',        description: 'Manage your active review assignments.' },
    'completed':  { heading: 'Completed Reviews',  description: 'Reviews you have submitted.' },
    'task-pool':  { heading: 'Task Pool',           description: 'OERs available for you to review.' },
  }

  const { heading, description } = headingMap[activeTab]

  return (
    <DashboardShell sidebar={sidebar} rightPanel={rightPanel}>
      <div className="px-8 py-8">

        {/* Page header */}
        <div className="mb-6">
          <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary mb-2">
            Reviewer Workspace
          </p>
          <h1 className="text-heading-lg font-semibold font-heading text-text-primary">
            {heading}
          </h1>
          <p className="text-body-md text-text-secondary mt-1">
            {description}
          </p>
        </div>

        {/* My Reviews tab */}
        {activeTab === 'my-reviews' && (
          <>
            <FilterPillGroup options={filterOptions} value={activeFilter} onChange={setActiveFilter} size="sm" />
            <div className="mt-6 space-y-4">
              {filteredActiveCards.length === 0 ? (
                <EmptyState message="No active reviews." sub="Check the Task Pool to find new assignments." />
              ) : (
                filteredActiveCards.map(card => <ReviewerCard key={card.id} {...card} />)
              )}
            </div>
          </>
        )}

        {/* Completed tab */}
        {activeTab === 'completed' && (
          <>
            {completedCards.length > 0 && (
              <FilterPillGroup options={completedFilterOptions} value={completedFilter} onChange={setCompletedFilter} size="sm" />
            )}
            <div className="mt-6 space-y-4">
              {completedCards.length === 0 ? (
                <EmptyState message="No completed reviews yet." sub="Completed reviews will appear here once submitted." />
              ) : (
                filteredCompletedCards.map(card => <CompletedReviewCard key={card.id} {...card} />)
              )}
            </div>
          </>
        )}

        {/* Task Pool tab */}
        {activeTab === 'task-pool' && (
          <>
            {taskCards.length > 0 && (
              <FilterPillGroup options={poolRubricOptions} value={poolRubricFilter} onChange={setPoolRubricFilter} size="sm" />
            )}
            <div className="mt-6 space-y-4">
              {taskCards.length === 0 ? (
                <EmptyState message="No tasks available." sub="Check back later for new assignments." />
              ) : filteredTaskCards.length === 0 ? (
                <EmptyState message="No tasks match the selected filters." sub="Try adjusting the filters above." />
              ) : (
                filteredTaskCards.map(card => (
                  <TaskPoolCard
                    key={card.id}
                    {...card}
                    onAccept={() => {
                      setAcceptConfirm({ id: card.id, publicReview: card.publicReview ?? false })
                    }}
                    onDecline={async (id, declineNote) => {
                      await declineDocument(id, declineNote)
                      router.refresh()
                      setConfirmModal('declined')
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}

      </div>
      {/* Accept confirmation modal */}
      <Modal open={acceptConfirm !== null} onClose={() => setAcceptConfirm(null)}>
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-card rounded-lg shadow-4 p-6"
        >
          <button
            type="button"
            onClick={() => setAcceptConfirm(null)}
            aria-label="Close"
            className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 4L4 12M4 4l8 8" />
            </svg>
          </button>
          <h2 className="font-heading text-title-md text-text-primary mb-3 pr-6">Accept this review?</h2>
          <p className="text-body-md text-text-secondary mb-6">
            {acceptConfirm?.publicReview
              ? 'This is a public review. If the author chooses to publish it, your feedback, ratings, and comments may appear on the O4PR public site alongside the OER. Once accepted, this task moves to your active reviews.'
              : 'This is a private review. Your feedback, ratings, and comments will only be visible to the author and coordinators, and won\'t appear on the public site. Once accepted, this task moves to your active reviews.'}
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setAcceptConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={async () => {
                if (!acceptConfirm) return
                await acceptDocument(acceptConfirm.id)
                setAcceptConfirm(null)
                router.refresh()
                setActiveTab('my-reviews')
                setConfirmModal('accepted')
              }}
            >
              Accept review
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showSubmittedModal} onClose={() => setShowSubmittedModal(false)}>
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-card rounded-lg shadow-4 p-6"
        >
          <button
            type="button"
            onClick={() => setShowSubmittedModal(false)}
            aria-label="Close"
            className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 4L4 12M4 4l8 8" />
            </svg>
          </button>
          <p className="text-body-md text-text-primary pr-6">
            Your review was successfully submitted.
          </p>
        </div>
      </Modal>

      <Modal open={confirmModal !== null} onClose={() => setConfirmModal(null)}>
        <div
          onClick={e => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-card rounded-lg shadow-4 p-6"
        >
          <button
            type="button"
            onClick={() => setConfirmModal(null)}
            aria-label="Close"
            className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <p className="text-body-md text-text-primary pr-6">
            {confirmModal === 'accepted'
              ? 'Assignment accepted. You can find it in your My Reviews tab.'
              : 'Assignment declined. It has been removed from your task pool.'}
          </p>
        </div>
      </Modal>
    </DashboardShell>
  )
}
