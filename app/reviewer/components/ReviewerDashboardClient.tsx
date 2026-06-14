'use client'

import { useState } from 'react'
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
  const [activeTab, setActiveTab] = useState<'my-reviews' | 'completed' | 'task-pool'>('my-reviews')

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
                    onAccept={(id) => console.log('Accept', id)}
                    onDecline={(id, reason, note) => console.log('Decline', id, reason, note)}
                  />
                ))
              )}
            </div>
          </>
        )}

      </div>
    </DashboardShell>
  )
}
